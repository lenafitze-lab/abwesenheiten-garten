-- Web-Push-Benachrichtigungen: Subscriptions pro Gerät plus Trigger, die
-- bei Abmeldungen und Termin-Änderungen die Edge Function "send-push"
-- aufrufen. Empfänger*innen und Texte bestimmt die Function
-- (supabase/functions/send-push/push-logik.ts), nicht die Datenbank.
--
-- Einmalig von Hand einzurichten (NICHT im Repo, da projekt-/geheim-
-- spezifisch), im Supabase SQL Editor:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret('<zufälliges Geheimnis>', 'push_webhook_secret');
-- Solange die beiden Secrets fehlen, überspringen die Trigger den Versand
-- still, die eigentliche Änderung klappt trotzdem.

create extension if not exists pg_net with schema extensions;

-- ============ push_subscriptions ============
-- Eine Zeile pro Browser/Gerät. "endpoint" ist die vom Browser vergebene,
-- weltweit eindeutige Push-Adresse. Beim Löschen des Accounts verschwinden
-- die Subscriptions per CASCADE mit.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "Eigene Push-Subscriptions sichtbar"
on push_subscriptions for select
using (user_id = auth.uid());

create policy "Eigene Push-Subscription anlegen"
on push_subscriptions for insert
with check (user_id = auth.uid());

create policy "Eigene Push-Subscription löschen"
on push_subscriptions for delete
using (user_id = auth.uid());

-- Speichert die Subscription des aktuellen Geräts für die angemeldete
-- Person. Meldet sich auf demselben Browser eine andere Person an, gehört
-- der Endpoint danach ihr - deren alte Zeile ist per RLS aber unsichtbar,
-- deshalb als security definer statt eines einfachen upsert im Frontend.
create or replace function public.push_subscription_speichern(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;

  delete from push_subscriptions where endpoint = p_endpoint and user_id <> auth.uid();

  insert into push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

revoke execute on function public.push_subscription_speichern(text, text, text) from public, anon;
grant execute on function public.push_subscription_speichern(text, text, text) to authenticated;

-- ============ Aufruf der Edge Function ============
-- pg_net verschickt den Request asynchron nach dem Commit, die auslösende
-- Änderung wird dadurch nicht verlangsamt.
create or replace function public.push_ausloesen(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  function_url text;
  geheimnis text;
begin
  select decrypted_secret into function_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into geheimnis from vault.decrypted_secrets where name = 'push_webhook_secret';
  if function_url is null or geheimnis is null then
    return;
  end if;

  perform net.http_post(
    url := function_url,
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', geheimnis)
  );
end;
$$;

-- Nur für die Trigger gedacht - sonst könnte jede*r über die API beliebige
-- Push-Aufrufe auslösen.
revoke execute on function public.push_ausloesen(jsonb) from public, anon, authenticated;

-- ============ Abmeldungen ============
-- Nur beim Wechsel auf "abwesend". Der Grund wird bewusst NICHT mitgeschickt.
create or replace function public.push_abwesenheiten()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from 'abwesend' then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from 'abwesend' then
    return null;
  end if;

  perform public.push_ausloesen(jsonb_build_object(
    'tabelle', 'abwesenheiten',
    'operation', tg_op,
    'record', jsonb_build_object(
      'event_id', new.event_id,
      'profile_id', new.profile_id,
      'kind_profile_id', new.kind_profile_id
    ),
    'old_record', null,
    'ausloeser_id', auth.uid()
  ));
  return null;
end;
$$;

create trigger push_abwesenheiten
after insert or update of status on abwesenheiten
for each row execute function public.push_abwesenheiten();

-- ============ Trainings/Anlässe ============
-- Eine Serie besteht aus einer Basiszeile (ist_dauerauftrag = true) und
-- Wochen-Instanzen (ausnahme_von_id = Basis); ein mehrtägiger Anlass analog
-- aus Eltern-Zeile und Tages-Instanzen. Damit eine Serien-Aktion genau EINE
-- Nachricht auslöst:
--   * Inserts von Instanzen werden nie gemeldet (sie entstehen beim
--     Anlegen eines mehrtägigen Anlasses bzw. beim laufenden Nachziehen
--     neuer Wochen durch die App).
--   * Jede Änderung an einer Basiszeile setzt eine kurze Sperre. Die App
--     ändert bei "Serie bearbeiten/löschen" zuerst die Basiszeile und erst
--     danach die Instanzen - deren Änderungen fallen so in die Sperre.
create table push_serien_sperre (
  basis_id uuid primary key,
  gesperrt_bis timestamptz not null
);

-- Nur die Trigger-Funktion (security definer) greift darauf zu.
alter table push_serien_sperre enable row level security;

create or replace function public.push_trainings_anlaesse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  zeile trainings_anlaesse;
begin
  if tg_op = 'DELETE' then
    zeile := old;
  else
    zeile := new;
  end if;

  if zeile.ausnahme_von_id is null then
    if tg_op <> 'INSERT' then
      delete from push_serien_sperre where gesperrt_bis < now() - interval '1 day';
      insert into push_serien_sperre (basis_id, gesperrt_bis)
      values (zeile.id, now() + interval '2 minutes')
      on conflict (basis_id) do update set gesperrt_bis = excluded.gesperrt_bis;
    end if;
  else
    if tg_op = 'INSERT' then
      return null;
    end if;
    if exists (
      select 1 from push_serien_sperre
      where basis_id = zeile.ausnahme_von_id and gesperrt_bis > now()
    ) then
      return null;
    end if;
  end if;

  perform public.push_ausloesen(jsonb_build_object(
    'tabelle', 'trainings_anlaesse',
    'operation', tg_op,
    'record', case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    'old_record', case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    'ausloeser_id', auth.uid()
  ));
  return null;
end;
$$;

create trigger push_trainings_anlaesse
after insert or update or delete on trainings_anlaesse
for each row execute function public.push_trainings_anlaesse();
