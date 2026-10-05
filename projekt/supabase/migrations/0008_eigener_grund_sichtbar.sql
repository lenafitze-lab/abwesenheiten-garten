-- Die View maskierte den Grund bisher für alle Nicht-Trainer, auch für die
-- Person, deren eigener Eintrag es ist. Dadurch verschwand der selbst
-- eingegebene Grund beim erneuten Öffnen des Bearbeiten-Dialogs, und die
-- Person konnte ihren eigenen Grund nirgends mehr sehen. Ergänzt eine
-- Ausnahme für "eigener Eintrag" (a.profile_id = auth.uid()).
-- Für Eltern/Kind-Einträge greift das nicht (kind_profile_id-Zeilen haben
-- profile_id = NULL, das Gleichheits-Match schlägt dort also nie an) - die
-- "auch nicht beim eigenen Kind"-Regel bleibt also unverändert bestehen.
create or replace view abwesenheiten_public as
select
  a.id,
  a.event_id,
  a.kind_profile_id,
  a.profile_id,
  a.status,
  case
    when public.current_profile_rolle() = 'trainer' then a.grund
    when a.profile_id = auth.uid() then a.grund
    when a.ist_privat then null
    else a.grund
  end as grund,
  a.ist_privat,
  a.gemeldet_von,
  a.timestamp
from abwesenheiten a
join trainings_anlaesse t on t.id = a.event_id
where t.gruppe_id = public.current_profile_gruppe();
