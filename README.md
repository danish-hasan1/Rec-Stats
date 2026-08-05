# Rec Stats

Daily recruitment submissions & interviews tracker. Replaces the manual
`Recruitment_Tracker_Daily.xlsx` workflow with an entry + dashboard tool.

## Stack

Next.js (App Router) + TypeScript, Tailwind + shadcn/ui (glassmorphism theme),
Supabase Postgres (local for now via Supabase CLI, cloud later), Recharts.

## Running locally

Docker must be running (Supabase's local stack runs in containers).

```bash
supabase start   # first time / after a machine restart
npm run dev
```

Open http://localhost:3000.

`supabase start` prints an `ANON_KEY` — if it ever changes, update it in
`.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

To stop the local database: `supabase stop`.

## Pages

- **Dashboard** (`/`) — today/yesterday/week/month KPIs, trend chart, by-recruiter and by-role breakdowns (self-submitted vs. deal-attributed vendor subs, L1/L2/L3 interviews).
- **Daily Entry** (`/entry`) — manual form: date, recruiter/vendor, role, submissions, L1/L2/L3 interviews, and (for vendor rows) which recruiter's deal it counts toward.
- **Paste Import** (`/import`) — paste a tab-separated report (Source / Name / Role / Submissions / Interview), preview, confirm to bulk-import. Interview stage text (L1/L2/L3/Final) maps to the matching column.
- **Summary** (`/summary`) — per-submitter monthly rollup.
- **Reports** (`/reports`) — custom report builder: filter entries by date range, source (recruiter/vendor), role status, and a name/role search; preview, then download as an `.xlsx` file (via `exceljs`, generated client-side).
- **Admin** (`/admin`) — manage recruiters/vendors (active/inactive) and roles (open / on hold / cancelled / deal / lost). Marking an entry as a deal in Daily Entry also flips the role's status to "deal" automatically.

## Schema

See `supabase/migrations/`. Three tables: `submitters` (recruiter/vendor),
`roles`, `entries` (one row per date + submitter + role, with `interview_l1/l2/l3`
counts and an optional `deal_recruiter_id`). `entries_view` joins them for reads.

Deal attribution: a vendor's entry can be tagged with a `deal_recruiter_id` —
the recruiter whose deal that submission counts toward. This is tracked
separately from the vendor's own self-submitted count, so a recruiter's
"self subs" number never gets inflated by vendor volume; it shows up as a
distinct "deal vendor subs" figure instead.

## Known gaps / next steps

- No auth or RLS yet — fine for local single-user use; add both before
  deploying to Supabase cloud as a real webapp.
- Deploy: push this schema to a Supabase cloud project, then `vercel deploy`.
