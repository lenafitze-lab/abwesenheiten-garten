-- Der partielle Index aus 0006 kann von "upsert(..., { onConflict: ... })"
-- nicht als Ziel für ON CONFLICT erkannt werden (Postgres berücksichtigt
-- partielle Indizes dafür nur, wenn die WHERE-Klausel im Conflict-Target
-- selbst wiederholt wird - das unterstützt der Supabase-Client nicht).
-- Ein normaler Unique Constraint funktioniert genauso gut: Zeilen mit
-- profile_id = NULL (Kind-Einträge) gelten in SQL nie als "gleich" und
-- kollidieren daher ohnehin nie miteinander.
drop index if exists abwesenheiten_event_profile_unique;

alter table abwesenheiten
  add constraint abwesenheiten_event_profile_unique unique (event_id, profile_id);
