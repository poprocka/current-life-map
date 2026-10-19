-- Retention (Jana, 19 Oct): unfinished Self-Interviews are deleted after 90 days without activity.
-- Completed ones are kept until the person asks for deletion. Anything linked to a person (a PDF request, a booking or
-- a client profile) is never removed by this job; Jana handles those by hand.
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
    returning a.id
  )
  select count(*) into n from gone;
  if n > 0 then
    insert into audit_events (actor_id, action, target_type, target_id, metadata)
    values (null, 'retention.purge_unfinished', 'assessment', 'batch', jsonb_build_object('count', n, 'days', greatest(p_days, 30)));
  end if;
  return n;
end $$;
-- Only the server's own database connection may run it; never the browser roles.
revoke all on function purge_abandoned_assessments(int) from public, anon, authenticated;
