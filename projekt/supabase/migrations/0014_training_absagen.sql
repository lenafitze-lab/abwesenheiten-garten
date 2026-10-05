-- Ergänzt Trainings/Anlässe um eine "abgesagt"-Markierung: Trainer können
-- einen einzelnen Termin absagen, ohne ihn zu löschen. Der Termin bleibt so
-- in der Historie/Übersicht sichtbar (durchgestrichen, gedämpft dargestellt),
-- aber ohne Anwesend-/Abwesend-Erfassung. "abgesagt_am" hält fest, wann die
-- Absage erfolgt ist, für spätere Nachvollziehbarkeit.
alter table trainings_anlaesse add column abgesagt boolean not null default false;
alter table trainings_anlaesse add column abgesagt_am timestamptz;

-- Keine neue RLS-Policy nötig: Die bestehende Update-Policy
-- "Trainer verwaltet Trainings/Anlässe (update)" (siehe 0002_rls.sql) wirkt
-- zeilenweise und deckt damit automatisch auch die beiden neuen Spalten ab -
-- Volti/Eltern können trainings_anlaesse weiterhin gar nicht per UPDATE
-- ändern, Trainer weiterhin nur Zeilen der eigenen Gruppe.
