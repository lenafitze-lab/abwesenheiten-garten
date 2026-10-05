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

  // "Weiches" Löschen statt admin.deleteUser(): Login wird über einen sehr
  // langen Bann gesperrt (GoTrue kennt kein echtes "für immer", daher ~100
  // Jahre als De-facto-Permanentsperre), die profiles-Zeile bleibt aber
  // erhalten und wird nur als gelöscht markiert - so ist sie in Supabase
  // weiterhin sichtbar/nachvollziehbar statt spurlos zu verschwinden.
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    ban_duration: '876000h',
  });
  if (banError) {
    return new Response(banError.message, { status: 400, headers: corsHeaders });
  }

  const { error: profilError } = await supabaseAdmin
    .from('profiles')
    .update({ geloescht_am: new Date().toISOString() })
    .eq('id', user.id);
  if (profilError) {
    return new Response(profilError.message, { status: 400, headers: corsHeaders });
  }

  return new Response('OK', { status: 200, headers: corsHeaders });
});
