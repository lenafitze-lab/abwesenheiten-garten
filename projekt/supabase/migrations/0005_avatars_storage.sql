-- Storage-Bucket für Profilbilder. Öffentlich lesbar (Avatare sind keine
-- sensiblen Daten), aber nur die jeweilige Nutzerin darf im eigenen
-- Unterordner (userId/...) hochladen/ändern/löschen.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatare öffentlich lesbar"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Eigenen Avatar hochladen"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Eigenen Avatar aktualisieren"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Eigenen Avatar löschen"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
