-- Track which recruiter/vendor closed a deal.
alter table roles add column closed_by_id uuid references submitters(id) on delete set null;

create view roles_view as
select
  r.id,
  r.name,
  r.client,
  r.status,
  r.closed_by_id,
  s.name as closed_by_name,
  s.type as closed_by_type,
  r.created_at
from roles r
left join submitters s on s.id = r.closed_by_id;

grant select on roles_view to anon, authenticated;
