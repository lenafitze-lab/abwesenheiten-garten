-- Die Registrierung muss die Gruppen-ID nachschlagen können, bevor der
-- Account überhaupt existiert (also ohne Login). Die alte Policy hat das
-- fälschlicherweise nur eingeloggten Nutzern erlaubt.
drop policy if exists "Gruppen sichtbar für eingeloggte Nutzer" on gruppen;

create policy "Gruppen öffentlich sichtbar"
on gruppen for select
using (true);
