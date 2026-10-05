-- Erweitert "abwesenheiten" um erwachsene Teilnehmende (Volti/Trainer),
-- die kein kind_profile haben, sondern direkt ein profiles-Konto sind.
alter table abwesenheiten
  add column profile_id uuid references profiles(id) on delete cascade;

-- Eine Abwesenheits-Zeile gehört entweder zu einem Kind ODER zu einem
-- erwachsenen Profil, nie zu beidem/keinem.
alter table abwesenheiten
  add constraint abwesenheiten_teilnehmer_check
  check ((kind_profile_id is not null)::int + (profile_id is not null)::int = 1);

-- Pro Event darf jede erwachsene Person höchstens eine Zeile haben
-- (ermöglicht ein sauberes upsert beim Setzen des eigenen Status).
create unique index abwesenheiten_event_profile_unique
  on abwesenheiten (event_id, profile_id)
  where profile_id is not null;

-- ============ Alte Policies aus 0002 ersetzen ============
-- Neue Regeln: Eltern haben KEIN Schreibrecht mehr auf Abwesenheiten;
-- Volti dürfen nur die eigene Zeile schreiben; Trainer dürfen alles in
-- der eigenen Gruppe schreiben. Lesen läuft für Nicht-Trainer nur noch
-- über die View "abwesenheiten_public" (maskiert private Gründe).
drop policy if exists "Trainer/Volti sehen Abwesenheiten der Gruppe" on abwesenheiten;
drop policy if exists "Eltern sehen Abwesenheiten der eigenen Kinder" on abwesenheiten;
drop policy if exists "Eltern melden Abwesenheit der eigenen Kinder" on abwesenheiten;
drop policy if exists "Trainer/Volti melden Abwesenheit in der Gruppe" on abwesenheiten;
drop policy if exists "Eltern bearbeiten Abwesenheit der eigenen Kinder" on abwesenheiten;
drop policy if exists "Trainer/Volti bearbeiten Abwesenheit in der Gruppe" on abwesenheiten;

create policy "Trainer sehen Abwesenheiten der Gruppe (Basistabelle)"
on abwesenheiten for select
using (
  public.current_profile_rolle() = 'trainer'
  and event_id in (select id from trainings_anlaesse where gruppe_id = public.current_profile_gruppe())
);

-- Nötig, damit Realtime (postgres_changes) Volti/Eltern überhaupt
-- Änderungen ihrer Gruppe zustellt. Der echte "grund" bei privaten
-- Einträgen bleibt dadurch technisch im Realtime-Payload sichtbar (siehe
-- Migrationskommentar/Chat) - die App blendet ihn clientseitig zusätzlich
-- aus, für echte Spalten-Sicherheit bräuchte es stattdessen Broadcast.
create policy "Gruppenmitglieder sehen Abwesenheiten für Realtime"
on abwesenheiten for select
using (
  public.current_profile_rolle() in ('volti', 'eltern')
  and event_id in (select id from trainings_anlaesse where gruppe_id = public.current_profile_gruppe())
);

create policy "Volti meldet eigene Abwesenheit (insert)"
on abwesenheiten for insert
with check (
  public.current_profile_rolle() = 'volti'
  and profile_id = auth.uid()
  and event_id in (select id from trainings_anlaesse where gruppe_id = public.current_profile_gruppe())
);

create policy "Volti bearbeitet eigene Abwesenheit (update)"
on abwesenheiten for update
using (
  public.current_profile_rolle() = 'volti'
  and profile_id = auth.uid()
);

create policy "Trainer meldet Abwesenheit in der Gruppe (insert)"
on abwesenheiten for insert
with check (
  public.current_profile_rolle() = 'trainer'
  and event_id in (select id from trainings_anlaesse where gruppe_id = public.current_profile_gruppe())
);

create policy "Trainer bearbeitet Abwesenheit in der Gruppe (update)"
on abwesenheiten for update
using (
  public.current_profile_rolle() = 'trainer'
  and event_id in (select id from trainings_anlaesse where gruppe_id = public.current_profile_gruppe())
);

-- ============ View mit Grund-Maskierung ============
-- Läuft mit den Rechten der Besitzerin (kein "security_invoker"), damit
-- sie unabhängig von den oben stark eingeschränkten Basistabellen-Policies
-- lesen kann. Die Sichtbarkeit wird stattdessen direkt in der View-Query
-- nachgebildet: Trainer sehen den echten Grund immer, alle anderen nur
-- wenn der Eintrag nicht privat ist - ausnahmslos, auch fürs eigene Kind.
create view abwesenheiten_public as
select
  a.id,
  a.event_id,
  a.kind_profile_id,
  a.profile_id,
  a.status,
  case
    when public.current_profile_rolle() = 'trainer' then a.grund
    when a.ist_privat then null
    else a.grund
  end as grund,
  a.ist_privat,
  a.gemeldet_von,
  a.timestamp
from abwesenheiten a
join trainings_anlaesse t on t.id = a.event_id
where t.gruppe_id = public.current_profile_gruppe();

grant select on abwesenheiten_public to authenticated;
