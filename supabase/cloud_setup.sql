-- Rec Stats: recruitment daily submissions/interviews tracker

create type submitter_type as enum ('recruiter', 'vendor');
create type submitter_status as enum ('active', 'inactive');
create type role_status as enum ('open', 'closed', 'on_hold');

create table submitters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type submitter_type not null,
  status submitter_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  unique (name, type)
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  client text,
  status role_status not null default 'open',
  created_at timestamptz not null default now()
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  submitter_id uuid not null references submitters(id) on delete restrict,
  role_id uuid not null references roles(id) on delete restrict,
  submissions int not null default 0,
  interview_stage text,
  notes text,
  created_at timestamptz not null default now(),
  unique (date, submitter_id, role_id)
);

create index entries_date_idx on entries(date);
create index entries_submitter_idx on entries(submitter_id);
create index entries_role_idx on entries(role_id);

-- Convenience view: per-entry interview flag (1 if a stage was recorded)
create view entries_view as
select
  e.id,
  e.date,
  e.submissions,
  e.interview_stage,
  (case when e.interview_stage is not null and e.interview_stage <> '' then 1 else 0 end) as interviews,
  e.notes,
  s.id as submitter_id,
  s.name as submitter_name,
  s.type as submitter_type,
  r.id as role_id,
  r.name as role_name
from entries e
join submitters s on s.id = e.submitter_id
join roles r on r.id = e.role_id;
-- Local single-user tool: no auth yet, so open up CRUD to anon/authenticated.
-- Revisit with RLS once this ships as a real multi-device webapp.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant select on entries_view to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
-- v2: L1/L2/L3 interview breakdown, deal-recruiter attribution, richer role status

drop view if exists entries_view;

-- interviews: split single stage text into L1/L2/L3 counts
alter table entries drop column if exists interview_stage;
alter table entries add column interview_l1 int not null default 0;
alter table entries add column interview_l2 int not null default 0;
alter table entries add column interview_l3 int not null default 0;

-- deal attribution: which recruiter's deal this submission counts toward.
-- Kept separate from submitter_id so a vendor's submission can be credited
-- to a recruiter's deal without inflating that recruiter's own self-submitted count.
alter table entries add column deal_recruiter_id uuid references submitters(id) on delete set null;
create index entries_deal_recruiter_idx on entries(deal_recruiter_id);

-- role status: open -> on_hold | cancelled | deal (won) | lost
alter type role_status rename to role_status_old;
create type role_status as enum ('open', 'on_hold', 'cancelled', 'deal', 'lost');

alter table roles alter column status drop default;
alter table roles
  alter column status type role_status
  using (
    case status::text
      when 'closed' then 'deal'
      else status::text
    end
  )::role_status;
alter table roles alter column status set default 'open';

drop type role_status_old;

create view entries_view as
select
  e.id,
  e.date,
  e.submissions,
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
