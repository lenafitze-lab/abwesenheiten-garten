-- Feste Standard-Vorlage für die Packliste der Gruppe. "not exists"-Guard
-- macht die Migration idempotent, falls einzelne Items schon manuell
-- angelegt wurden.
insert into packliste_items (gruppe_id, name)
select g.id, item
from gruppen g
cross join unnest(array['Voltigegurt', 'Pad', 'Longe', 'Bandagen', 'Ohrengarn', 'Müsli']) as item
where g.name = 'Garten 1'
and not exists (
  select 1 from packliste_items p where p.gruppe_id = g.id and p.name = item
);
