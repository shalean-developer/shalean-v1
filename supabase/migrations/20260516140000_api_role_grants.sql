-- PostgREST API roles must have schema/table privileges on hosted Supabase projects.
-- Without these grants, service_role JWTs authenticate but queries return "permission denied".

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon;
alter default privileges in schema public
  grant all on tables to postgres, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
