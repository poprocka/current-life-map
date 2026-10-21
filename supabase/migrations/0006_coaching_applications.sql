-- 1:1 coaching applications (Jana, 21 Oct). Replaces the paid Life Map Deep Dive as the next step after the Map:
-- the person applies (name, email, optional message), then schedules a complimentary introductory conversation.
-- Additive only: no existing rows, bookings or payment records are changed or removed.

create table if not exists coaching_applications (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references assessments(id) on delete set null,   -- the person's Self-Interview, when known
  client_id uuid references clients(id) on delete set null,           -- created from what they typed; never merged by email
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  message_ciphertext text,                                            -- optional message, encrypted by the app
  status text not null default 'submitted' check (status in ('submitted', 'scheduled', 'cancelled')),
  booking_id uuid references bookings(id) on delete set null,
  request_id uuid not null unique,                                    -- one application per form submission (no duplicates)
  source text not null default 'results' check (source in ('results', 'email', 'direct')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coaching_applications_assessment on coaching_applications (assessment_id);
create index if not exists coaching_applications_created on coaching_applications (created_at desc);

-- Coach access: read, and update the status; inserts come only from the server's own connection.
alter table coaching_applications enable row level security;
create policy coach_read on coaching_applications for select to authenticated using (is_coach_mfa());
create policy coach_update_applications on coaching_applications for update to authenticated using (is_coach_mfa()) with check (is_coach_mfa());
grant select, update on coaching_applications to authenticated;

-- A scheduling link can now come from an application, with or without a Self-Interview behind it.
alter table booking_link_tokens add column if not exists application_id uuid references coaching_applications(id) on delete set null;
alter table booking_link_tokens alter column assessment_id drop not null;

-- New allowed values
alter table assessment_client_links drop constraint if exists assessment_client_links_link_source_check;
alter table assessment_client_links add constraint assessment_client_links_link_source_check
  check (link_source in ('pdf_request', 'booking', 'coach_manual', 'client_invite', 'coaching_application'));
alter table consents drop constraint if exists consents_consent_type_check;
alter table consents add constraint consents_consent_type_check
  check (consent_type in ('pdf_delivery', 'booking_link', 'marketing', 'research', 'coaching_application'));

-- New bookings are complimentary introductory conversations; earlier rows keep 'life_map_deep_dive'.
alter table bookings alter column session_type set default 'intro_conversation';

-- Retention: an unfinished Self-Interview behind a coaching application is kept, like one behind a PDF request or booking.
create or replace function purge_abandoned_assessments(p_days int default 90) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with gone as (
    delete from assessments a
    where a.status = 'in_progress'
      and a.last_activity_at < now() - make_interval(days => greatest(p_days, 30))
      and not exists (select 1 from assessment_client_links l where l.assessment_id = a.id)
      and not exists (select 1 from bookings b where b.assessment_id = a.id)
      and not exists (select 1 from pdf_requests p where p.assessment_id = a.id)
      and not exists (select 1 from coaching_applications c where c.assessment_id = a.id)
    returning a.id
  )
  select count(*) into n from gone;
  if n > 0 then
    insert into audit_events (actor_id, action, target_type, target_id, metadata)
    values (null, 'retention.purge_unfinished', 'assessment', 'batch', jsonb_build_object('count', n, 'days', greatest(p_days, 30)));
  end if;
  return n;
end $$;
revoke all on function purge_abandoned_assessments(int) from public, anon, authenticated;

-- Deletion: removing a Self-Interview or a client profile also removes the coaching applications behind it
-- (name, email and message), so a deletion request covers them.
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
  delete from coaching_applications where assessment_id = p_assessment;
  delete from bookings where assessment_id = p_assessment;
  delete from assessments where id = p_assessment;   -- cascades to answers, results, artifacts, pdf requests, scripts, notes, links
  delete from consents where subject_type = 'client' and subject_id in (select client_id from _orphans);
  delete from clients where id in (select client_id from _orphans);
end $$;

create or replace function delete_client(p_client uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'not authorised'; end if;
  insert into audit_events (actor_id, action, target_type, target_id) values (auth.uid(), 'client.delete', 'client', p_client::text);
  update clients set merged_into_client_id = null where merged_into_client_id = p_client;
  delete from consents where subject_type = 'client' and subject_id = p_client;
  delete from coaching_applications where client_id = p_client;
  delete from clients where id = p_client;
end $$;
