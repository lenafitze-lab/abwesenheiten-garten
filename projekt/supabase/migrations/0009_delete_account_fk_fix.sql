-- Die "delete-account" Edge Function ruft auth.admin.deleteUser() auf und
-- schlägt dabei mit "Database error deleting user" fehl: "gemeldet_von"
-- (abwesenheiten) und "abgehakt_von" (packliste_items) referenzieren
-- auth.users(id) ohne "on delete"-Angabe (Default NO ACTION), was das
-- Löschen blockiert, sobald die Person jemals eine Abwesenheit gemeldet
-- oder ein Packlisten-Item abgehakt hat.
--
-- Beide Spalten sind reine Attributions-Angaben (wer hat's gemeldet/
-- abgehakt), nicht der eigentliche Datensatz - beim Löschen des Accounts
-- soll deshalb nur die Zuordnung auf NULL gesetzt werden, nicht die
-- Abwesenheit bzw. das Packlisten-Item mitgelöscht werden (im Unterschied
-- zu z.B. "profile_id"/"kind_profile_id", die weiterhin "on delete cascade"
-- bleiben, weil sie den eigentlichen Datensatz identifizieren).
alter table abwesenheiten
  drop constraint abwesenheiten_gemeldet_von_fkey,
  add constraint abwesenheiten_gemeldet_von_fkey
    foreign key (gemeldet_von) references auth.users(id) on delete set null;

alter table packliste_items
  drop constraint packliste_items_abgehakt_von_fkey,
  add constraint packliste_items_abgehakt_von_fkey
    foreign key (abgehakt_von) references auth.users(id) on delete set null;
