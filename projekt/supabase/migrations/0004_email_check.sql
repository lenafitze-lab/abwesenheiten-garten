-- Erlaubt der Registrierungsseite zu prüfen, ob eine E-Mail-Adresse bereits
-- registriert ist, ohne dass das Frontend direkten Zugriff auf auth.users
-- braucht (dort stehen Passwort-Hashes etc.). Gibt bewusst nur ein
-- Ja/Nein zurück, keine weiteren Nutzerdaten.
create or replace function public.email_ist_registriert(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(trim(p_email))
  );
$$;

grant execute on function public.email_ist_registriert(text) to anon, authenticated;
