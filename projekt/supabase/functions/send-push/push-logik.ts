// Reine Logik der "send-push" Edge Function: welches Ereignis ausgelöst
// wurde, wer es bekommt und wie die Nachricht lautet. Bewusst ohne Imports
// und ohne Deno-APIs, damit dieselbe Datei auch in den Vitest-Unit-Tests
// der Angular-App läuft (siehe src/app/services/push-logik.spec.ts).

export type Rolle = 'trainer' | 'volti' | 'eltern';
export type TerminTyp = 'training' | 'anlass' | 'turnier';

/** Zeile aus trainings_anlaesse, wie sie der Datenbank-Trigger mitschickt. */
export interface TerminZeile {
  id: string;
  gruppe_id: string | null;
  typ: TerminTyp | null;
  titel: string;
  start: string;
  ende: string | null;
  ist_dauerauftrag: boolean | null;
  verfalldatum: string | null;
  ausnahme_von_id: string | null;
  bemerkung: string | null;
  abgesagt: boolean | null;
}

export type TerminAktion = 'neu' | 'geaendert' | 'abgesagt' | 'reaktiviert' | 'geloescht';

export type PushEreignis =
  | {
      art: 'abmeldung';
      termin: TerminZeile;
      /** Vorname der Person, die sich abgemeldet hat. Der Grund wird bewusst nie mitgegeben. */
      name: string;
      /** profiles.id der abgemeldeten Person (null bei Kind-Profilen). */
      betroffenerId: string | null;
    }
  | {
      art: TerminAktion;
      termin: TerminZeile;
      /** true = Aktion betrifft eine ganze Dauerauftrag-Serie (eine Nachricht statt einer pro Woche). */
      serie: boolean;
    };

export interface PushNachricht {
  titel: string;
  text: string;
  /** Relativ zum Service-Worker-Scope, damit der GitHub-Pages-Base-Path automatisch stimmt. */
  url: string;
}

export interface Empfaengerprofil {
  id: string;
  rolle: Rolle;
}

/** Wer welche Ereignisse bekommt. Eltern erfahren nichts über Abmeldungen. */
const ROLLEN_PRO_ART: Record<PushEreignis['art'], Rolle[]> = {
  abmeldung: ['trainer', 'volti'],
  neu: ['trainer', 'volti', 'eltern'],
  geaendert: ['trainer', 'volti', 'eltern'],
  abgesagt: ['trainer', 'volti', 'eltern'],
  reaktiviert: ['trainer', 'volti', 'eltern'],
  geloescht: ['trainer', 'volti', 'eltern'],
};

export function empfaengerRollen(art: PushEreignis['art']): Rolle[] {
  return ROLLEN_PRO_ART[art];
}

/**
 * Filtert die Gruppenmitglieder auf die Empfänger*innen eines Ereignisses.
 * Wer die Aktion ausgelöst hat, bekommt selbst nie eine Nachricht; bei
 * einer Abmeldung zusätzlich auch nicht die abgemeldete Person selbst
 * (z.B. wenn ein Trainer jemanden abmeldet).
 */
export function filtereEmpfaenger(
  profile: Empfaengerprofil[],
  ereignis: PushEreignis,
  ausloeserId: string | null,
): string[] {
  const rollen = empfaengerRollen(ereignis.art);
  const ausgeschlossen = new Set<string>();
  if (ausloeserId) {
    ausgeschlossen.add(ausloeserId);
  }
  if (ereignis.art === 'abmeldung' && ereignis.betroffenerId) {
    ausgeschlossen.add(ereignis.betroffenerId);
  }
  return profile.filter((p) => rollen.includes(p.rolle) && !ausgeschlossen.has(p.id)).map((p) => p.id);
}

const RELEVANTE_FELDER: (keyof TerminZeile)[] = ['titel', 'start', 'ende', 'bemerkung'];

/**
 * Leitet aus einer Änderung an trainings_anlaesse das Ereignis ab, oder
 * null, wenn dafür keine Nachricht verschickt werden soll.
 *
 * Serien: Eine Dauerauftrag-Serie besteht aus einer Basiszeile
 * (ist_dauerauftrag = true) und den Wochen-Instanzen (ausnahme_von_id =
 * Basis). Nachrichten zu Serien laufen ausschliesslich über die Basiszeile.
 * Inserts von Instanzen (Nachziehen neuer Wochen, Tage eines mehrtägigen
 * Anlasses) lösen nie etwas aus; Änderungen an Instanzen direkt nach einer
 * Serien-Änderung unterdrückt bereits der Datenbank-Trigger.
 */
export function bestimmeTerminEreignis(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  neu: TerminZeile | null,
  alt: TerminZeile | null,
  jetzt: Date,
): PushEreignis | null {
  if (operation === 'INSERT') {
    if (!neu || neu.ausnahme_von_id) {
      return null;
    }
    return { art: 'neu', termin: neu, serie: Boolean(neu.ist_dauerauftrag) };
  }

  if (operation === 'DELETE') {
    if (!alt) {
      return null;
    }
    const serie = Boolean(alt.ist_dauerauftrag);
    if (!serie && istVorbei(alt, jetzt)) {
      return null;
    }
    return { art: 'geloescht', termin: alt, serie };
  }

  if (!neu || !alt) {
    return null;
  }

  if (neu.ist_dauerauftrag) {
    // "Serie löschen" kürzt das Verfalldatum der Basiszeile auf gestern.
    const verfallGeaendert = neu.verfalldatum !== alt.verfalldatum;
    if (verfallGeaendert && neu.verfalldatum && neu.verfalldatum < datumZuerich(jetzt)) {
      return { art: 'geloescht', termin: alt, serie: true };
    }
    return relevantGeaendert(neu, alt) ? { art: 'geaendert', termin: neu, serie: true } : null;
  }

  if (istVorbei(neu, jetzt) && istVorbei(alt, jetzt)) {
    return null;
  }
  if (!alt.abgesagt && neu.abgesagt) {
    return { art: 'abgesagt', termin: neu, serie: false };
  }
  if (alt.abgesagt && !neu.abgesagt) {
    return { art: 'reaktiviert', termin: neu, serie: false };
  }
  return relevantGeaendert(neu, alt) ? { art: 'geaendert', termin: neu, serie: false } : null;
}

function relevantGeaendert(neu: TerminZeile, alt: TerminZeile): boolean {
  return RELEVANTE_FELDER.some((feld) => {
    if (feld === 'start' || feld === 'ende') {
      return zeitpunkt(neu[feld]) !== zeitpunkt(alt[feld]);
    }
    return (neu[feld] ?? null) !== (alt[feld] ?? null);
  });
}

// Postgres liefert Zeitstempel als "2026-10-21 16:00:00+00", das Frontend
// als "2026-10-21T16:00:00.000Z" - deshalb über die Millisekunden vergleichen.
function zeitpunkt(wert: unknown): number | null {
  return typeof wert === 'string' ? parseZeit(wert).getTime() : null;
}

function istVorbei(termin: TerminZeile, jetzt: Date): boolean {
  return parseZeit(termin.ende ?? termin.start).getTime() < jetzt.getTime();
}

function parseZeit(wert: string): Date {
  // "2026-10-21 16:00:00+00" ist kein von allen Engines akzeptiertes ISO-Format.
  return new Date(wert.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
}

const ZEITZONE = 'Europe/Zurich';

interface TypTexte {
  name: string;
  artikel: string;
  neu: string;
}

const TYP_TEXTE: Record<TerminTyp, TypTexte> = {
  training: { name: 'Training', artikel: 'das Training', neu: 'Neues Training' },
  anlass: { name: 'Anlass', artikel: 'den Anlass', neu: 'Neuer Anlass' },
  turnier: { name: 'Turnier', artikel: 'das Turnier', neu: 'Neues Turnier' },
};

export function baueNachricht(ereignis: PushEreignis): PushNachricht {
  const termin = ereignis.termin;
  const typ = TYP_TEXTE[termin.typ ?? 'training'];
  const wann = wannText(termin);
  const zumTermin = `tabs/abwesenheiten?termin=${termin.id}`;
  const zurListe = 'tabs/abwesenheiten';

  if (ereignis.art === 'abmeldung') {
    return {
      titel: 'Abmeldung',
      text: `${ereignis.name} hat sich für ${typ.artikel} ${wann.replace(/^am /, 'vom ')} abgemeldet.`,
      url: zumTermin,
    };
  }

  if (ereignis.serie) {
    const rhythmus = `${typ.name} «${termin.titel}» jeden ${wochentag(termin.start)} ${uhrzeit(termin.start)}`;
    switch (ereignis.art) {
      case 'neu':
        return { titel: 'Neue Serie', text: `${rhythmus}${bisText(termin)}`, url: zurListe };
      case 'geloescht':
        return { titel: 'Serie gelöscht', text: `${rhythmus} findet nicht mehr statt.`, url: zurListe };
      default:
        return { titel: 'Serie geändert', text: `Neu: ${rhythmus}`, url: zurListe };
    }
  }

  const titel = `«${termin.titel}»`;
  switch (ereignis.art) {
    case 'neu':
      return { titel: typ.neu, text: `${titel} ${wann}`, url: zumTermin };
    case 'abgesagt':
      return { titel: `${typ.name} abgesagt`, text: `${titel} ${wann} fällt aus.`, url: zumTermin };
    case 'reaktiviert':
      return { titel: `${typ.name} findet statt`, text: `${titel} ${wann} findet wieder statt.`, url: zumTermin };
    case 'geloescht':
      return { titel: `${typ.name} gelöscht`, text: `${titel} ${wann} wurde gelöscht.`, url: zurListe };
    default:
      return { titel: `${typ.name} geändert`, text: `${titel} neu ${wann}`, url: zumTermin };
  }
}

/**
 * Payload im Format, das der Angular Service Worker (ngsw-worker.js)
 * versteht: "notification" wird direkt angezeigt, "onActionClick" öffnet
 * beim Antippen die App bzw. navigiert ein offenes Fenster dorthin.
 */
export function baueSwPayload(nachricht: PushNachricht): Record<string, unknown> {
  return {
    notification: {
      title: nachricht.titel,
      body: nachricht.text,
      icon: 'icons/icon-192x192-v4.png',
      lang: 'de-CH',
      data: {
        onActionClick: {
          default: { operation: 'navigateLastFocusedOrOpen', url: nachricht.url },
        },
      },
    },
  };
}

// "am Di, 20.10. um 18:00" bzw. bei mehrtägigen Anlässen "vom Sa, 25.10. bis So, 26.10."
function wannText(termin: TerminZeile): string {
  const start = termin.start;
  if (termin.ende && datumZuerich(parseZeit(termin.ende)) !== datumZuerich(parseZeit(start))) {
    return `vom ${kurzdatum(start)} bis ${kurzdatum(termin.ende)}`;
  }
  return `am ${kurzdatum(start)} um ${uhrzeit(start)}`;
}

function bisText(termin: TerminZeile): string {
  if (!termin.verfalldatum) {
    return '';
  }
  const [jahr, monat, tag] = termin.verfalldatum.split('-');
  return ` (bis ${tag}.${monat}.${jahr})`;
}

function teile(wert: string, optionen: Intl.DateTimeFormatOptions): Record<string, string> {
  const ergebnis: Record<string, string> = {};
  for (const teil of new Intl.DateTimeFormat('de-CH', { timeZone: ZEITZONE, ...optionen }).formatToParts(parseZeit(wert))) {
    ergebnis[teil.type] = teil.value;
  }
  return ergebnis;
}

function kurzdatum(wert: string): string {
  const t = teile(wert, { weekday: 'short', day: '2-digit', month: '2-digit' });
  return `${t['weekday'].replace('.', '')}, ${t['day']}.${t['month']}.`;
}

function wochentag(wert: string): string {
  return teile(wert, { weekday: 'long' })['weekday'];
}

function uhrzeit(wert: string): string {
  const t = teile(wert, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${t['hour']}:${t['minute']}`;
}

/** Kalenderdatum in Zürich als "YYYY-MM-DD" (vergleichbar mit verfalldatum). */
export function datumZuerich(datum: Date): string {
  const t: Record<string, string> = {};
  for (const teil of new Intl.DateTimeFormat('en-CA', {
    timeZone: ZEITZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(datum)) {
    t[teil.type] = teil.value;
  }
  return `${t['year']}-${t['month']}-${t['day']}`;
}
