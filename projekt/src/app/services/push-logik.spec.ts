import {
  baueNachricht,
  baueSwPayload,
  bestimmeTerminEreignis,
  Empfaengerprofil,
  filtereEmpfaenger,
  PushEreignis,
  TerminZeile,
} from '../../../supabase/functions/send-push/push-logik';

// Die Logik lebt bei der Edge Function (Deno), ist aber bewusst frei von
// Deno-APIs, damit sie hier mit Vitest getestet werden kann.

const JETZT = new Date('2026-10-17T10:00:00Z');

function termin(teil: Partial<TerminZeile> = {}): TerminZeile {
  return {
    id: 'event-1',
    gruppe_id: 'gruppe-1',
    typ: 'training',
    titel: 'Abendtraining',
    // Di, 20.10.2026, 18:00 Zürcher Zeit (Sommerzeit bis 25.10. -> UTC+2)
    start: '2026-10-20T16:00:00+00:00',
    ende: '2026-10-20T17:30:00+00:00',
    ist_dauerauftrag: false,
    verfalldatum: null,
    ausnahme_von_id: null,
    bemerkung: null,
    abgesagt: false,
    ...teil,
  };
}

const GRUPPE: Empfaengerprofil[] = [
  { id: 'trainer-1', rolle: 'trainer' },
  { id: 'volti-anna', rolle: 'volti' },
  { id: 'volti-ben', rolle: 'volti' },
  { id: 'eltern-1', rolle: 'eltern' },
];

describe('Push-Empfänger', () => {
  const abmeldung: PushEreignis = { art: 'abmeldung', termin: termin(), name: 'Anna', betroffenerId: 'volti-anna' };

  it('Abmeldung: Trainer und Voltis, aber keine Eltern', () => {
    expect(filtereEmpfaenger(GRUPPE, abmeldung, 'volti-anna')).toEqual(['trainer-1', 'volti-ben']);
  });

  it('Abmeldung: weder die auslösende noch die abgemeldete Person bekommt eine Nachricht', () => {
    // Trainer meldet Anna ab -> weder Trainer noch Anna selbst
    expect(filtereEmpfaenger(GRUPPE, abmeldung, 'trainer-1')).toEqual(['volti-ben']);
  });

  it.each(['neu', 'geaendert', 'abgesagt', 'geloescht'] as const)('Termin "%s": alle Rollen inkl. Eltern', (art) => {
    const ereignis: PushEreignis = { art, termin: termin(), serie: false };
    expect(filtereEmpfaenger(GRUPPE, ereignis, null)).toEqual(['trainer-1', 'volti-anna', 'volti-ben', 'eltern-1']);
  });

  it('Termin: der Trainer, der ihn erstellt hat, bekommt selbst keine Nachricht', () => {
    const ereignis: PushEreignis = { art: 'neu', termin: termin(), serie: false };
    expect(filtereEmpfaenger(GRUPPE, ereignis, 'trainer-1')).not.toContain('trainer-1');
  });
});

describe('Push-Ereignis aus Änderungen an trainings_anlaesse', () => {
  it('neuer einmaliger Termin -> "neu"', () => {
    expect(bestimmeTerminEreignis('INSERT', termin(), null, JETZT)).toMatchObject({ art: 'neu', serie: false });
  });

  it('neue Serie -> genau ein "neu"-Ereignis für die Basiszeile, keines für die Wochen-Instanzen', () => {
    const basis = termin({ id: 'basis-1', ist_dauerauftrag: true });
    expect(bestimmeTerminEreignis('INSERT', basis, null, JETZT)).toMatchObject({ art: 'neu', serie: true });
    expect(bestimmeTerminEreignis('INSERT', termin({ ausnahme_von_id: 'basis-1' }), null, JETZT)).toBeNull();
  });

  it('Absage -> "abgesagt", Reaktivieren -> "reaktiviert"', () => {
    const offen = termin();
    const abgesagt = termin({ abgesagt: true });
    expect(bestimmeTerminEreignis('UPDATE', abgesagt, offen, JETZT)?.art).toBe('abgesagt');
    expect(bestimmeTerminEreignis('UPDATE', offen, abgesagt, JETZT)?.art).toBe('reaktiviert');
  });

  it('Zeitstempel im Postgres- und im ISO-Format gelten als gleich (keine Schein-Änderung)', () => {
    const alt = termin({ start: '2026-10-20 16:00:00+00', ende: '2026-10-20 17:30:00+00' });
    expect(bestimmeTerminEreignis('UPDATE', termin(), alt, JETZT)).toBeNull();
  });

  it('geänderte Uhrzeit -> "geaendert"', () => {
    const neu = termin({ start: '2026-10-20T16:30:00+00:00' });
    expect(bestimmeTerminEreignis('UPDATE', neu, termin(), JETZT)?.art).toBe('geaendert');
  });

  it('"Serie löschen" (Verfalldatum der Basiszeile auf gestern) -> ein "geloescht" für die ganze Serie', () => {
    const alt = termin({ ist_dauerauftrag: true });
    const neu = termin({ ist_dauerauftrag: true, verfalldatum: '2026-10-16' });
    expect(bestimmeTerminEreignis('UPDATE', neu, alt, JETZT)).toMatchObject({ art: 'geloescht', serie: true });
  });

  it('Änderungen an bereits vergangenen Einzelterminen werden nicht gemeldet', () => {
    const vorbei = termin({ start: '2026-10-01T16:00:00+00:00', ende: '2026-10-01T17:30:00+00:00' });
    expect(bestimmeTerminEreignis('DELETE', null, vorbei, JETZT)).toBeNull();
  });
});

describe('Push-Texte', () => {
  it('Abmeldung nennt Name, Datum und Uhrzeit, aber nie einen Grund', () => {
    const nachricht = baueNachricht({ art: 'abmeldung', termin: termin(), name: 'Anna', betroffenerId: 'volti-anna' });
    expect(nachricht.text).toBe('Anna hat sich für das Training vom Di, 20.10. um 18:00 abgemeldet.');
    expect(nachricht.url).toBe('tabs/abwesenheiten?termin=event-1');
  });

  it('Serie: eine Nachricht mit Wochentag und Uhrzeit', () => {
    const nachricht = baueNachricht({ art: 'neu', termin: termin({ ist_dauerauftrag: true }), serie: true });
    expect(nachricht.titel).toBe('Neue Serie');
    expect(nachricht.text).toBe('Training «Abendtraining» jeden Dienstag 18:00');
  });

  it('Absage eines einzelnen Termins', () => {
    const nachricht = baueNachricht({ art: 'abgesagt', termin: termin(), serie: false });
    expect(nachricht).toEqual({
      titel: 'Training abgesagt',
      text: '«Abendtraining» am Di, 20.10. um 18:00 fällt aus.',
      url: 'tabs/abwesenheiten?termin=event-1',
    });
  });

  it('mehrtägiger Anlass: Zeitraum statt Uhrzeit', () => {
    const anlass = termin({ typ: 'anlass', titel: 'Turnier Bern', start: '2026-10-24T07:00:00+00:00', ende: '2026-10-25T15:00:00+00:00' });
    expect(baueNachricht({ art: 'neu', termin: anlass, serie: false })).toMatchObject({
      titel: 'Neuer Anlass',
      text: '«Turnier Bern» vom Sa, 24.10. bis So, 25.10.',
    });
  });

  it('Texte verwenden Schweizer Schreibweise (kein ß)', () => {
    const arten = ['neu', 'geaendert', 'abgesagt', 'reaktiviert', 'geloescht'] as const;
    for (const art of arten) {
      for (const serie of [true, false]) {
        const { titel, text } = baueNachricht({ art, termin: termin({ ist_dauerauftrag: serie }), serie });
        expect(`${titel} ${text}`).not.toContain('ß');
      }
    }
  });

  it('Payload im Format des Angular Service Workers mit relativer URL (Base-Path von GitHub Pages)', () => {
    const payload = baueSwPayload({ titel: 'T', text: 'B', url: 'tabs/abwesenheiten?termin=event-1' });
    expect(payload).toMatchObject({
      notification: {
        title: 'T',
        body: 'B',
        data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: 'tabs/abwesenheiten?termin=event-1' } } },
      },
    });
  });
});
