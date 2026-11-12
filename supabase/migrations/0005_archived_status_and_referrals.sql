-- Archived role status (for clients/engagements we're no longer working,
-- without overloading "cancelled"/"lost" which mean the deal fell through)
-- plus a referral-submission counter that's tracked but excluded from
-- every stats calculation (conversion rates, deal ratios, reports, etc.)
-- since referrals come from employees, not recruiter/vendor sourcing.

alter type role_status add value if not exists 'archived';

alter table entries add column referral_subs int not null default 0;

drop view if exists entries_view;

create view entries_view as
select
  e.id,
  e.date,
  e.submissions,
  e.referral_subs,
  e.interview_l1,
  e.interview_l2,
  e.interview_l3,
  (e.interview_l1 + e.interview_l2 + e.interview_l3) as interviews,
  e.notes,
  s.id as submitter_id,
  s.name as submitter_name,
  s.type as submitter_type,
  r.id as role_id,
  r.name as role_name,
  e.deal_recruiter_id,
  d.name as deal_recruiter_name
from entries e
join submitters s on s.id = e.submitter_id
join roles r on r.id = e.role_id
left join submitters d on d.id = e.deal_recruiter_id;

grant select on entries_view to anon, authenticated;
