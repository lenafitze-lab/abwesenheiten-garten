-- Row-Level-Security aktivieren
alter table gruppen enable row level security;
alter table profiles enable row level security;
alter table kind_profile enable row level security;
alter table trainings_anlaesse enable row level security;
alter table abwesenheiten enable row level security;
alter table packliste_items enable row level security;

-- Hilfsfunktionen: laufen als "security definer", damit sie beim Lesen der
-- eigenen profiles-Zeile nicht selbst wieder RLS auslösen (sonst Rekursion).
create or replace function public.current_profile_rolle()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select rolle from profiles where id = auth.uid();
$$;

create or replace function public.current_profile_gruppe()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select gruppe_id from profiles where id = auth.uid();
$$;

-- ============ gruppen ============
-- Öffentlich lesbar (auch ohne Login): die Registrierung muss die
-- Gruppen-ID nachschlagen können, bevor der Account überhaupt existiert.
-- Enthält nur Gruppennamen, keine sensiblen Daten.
create policy "Gruppen öffentlich sichtbar"
on gruppen for select
using (true);

-- ============ profiles ============
create policy "Eigenes Profil sichtbar"
on profiles for select
using (id = auth.uid());

create policy "Gruppenmitglieder sichtbar"
on profiles for select
using (gruppe_id = public.current_profile_gruppe());

create policy "Eigenes Profil anlegen"
on profiles for insert
with check (id = auth.uid());

create policy "Eigenes Profil bearbeiten"
on profiles for update
using (id = auth.uid());

create policy "Trainer bearbeitet Profile der Gruppe"
on profiles for update
using (
  public.current_profile_rolle() = 'trainer'
  and gruppe_id = public.current_profile_gruppe()
);

create policy "Eigenes Profil löschen"
on profiles for delete
using (id = auth.uid());

create policy "Trainer löscht Profile der Gruppe"
on profiles for delete
using (
  public.current_profile_rolle() = 'trainer'
  and gruppe_id = public.current_profile_gruppe()
);

-- ============ kind_profile ============
create policy "Eigene Kinder sichtbar"
on kind_profile for select
using (eltern_user_id = auth.uid());

create policy "Kinder der eigenen Gruppe sichtbar"
on kind_profile for select
using (gruppe_id = public.current_profile_gruppe());

create policy "Eigene Kinder anlegen"
on kind_profile for insert
with check (eltern_user_id = auth.uid());

create policy "Trainer legt Kinder der Gruppe an"
on kind_profile for insert
with check (
  public.current_profile_rolle() = 'trainer'
  and gruppe_id = public.current_profile_gruppe()
);

create policy "Eigene Kinder bearbeiten"
on kind_profile for update
using (eltern_user_id = auth.uid());

create policy "Trainer bearbeitet Kinder der Gruppe"
on kind_profile for update
using (
  public.current_profile_rolle() = 'trainer'
  and gruppe_id = public.current_profile_gruppe()
);

create policy "Eigene Kinder löschen"
on kind_profile for delete
using (eltern_user_id = auth.uid());

create policy "Trainer löscht Kinder der Gruppe"
on kind_profile for delete
using (
  public.current_profile_rolle() = 'trainer'
  and gruppe_id = public.current_profile_gruppe()
);

-- ============ trainings_anlaesse ============
create policy "Trainings/Anlässe der eigenen Gruppe sichtbar"
on trainings_anlaesse for select
using (gruppe_id = public.current_profile_gruppe());

create policy "Trainer verwaltet Trainings/Anlässe (insert)"
on trainings_anlaesse for insert
with check (
  public.current_profile_rolle() = 'trainer'
  and gruppe_id = public.current_profile_gruppe()
);

create policy "Trainer verwaltet Trainings/Anlässe (update)"
on trainings_anlaesse for update
using (
  public.current_profile_rolle() = 'trainer'
  and gruppe_id = public.current_profile_gruppe()
);

create policy "Trainer verwaltet Trainings/Anlässe (delete)"
on trainings_anlaesse for delete
using (
  public.current_profile_rolle() = 'trainer'
  and gruppe_id = public.current_profile_gruppe()
);

-- ============ abwesenheiten ============
-- Trainer und Volti sehen alle Abwesenheiten ihrer Gruppe (Events der Gruppe).
create policy "Trainer/Volti sehen Abwesenheiten der Gruppe"
on abwesenheiten for select
using (
  public.current_profile_rolle() in ('trainer', 'volti')
  and event_id in (
    select id from trainings_anlaesse where gruppe_id = public.current_profile_gruppe()
  )
);

-- Eltern sehen nur Abwesenheiten ihrer eigenen Kinder.
create policy "Eltern sehen Abwesenheiten der eigenen Kinder"
on abwesenheiten for select
using (
  kind_profile_id in (
    select id from kind_profile where eltern_user_id = auth.uid()
  )
);

create policy "Eltern melden Abwesenheit der eigenen Kinder"
on abwesenheiten for insert
with check (
  kind_profile_id in (
    select id from kind_profile where eltern_user_id = auth.uid()
  )
);

create policy "Trainer/Volti melden Abwesenheit in der Gruppe"
on abwesenheiten for insert
with check (
  public.current_profile_rolle() in ('trainer', 'volti')
  and event_id in (
    select id from trainings_anlaesse where gruppe_id = public.current_profile_gruppe()
  )
);

create policy "Eltern bearbeiten Abwesenheit der eigenen Kinder"
on abwesenheiten for update
using (
  kind_profile_id in (
    select id from kind_profile where eltern_user_id = auth.uid()
  )
);

create policy "Trainer/Volti bearbeiten Abwesenheit in der Gruppe"
on abwesenheiten for update
using (
  public.current_profile_rolle() in ('trainer', 'volti')
  and event_id in (
    select id from trainings_anlaesse where gruppe_id = public.current_profile_gruppe()
  )
);

create policy "Trainer löscht Abwesenheiten der Gruppe"
on abwesenheiten for delete
using (
  public.current_profile_rolle() = 'trainer'
  and event_id in (
    select id from trainings_anlaesse where gruppe_id = public.current_profile_gruppe()
  )
);

-- Hinweis: RLS wirkt zeilenweise, nicht spaltenweise. Ein "volti" kann mit
-- den Policies oben also die Zeile lesen, auch wenn ist_privat = true.
-- Wenn der Grund-Text wirklich nur für Trainer sichtbar sein soll, braucht
-- es zusätzlich eine View ohne "grund"-Spalte für nicht-Trainer-Rollen,
-- oder die App blendet das Feld clientseitig aus. Sag Bescheid, falls ich
-- das noch ergänzen soll.

-- ============ packliste_items ============
create policy "Packliste der Gruppe sichtbar"
on packliste_items for select
using (gruppe_id = public.current_profile_gruppe());

create policy "Trainer legt Packliste-Items an"
on packliste_items for insert
with check (
  public.current_profile_rolle() = 'trainer'
  and gruppe_id = public.current_profile_gruppe()
);

create policy "Gruppenmitglieder haken Packliste-Items ab"
on packliste_items for update
using (gruppe_id = public.current_profile_gruppe());

create policy "Trainer löscht Packliste-Items"
on packliste_items for delete
using (
  public.current_profile_rolle() = 'trainer'
  and gruppe_id = public.current_profile_gruppe()
);
