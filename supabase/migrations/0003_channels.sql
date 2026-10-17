-- Acquisition channel (Jana, 17 Oct): which link brought someone in (Instagram, LinkedIn, QR card, …).
-- First-touch, stored with the anonymous assessment. Short slugs only; never personal data.
alter table assessments add column source text check (source ~ '^[a-z0-9_-]{1,40}$');
alter table assessments add column campaign text check (campaign ~ '^[a-z0-9_-]{1,40}$');
create index on assessments (source, created_at desc);

create or replace view admin_assessment_list with (security_invoker = true) as
select
  a.id as assessment_id, a.created_at, a.completed_at, a.status, a.sections_completed, a.assessment_version, a.last_activity_at,
  c.id as client_id, c.name as client_name, c.email as client_email, coalesce(c.coaching_enrolled, false) as coaching_enrolled, c.stage as client_stage,
  (select string_agg(distinct l.link_source, ',') from assessment_client_links l where l.assessment_id = a.id) as contact_source,
  (select p.delivery_state from pdf_requests p where p.assessment_id = a.id order by p.requested_at desc limit 1) as email_delivery_state,
  b.booking_state, b.scheduled_start, b.timezone, b.payment_state,
  (select r.generation_status from report_artifacts r where r.assessment_id = a.id and r.artifact_type = 'client_pdf' order by r.version desc limit 1) as report_status,
  (select cr.review_state from coach_reports cr where cr.assessment_id = a.id order by cr.created_at desc limit 1) as coach_review_state,
  (select n.follow_up_status from session_notes n where n.assessment_id = a.id order by n.updated_at desc limit 1) as follow_up_status,
  a.source, a.campaign
from assessments a
left join lateral (
  select cl.* from assessment_client_links l join clients cl on cl.id = l.client_id
  where l.assessment_id = a.id order by (cl.merged_into_client_id is null) desc, l.linked_at desc limit 1
) c on true
left join lateral (
  select * from bookings bk where bk.assessment_id = a.id order by bk.created_at desc limit 1
) b on true
where a.status <> 'deleted';
