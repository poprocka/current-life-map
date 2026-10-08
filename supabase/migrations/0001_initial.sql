-- Current Life Map — initial schema
-- Principles:
--  * Raw answers, derived metrics and interpretations live in separate tables.
--  * Anonymous research records (maps) are separate from identified clients.
--  * RLS is enabled on every table. The public site never talks to the DB directly:
--    all writes go through server routes using the service role. Only authenticated
--    coach accounts (coach_users) can read, via policies below.

create extension if not exists pgcrypto;

-- Versioned content & methodology -------------------------------------------
create table content_versions (
  id text primary key,                    -- 'v10'
  question_bank jsonb not null,           -- full snapshot of the bank at publish time
  published_at timestamptz not null default now()
);

create table engine_configs (
  id text primary key,                    -- 'v10-provisional-2026-10-08'
  content_version text not null references content_versions(id),
  status text not null check (status in ('proposed','approved')),
  config jsonb not null,
  created_at timestamptz not null default now()
);

-- Identified clients (only created via Deep Dive booking or coach entry) -----
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  stage text not null default 'booked' check (stage in ('booked','deep_dive_done','one_to_one','alumni')),
  created_at timestamptz not null default now(),
  unique (email)
);

-- Anonymous assessment records ---------------------------------------------
create table maps (
  id uuid primary key default gen_random_uuid(),
  -- opaque, unguessable token used in URLs and booking links; never the PK
  token text not null unique default encode(gen_random_bytes(24), 'base64url'),
  content_version text not null references content_versions(id),
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  client_id uuid references clients(id) on delete set null,   -- null = anonymous
  previous_map_id uuid references maps(id),                     -- reassessment chain
  research_consent boolean not null default true,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index on maps (client_id);

-- Raw answers — exactly what the respondent chose -------------------------
create table responses (
  map_id uuid not null references maps(id) on delete cascade,
  question_id text not null,
  content_version text not null,
  value jsonb not null,                    -- string or string[]
  answered_at timestamptz not null default now(),
  primary key (map_id, question_id)
);

-- Free-text reflections — sensitive; encrypted at the application layer ----
create table reflections (
  map_id uuid not null references maps(id) on delete cascade,
  chapter_id text not null,
  ciphertext text not null,                -- AES-GCM via REFLECTION_ENCRYPTION_KEY
  created_at timestamptz not null default now(),
  primary key (map_id, chapter_id)
);

-- Derived metrics — reproducible from responses + engine config ------------
create table derived_metrics (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps(id) on delete cascade,
  engine_config_id text not null references engine_configs(id),
  result jsonb not null,
  computed_at timestamptz not null default now(),
  unique (map_id, engine_config_id)
);

-- Report deliveries — email kept only as long as the privacy notice says -----
create table report_deliveries (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps(id) on delete cascade,
  email text not null,
  provider text not null,                  -- 'resend'
  provider_message_id text,                -- set only after the provider accepts it
  status text not null check (status in ('queued','sent','failed')),
  error text,
  created_at timestamptz not null default now(),
  delete_email_after timestamptz not null default now() + interval '30 days'
);

-- Bookings — linked to a map only via verified webhook ---------------------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  map_id uuid references maps(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  provider text not null,                  -- 'calendly'
  provider_event_id text not null unique,
  starts_at timestamptz,
  status text not null check (status in ('scheduled','canceled','completed','no_show')),
  raw jsonb not null,
  created_at timestamptz not null default now()
);

-- Coach workspace ----------------------------------------------------------
create table coach_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'coach'
);

create table coach_reviews (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps(id) on delete cascade,
  interpretation_key text not null,        -- e.g. 'snapshot.energyOut', 'hypothesis.3'
  client_recognition text check (client_recognition in ('yes','partly','no')),
  coach_support text check (coach_support in ('supported','unclear','not_supported')),
  note text,
  updated_at timestamptz not null default now(),
  unique (map_id, interpretation_key)
);

create table session_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  map_id uuid references maps(id),
  kind text not null check (kind in ('deep_dive','one_to_one','reassessment')),
  ciphertext text not null,
  held_at timestamptz,
  created_at timestamptz not null default now()
);

-- Row Level Security -------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['content_versions','engine_configs','clients','maps','responses','reflections',
    'derived_metrics','report_deliveries','bookings','coach_users','coach_reviews','session_notes']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

create or replace function is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from coach_users where user_id = auth.uid());
$$;

-- Coaches may read everything and write their own workspace tables.
-- No policies exist for the anon role: the public site cannot read or write directly.
do $$
declare t text;
begin
  foreach t in array array['content_versions','engine_configs','clients','maps','responses','reflections',
    'derived_metrics','report_deliveries','bookings','coach_reviews','session_notes']
  loop
    execute format('create policy coach_read on %I for select to authenticated using (is_coach())', t);
  end loop;
  foreach t in array array['coach_reviews','session_notes','clients']
  loop
    execute format('create policy coach_write on %I for all to authenticated using (is_coach()) with check (is_coach())', t);
  end loop;
end $$;

create policy coach_self on coach_users for select to authenticated using (user_id = auth.uid());

-- Retention: purge delivery emails past their window (schedule with pg_cron).
create or replace function purge_expired_report_emails() returns void
language sql security definer set search_path = public as $$
  update report_deliveries set email = '[deleted]' where delete_email_after < now() and email <> '[deleted]';
$$;
