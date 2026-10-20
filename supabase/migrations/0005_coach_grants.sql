-- Coach access (20 Oct). The project was created with "Automatically expose new tables" off, so Postgres gives the
-- signed-in coach role ("authenticated") no table rights by default. The coach portal runs its queries under that
-- role, so it needs them, while row-level security (RLS) still decides which rows it may see or change.
-- Nothing is granted to "anon": the public Self-Interview runs through the server's own connection, never as anon.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- the retention job stays server-only
revoke all on function purge_abandoned_assessments(int) from public, anon, authenticated;
-- tables added by later migrations get the same rights automatically
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
