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
