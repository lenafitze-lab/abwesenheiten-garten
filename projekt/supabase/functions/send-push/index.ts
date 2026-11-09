import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {
  baueNachricht,
  baueSwPayload,
  bestimmeTerminEreignis,
  type Empfaengerprofil,
  filtereEmpfaenger,
  type PushEreignis,
  type TerminZeile,
} from './push-logik.ts';

// Wird ausschliesslich von den Datenbank-Triggern (Migration
// 0016_push_benachrichtigungen.sql) per pg_net aufgerufen, nie vom
// Frontend. Deshalb ohne JWT-Prüfung deployt (siehe config.toml) und
// stattdessen über ein gemeinsames Geheimnis im Header abgesichert.
//
// Benötigte Secrets (supabase secrets set ...):
//   PUSH_WEBHOOK_SECRET  - muss mit dem Vault-Secret "push_webhook_secret" übereinstimmen
//   VAPID_PUBLIC_KEY     - derselbe Key wie in environment.ts
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT        - optional, "mailto:..." oder https-URL der App

interface TriggerPayload {
  tabelle: 'trainings_anlaesse' | 'abwesenheiten';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
  ausloeser_id: string | null;
}

const TERMIN_FELDER =
  'id, gruppe_id, typ, titel, start, ende, ist_dauerauftrag, verfalldatum, ausnahme_von_id, bemerkung, abgesagt';

Deno.serve(async (req) => {
  const erwartetesGeheimnis = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!erwartetesGeheimnis || req.headers.get('x-push-secret') !== erwartetesGeheimnis) {
    return new Response('Nicht erlaubt.', { status: 401 });
  }

  const payload = (await req.json()) as TriggerPayload;
  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const ereignis =
    payload.tabelle === 'abwesenheiten'
      ? await abmeldungsEreignis(supabaseAdmin, payload)
      : bestimmeTerminEreignis(
          payload.operation,
          payload.record as TerminZeile | null,
          payload.old_record as TerminZeile | null,
          new Date(),
        );
  if (!ereignis || !ereignis.termin.gruppe_id) {
    return Response.json({ gesendet: 0 });
  }

  const { data: profile, error: profilError } = await supabaseAdmin
    .from('profiles')
    .select('id, rolle')
    .eq('gruppe_id', ereignis.termin.gruppe_id)
    .is('geloescht_am', null);
  if (profilError) {
    return new Response(profilError.message, { status: 500 });
  }

  const empfaenger = filtereEmpfaenger((profile ?? []) as Empfaengerprofil[], ereignis, payload.ausloeser_id);
  if (empfaenger.length === 0) {
    return Response.json({ gesendet: 0 });
  }

  const { data: subscriptions, error: subError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', empfaenger);
  if (subError) {
    return new Response(subError.message, { status: 500 });
  }

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'https://lenafitze-lab.github.io/abwesenheiten-garten/',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  );
  const inhalt = JSON.stringify(baueSwPayload(baueNachricht(ereignis)));

  const abgelaufen: string[] = [];
  let gesendet = 0;
  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          inhalt,
          { TTL: 60 * 60 * 24 },
        );
        gesendet++;
      } catch (error) {
        // 404/410: Browser hat die Subscription verworfen (App deinstalliert,
        // Berechtigung entzogen ...) - aufräumen, sonst wird es jedes Mal erneut versucht.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          abgelaufen.push(sub.id);
        } else {
          console.error('Push fehlgeschlagen:', status, (error as Error).message);
        }
      }
    }),
  );

  if (abgelaufen.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('id', abgelaufen);
  }

  return Response.json({ gesendet, entfernt: abgelaufen.length });
});

// Abmeldung: der Trigger schickt bewusst nur IDs und Status mit (nie den
// Grund) - Termin und Vorname werden hier nachgeladen.
async function abmeldungsEreignis(
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: TriggerPayload,
): Promise<PushEreignis | null> {
  const record = payload.record ?? {};
  const { data: termin } = await supabaseAdmin
    .from('trainings_anlaesse')
    .select(TERMIN_FELDER)
    .eq('id', record['event_id'] as string)
    .maybeSingle();
  if (!termin || termin.abgesagt) {
    return null;
  }

  const profileId = (record['profile_id'] as string | null) ?? null;
  const { data: person } = profileId
    ? await supabaseAdmin.from('profiles').select('vorname').eq('id', profileId).maybeSingle()
    : await supabaseAdmin.from('kind_profile').select('vorname').eq('id', record['kind_profile_id'] as string).maybeSingle();

  return {
    art: 'abmeldung',
    termin: termin as TerminZeile,
    name: (person?.vorname as string | undefined) ?? 'Jemand',
    betroffenerId: profileId,
  };
}
