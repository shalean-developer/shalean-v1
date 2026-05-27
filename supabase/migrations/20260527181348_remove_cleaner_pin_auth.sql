-- Cleaner authentication now uses Supabase Auth email/password only.
-- Retire the legacy phone/PIN credential store and custom cleaner sessions.

drop table if exists public.cleaner_login_attempts;
drop table if exists public.cleaner_sessions;
drop table if exists public.cleaner_credentials;
