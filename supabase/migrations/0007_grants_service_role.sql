-- 0007_grants_service_role.sql
-- service_role bypasses RLS but still needs SCHEMA USAGE + table privileges.
-- The default Supabase roles (anon, authenticated, service_role) all need
-- explicit grants to read/write a non-public schema like `family`.

grant usage on schema family to service_role, postgres, authenticator;

grant all on all tables in schema family to service_role, postgres;
grant all on all sequences in schema family to service_role, postgres;
grant execute on all functions in schema family to service_role, postgres;

alter default privileges in schema family
  grant all on tables to service_role, postgres;
alter default privileges in schema family
  grant all on sequences to service_role, postgres;
alter default privileges in schema family
  grant execute on functions to service_role, postgres;
