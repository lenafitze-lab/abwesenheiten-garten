-- Die Gruppe heisst neu "Garten Sen. 1" (Sen. = Senioren). Nur der Name
-- ändert sich; id und alle Verknüpfungen (Profile, Termine, Packliste)
-- bleiben bestehen.
update gruppen
set name = 'Garten Sen. 1'
where name = 'Garten 1';
