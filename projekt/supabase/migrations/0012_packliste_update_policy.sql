-- Verschärft die Update-Policy für packliste_items: Eltern sollen die Liste
-- nur lesen können (zur Vorbereitung), nicht mehr abhaken dürfen - das
-- bleibt Trainer und Volti vorbehalten (Eltern haben reines Leserecht).
drop policy if exists "Gruppenmitglieder haken Packliste-Items ab" on packliste_items;

create policy "Trainer/Volti haken Packliste-Items ab"
on packliste_items for update
using (
  public.current_profile_rolle() in ('trainer', 'volti')
  and gruppe_id = public.current_profile_gruppe()
);
