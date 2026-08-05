-- Local single-user tool: no auth yet, so open up CRUD to anon/authenticated.
-- Revisit with RLS once this ships as a real multi-device webapp.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant select on entries_view to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
