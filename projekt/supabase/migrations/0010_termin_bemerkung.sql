-- Ergänzt Trainings/Anlässe um eine optionale Bemerkung (z.B. "Bitte Halle 2
-- statt Garten 1" oder "Fällt bei Regen aus"), die Trainer beim Erstellen
-- hinterlegen können und die in der Kartenübersicht per Info-Icon einsehbar
-- ist.
alter table trainings_anlaesse add column bemerkung text;
