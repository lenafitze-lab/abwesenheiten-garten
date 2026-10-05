-- Erlaubt ein "weiches" Löschen von Profilen: die Zeile bleibt (samt Name,
-- Rolle etc.) in Supabase sichtbar und nachvollziehbar, statt beim Löschen
-- spurlos zu verschwinden. Aktive Nutzung wird stattdessen über einen
-- Login-Bann (GoTrue, siehe delete-account Edge Function) plus dieses
-- Zeitstempel-Flag verhindert.
alter table profiles add column geloescht_am timestamptz;
