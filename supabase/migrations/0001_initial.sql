-- Current Life Map — schema (CMS, client records, booking addendum, 12 Oct 2026)
--
-- Principles
--  * One canonical assessment_id across answers, results, artifacts, contact, booking and coaching.
--  * Anonymous by default. A client record exists only when the person supplied details (PDF email or booking).
--  * Raw answers, calculated results, generated artifacts and coach material live in separate tables.
--  * The public site never queries tables directly: server routes use the service role and validate input.
--  * Coaches read/write through RLS: role = coach AND session authenticated with MFA (aal2).
--  * No answer bodies or free text in audit_events.

-- gen_random_uuid() is built in (PostgreSQL 13+)

-- ── Coaches ─────────────────────────────────────────────────────────────────
create table coach_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'coach' check (role in ('coach', 'admin')),
  created_at timestamptz not null default now()
);

-- ── Assessments (anonymous) ─────────────────────────────────────────────────
create table assessments (
  id uuid primary key default gen_random_uuid(),
  access_token_hash text not null unique,              -- sha256 of the respondent's opaque token
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'deleted')),
  assessment_version text not null,
  question_bank_version text not null,
  sections_completed smallint not null default 0 check (sections_completed between 0 and 10),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  previous_assessment_id uuid references assessments(id)
);
create index on assessments (status, created_at desc);

create table assessment_answers (
  assessment_id uuid not null references assessments(id) on delete cascade,
  question_id text not null,
  question_version text not null,
  response_status text not null check (response_status in ('answered', 'not_applicable', 'skipped')),
  option_ids text[],
  raw_ordinal smallint check (raw_ordinal between 1 and 5),
  selected_orbit text,
  raw_value jsonb,                                      -- exact stored value for reproducible recomputation (null for free text)
  text_ciphertext text,                                 -- free text, encrypted at the application layer
  answered_at timestamptz not null default now(),
  primary key (assessment_id, question_id)
);

-- Frozen, versioned result snapshot: exactly what the respondent saw
create table assessment_results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  scoring_version text not null,
  metrics jsonb not null,
  evidence jsonb not null,
  snapshot jsonb not null,
  snapshot_sha256 text not null,
  generated_at timestamptz not null default now(),
  unique (assessment_id, scoring_version)
);

create table report_artifacts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('client_pdf', 'coach_report', 'deep_dive_script', 'client_understanding')),
  version int not null,
  storage_key text,                                     -- private bucket key, never a public URL
  checksum text,
  generation_status text not null check (generation_status in ('pending', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  unique (assessment_id, artifact_type, version)
);

-- ── Identified people (only from user-supplied details) ─────────────────────
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  privacy_status text not null default 'active' check (privacy_status in ('active', 'deletion_requested', 'deleted')),
  coaching_enrolled boolean not null default false,     -- set by the coach: enrolled on 1:1 coaching (kept in step with stage = 'client')
  coaching_enrolled_at date,
  -- Client profile (Oct 13): Prospect (did the self-interview) → Lead (booked a Deep Dive) → Client (1:1 coaching)
  stage text not null default 'prospect' check (stage in ('prospect', 'lead', 'client')),
  stage_changed_at timestamptz,
  -- Coach-confirmed merge only: a duplicate record (e.g. from a second PDF request) folded into a profile by Jana
  merged_into_client_id uuid references clients(id) on delete set null,
  -- Private self-interview link for Clients: Maps completed through it attach to this profile.
  -- Lookup by hash; the token itself is stored encrypted so the coach can copy the link again.
  invite_token_hash text unique,
  invite_token_ciphertext text,
  invite_created_at timestamptz,
  created_at timestamptz not null default now(),
  check (merged_into_client_id is null or merged_into_client_id <> id)
);
-- Deliberately NOT unique on email: contacts are never merged automatically.
create index on clients (lower(email));
create index on clients (stage) where merged_into_client_id is null;

create table assessment_client_links (
  assessment_id uuid not null references assessments(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  link_source text not null check (link_source in ('pdf_request', 'booking', 'coach_manual', 'client_invite')),
  legal_basis text not null,
  linked_at timestamptz not null default now(),
  verified_at timestamptz,
  primary key (assessment_id, client_id, link_source)
);

create table pdf_requests (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  email text not null,
  requested_at timestamptz not null default now(),
  delivery_consent boolean not null default true,
  marketing_consent boolean not null default false,     -- never set by a PDF request
  delivery_state text not null default 'queued' check (delivery_state in ('queued', 'sent', 'delivered', 'bounced', 'failed')),
  provider text not null default 'resend',
  provider_message_id text,
  retry_count int not null default 0,
  last_error text
);
create index on pdf_requests (assessment_id);

-- ── Booking ─────────────────────────────────────────────────────────────────
-- Pending association created server-side before redirecting to the scheduler.
create table booking_link_tokens (
  token_hash text primary key,                          -- sha256 of the signed one-time token
  assessment_id uuid not null references assessments(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references assessments(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  provider text not null,                               -- 'calendly'
  provider_event_id text not null,                      -- scheduled event URI
  provider_invitee_id text not null unique,             -- invitee URI
  session_type text not null default 'life_map_deep_dive',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  timezone text,
  meeting_url text,
  booking_state text not null check (booking_state in ('pending', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show')),
  booked_name text,
  booked_email text,
  intake_answers jsonb,
  payment_reference text,
  payment_state text not null default 'unknown' check (payment_state in ('unknown', 'not_required', 'pending', 'paid', 'failed', 'refunded')),
  rescheduled_from uuid references bookings(id),
  needs_reconciliation boolean not null default false,  -- unmatched or anomalous event: manual review
  reconciliation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on bookings (assessment_id);
create index on bookings (needs_reconciliation) where needs_reconciliation;

create table booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete set null,
  provider_event_id text,
  webhook_event_id text not null,
  event_type text not null,
  idempotency_key text not null unique,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  payload jsonb,                                        -- raw payload, pruned by retention job
  payload_expires_at timestamptz not null default now() + interval '90 days'
);

-- ── Coach material ──────────────────────────────────────────────────────────
create table coach_reports (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  content jsonb not null,
  evidence_refs jsonb not null,
  template_version text not null,
  review_state text not null default 'unreviewed' check (review_state in ('unreviewed', 'in_review', 'reviewed')),
  kind text not null default 'generated' check (kind in ('generated', 'coach_edited')),   -- the generated original is never overwritten
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- After the Deep Dive: which interpretations the person confirmed, clarified or challenged ("the conversation reveals the person")
create table interpretation_validations (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  insight_id text not null,
  insight_title text not null,
  status text not null check (status in ('confirmed', 'clarified', 'challenged', 'not_discussed')),
  note_ciphertext text,                                 -- coach's note of what the person said, encrypted
  coach_id uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (assessment_id, insight_id)
);

-- Client Understanding & Coaching Direction: built from validated findings; foundation of a potential 1:1 program
create table understanding_documents (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  version int not null,
  kind text not null check (kind in ('generated', 'coach_edited')),
  content_ciphertext text not null,                     -- includes the person's own words from the session, encrypted
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (assessment_id, version)
);

create table session_scripts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  version int not null,
  kind text not null check (kind in ('generated', 'coach_edited')),
  content jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (assessment_id, version)
);

create table session_notes (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  coach_id uuid not null references auth.users(id),
  notes_ciphertext text not null,
  validated_findings jsonb,                             -- interpretation key → recognised / partly / no, supported / unclear / not
  agreed_next_steps jsonb,
  follow_up_status text not null default 'none' check (follow_up_status in ('none', 'planned', 'sent', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table consents (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('assessment', 'client')),
  subject_id uuid not null,
  consent_type text not null check (consent_type in ('pdf_delivery', 'booking_link', 'marketing', 'research')),
  notice_version text not null,
  status text not null check (status in ('granted', 'withdrawn')),
  source text not null,
  created_at timestamptz not null default now()
);

-- ── Client profiles: sessions, person notes, attachments (Oct 13) ────────────
-- All free text is encrypted at the application layer (FIELD_ENCRYPTION_KEY), like session notes.
create table coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  coach_id uuid not null references auth.users(id),
  session_date date,
  title text,
  kind text not null default 'coaching' check (kind in ('deep_dive', 'coaching', 'review', 'other')),
  assessment_id uuid references assessments(id) on delete set null,   -- the Map discussed, if any
  plan_ciphertext text,
  notes_ciphertext text,
  homework_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on coaching_sessions (client_id, session_date desc);

create table client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  coach_id uuid not null references auth.users(id),
  body_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on client_notes (client_id, created_at desc);

-- Files are encrypted by the server before upload to a private storage bucket; this table holds metadata only.
create table client_attachments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  session_id uuid references coaching_sessions(id) on delete cascade,
  note_id uuid references client_notes(id) on delete cascade,
  purpose text not null check (purpose in ('profile', 'note', 'session_plan', 'session_notes', 'homework')),
  filename text not null,
  content_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  storage_path text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on client_attachments (client_id, created_at desc);

create table audit_events (
  id bigserial primary key,
  actor_id uuid,                                        -- null = system/webhook
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb,                                       -- ids and states only, never answers or notes
  created_at timestamptz not null default now()
);

-- ── Admin list view (no answers, no notes) ──────────────────────────────────
create view admin_assessment_list with (security_invoker = true) as
select
  a.id as assessment_id, a.created_at, a.completed_at, a.status, a.sections_completed, a.assessment_version, a.last_activity_at,
  c.id as client_id, c.name as client_name, c.email as client_email, coalesce(c.coaching_enrolled, false) as coaching_enrolled, c.stage as client_stage,
  (select string_agg(distinct l.link_source, ',') from assessment_client_links l where l.assessment_id = a.id) as contact_source,
  (select p.delivery_state from pdf_requests p where p.assessment_id = a.id order by p.requested_at desc limit 1) as email_delivery_state,
  b.booking_state, b.scheduled_start, b.timezone, b.payment_state,
  (select r.generation_status from report_artifacts r where r.assessment_id = a.id and r.artifact_type = 'client_pdf' order by r.version desc limit 1) as report_status,
  (select cr.review_state from coach_reports cr where cr.assessment_id = a.id order by cr.created_at desc limit 1) as coach_review_state,
  (select n.follow_up_status from session_notes n where n.assessment_id = a.id order by n.updated_at desc limit 1) as follow_up_status
from assessments a
left join lateral (
  select cl.* from assessment_client_links l join clients cl on cl.id = l.client_id
  where l.assessment_id = a.id order by (cl.merged_into_client_id is null) desc, l.linked_at desc limit 1
) c on true
left join lateral (
  select * from bookings bk where bk.assessment_id = a.id order by bk.created_at desc limit 1
) b on true
where a.status <> 'deleted';

-- Client profiles list: one row per profile (duplicates folded in by the coach are hidden)
create view admin_client_list with (security_invoker = true) as
select
  c.id as client_id, c.name, c.email, c.stage, c.stage_changed_at, c.created_at,
  (select count(distinct l.assessment_id)::int from assessment_client_links l join assessments a on a.id = l.assessment_id
     where l.client_id = c.id and a.status <> 'deleted') as maps,
  (select max(coalesce(a.completed_at, a.created_at)) from assessment_client_links l join assessments a on a.id = l.assessment_id
     where l.client_id = c.id and a.status <> 'deleted') as last_map_at,
  (select count(*)::int from coaching_sessions s where s.client_id = c.id) as sessions,
  (select min(s.session_date) from coaching_sessions s where s.client_id = c.id and s.session_date >= current_date) as next_session,
  (select max(s.session_date) from coaching_sessions s where s.client_id = c.id and s.session_date < current_date) as last_session
from clients c
where c.merged_into_client_id is null and c.privacy_status <> 'deleted';

-- ── Row Level Security ──────────────────────────────────────────────────────
create or replace function is_coach_mfa() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from coach_users where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- Export and deletion are restricted to the admin role (least privilege)
create or replace function is_admin_mfa() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from coach_users where user_id = auth.uid() and role = 'admin')
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

do $$
declare t text;
begin
  foreach t in array array['coach_users','assessments','assessment_answers','assessment_results','report_artifacts','clients',
    'assessment_client_links','pdf_requests','booking_link_tokens','bookings','booking_events','coach_reports','session_scripts',
    'session_notes','consents','audit_events','interpretation_validations','understanding_documents',
    'coaching_sessions','client_notes','client_attachments']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- Coaches (with MFA) may read everything except raw webhook tokens
do $$
declare t text;
begin
  foreach t in array array['assessments','assessment_answers','assessment_results','report_artifacts','clients',
    'assessment_client_links','pdf_requests','bookings','booking_events','coach_reports','session_scripts','session_notes','consents','audit_events',
    'interpretation_validations','understanding_documents','coaching_sessions','client_notes','client_attachments']
  loop
    execute format('create policy coach_read on %I for select to authenticated using (is_coach_mfa())', t);
  end loop;
end $$;

-- Coaches may write their own workspace
create policy coach_write_scripts on session_scripts for insert to authenticated with check (is_coach_mfa() and kind = 'coach_edited' and created_by = auth.uid());
create policy coach_write_notes on session_notes for all to authenticated using (is_coach_mfa() and coach_id = auth.uid()) with check (is_coach_mfa() and coach_id = auth.uid());
create policy coach_update_bookings on bookings for update to authenticated using (is_coach_mfa()) with check (is_coach_mfa());
-- Manual reconciliation: a coach may create a client from booking details and link it (source coach_manual)
create policy coach_insert_clients on clients for insert to authenticated with check (is_coach_mfa());
-- A coach may correct or add a display name (never email merging)
create policy coach_update_clients on clients for update to authenticated using (is_coach_mfa()) with check (is_coach_mfa());
create policy coach_insert_links on assessment_client_links for insert to authenticated with check (is_coach_mfa() and link_source = 'coach_manual');
-- Client profiles: any coach (with MFA) maintains sessions, person notes and attachment records; authorship is enforced
create policy coach_insert_sessions on coaching_sessions for insert to authenticated with check (is_coach_mfa() and coach_id = auth.uid());
create policy coach_update_sessions on coaching_sessions for update to authenticated using (is_coach_mfa()) with check (is_coach_mfa());
create policy coach_delete_sessions on coaching_sessions for delete to authenticated using (is_coach_mfa());
create policy coach_insert_client_notes on client_notes for insert to authenticated with check (is_coach_mfa() and coach_id = auth.uid());
create policy coach_update_client_notes on client_notes for update to authenticated using (is_coach_mfa()) with check (is_coach_mfa());
create policy coach_delete_client_notes on client_notes for delete to authenticated using (is_coach_mfa());
create policy coach_insert_attachments on client_attachments for insert to authenticated with check (is_coach_mfa() and created_by = auth.uid());
create policy coach_delete_attachments on client_attachments for delete to authenticated using (is_coach_mfa());
create policy coach_update_reviews on coach_reports for update to authenticated using (is_coach_mfa()) with check (is_coach_mfa());
create policy coach_write_report_versions on coach_reports for insert to authenticated with check (is_coach_mfa() and kind = 'coach_edited' and created_by = auth.uid());
create policy coach_write_validations on interpretation_validations for all to authenticated using (is_coach_mfa()) with check (is_coach_mfa() and coach_id = auth.uid());
create policy coach_write_understanding on understanding_documents for insert to authenticated with check (is_coach_mfa() and created_by = auth.uid());
create policy coach_write_artifacts on report_artifacts for insert to authenticated with check (is_coach_mfa() and artifact_type = 'client_understanding');
create policy coach_audit_insert on audit_events for insert to authenticated with check (is_coach_mfa() and actor_id = auth.uid());
create policy coach_self on coach_users for select to authenticated using (user_id = auth.uid());
-- No policies for anon: the public role can neither read nor write any table.

-- ── Retention helpers (schedule with pg_cron) ───────────────────────────────
create or replace function prune_booking_payloads() returns void language sql security definer set search_path = public as $$
  update booking_events set payload = null where payload is not null and payload_expires_at < now();
$$;
create or replace function delete_assessment(p_assessment uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'not authorised'; end if;
  insert into audit_events (actor_id, action, target_type, target_id) values (auth.uid(), 'assessment.delete', 'assessment', p_assessment::text);
  -- clients linked only to this assessment are removed too; clients linked to other assessments are kept
  create temp table _orphans on commit drop as
    select l.client_id from assessment_client_links l join clients c on c.id = l.client_id where l.assessment_id = p_assessment
    and not exists (select 1 from assessment_client_links o where o.client_id = l.client_id and o.assessment_id <> p_assessment)
    -- a profile Jana is working with (Lead/Client, sessions, notes, files) is never removed with one assessment
    and c.stage = 'prospect'
    and not exists (select 1 from coaching_sessions s where s.client_id = c.id)
    and not exists (select 1 from client_notes n where n.client_id = c.id)
    and not exists (select 1 from client_attachments f where f.client_id = c.id);
  delete from consents where subject_type = 'assessment' and subject_id = p_assessment;
  delete from booking_events where booking_id in (select id from bookings where assessment_id = p_assessment);
  delete from bookings where assessment_id = p_assessment;
  delete from assessments where id = p_assessment;   -- cascades to answers, results, artifacts, pdf requests, scripts, notes, links
  delete from consents where subject_type = 'client' and subject_id in (select client_id from _orphans);
  delete from clients where id in (select client_id from _orphans);
end $$;

-- Delete a whole client profile (admin, MFA). Assessments stay (they may be deleted separately); links, sessions,
-- notes and attachment records cascade. The server removes the stored files first (see server/admin/clients.ts).
create or replace function delete_client(p_client uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'not authorised'; end if;
  insert into audit_events (actor_id, action, target_type, target_id) values (auth.uid(), 'client.delete', 'client', p_client::text);
  update clients set merged_into_client_id = null where merged_into_client_id = p_client;
  delete from consents where subject_type = 'client' and subject_id = p_client;
  delete from clients where id = p_client;
end $$;
