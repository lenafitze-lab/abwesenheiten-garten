import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SUPABASE_URL, SUPABASE_ANON_KEY und SUPABASE_SERVICE_ROLE_KEY stehen
// Edge Functions automatisch als Umgebungsvariablen zur Verfügung.

// Ohne diese Header blockiert der Browser den Aufruf schon bei der
// OPTIONS-Preflight-Anfrage, bevor er überhaupt bei Supabase ankommt.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Nicht angemeldet.', { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Client im Kontext der aufrufenden Nutzerin, um deren Identität aus dem
  // mitgesendeten Auth-Token zu bestimmen. So kann niemand eine fremde
  // userId übergeben und ein anderes Konto löschen lassen.
  const supabaseAsCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseAsCaller.auth.getUser();
  if (userError || !user) {
    return new Response('Nicht angemeldet.', { status: 401, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Profilbilder liegen unter "<userId>/avatar.<ext>". Storage-Dateien
  // hängen nicht per Foreign Key am User, darum vor dem Löschen explizit
  // entfernen - sonst bleiben sie verwaist im Bucket liegen.
  const { data: avatarDateien, error: listError } = await supabaseAdmin.storage
    .from('avatars')
    .list(user.id);
  if (listError) {
    return new Response(listError.message, { status: 400, headers: corsHeaders });
  }
  if (avatarDateien.length > 0) {
    const { error: removeError } = await supabaseAdmin.storage
      .from('avatars')
      .remove(avatarDateien.map((datei) => `${user.id}/${datei.name}`));
    if (removeError) {
      return new Response(removeError.message, { status: 400, headers: corsHeaders });
    }
  }

  // Echtes Löschen (kein Soft Delete, kein Bann): die E-Mail ist danach
  // sofort wieder frei. profiles, kind_profile und eigene abwesenheiten
  // verschwinden per "on delete cascade" mit; gemeldet_von bzw.
  // abgehakt_von werden per "on delete set null" geleert (siehe 0009).
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return new Response(deleteError.message, { status: 400, headers: corsHeaders });
  }

  return new Response('OK', { status: 200, headers: corsHeaders });
});
