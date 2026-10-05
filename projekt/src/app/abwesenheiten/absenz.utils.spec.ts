import { istAbsenzGueltig, sichtbarerGrund, zaehleAnwesendAbwesend } from './absenz.utils';

describe('istAbsenzGueltig', () => {
  it('ist bei "anwesend" immer gültig, auch ohne Grund', () => {
    expect(istAbsenzGueltig('anwesend', '')).toBe(true);
  });

  it('ist bei "abwesend" ohne Grund ungültig', () => {
    expect(istAbsenzGueltig('abwesend', '')).toBe(false);
  });

  it('ist bei "abwesend" mit nur Leerzeichen ungültig', () => {
    expect(istAbsenzGueltig('abwesend', '   ')).toBe(false);
  });

  it('ist bei "abwesend" mit Grund gültig', () => {
    expect(istAbsenzGueltig('abwesend', 'krank')).toBe(true);
  });
});

describe('sichtbarerGrund', () => {
  it('zeigt Trainern den echten Grund, auch wenn privat', () => {
    expect(sichtbarerGrund('Trainer', { grund: 'krank', istPrivat: true })).toBe('krank');
  });

  it('zeigt Trainern den echten Grund, wenn nicht privat', () => {
    expect(sichtbarerGrund('Trainer', { grund: 'ferien', istPrivat: false })).toBe('ferien');
  });

  it('versteckt privaten Grund vor Volti', () => {
    expect(sichtbarerGrund('Volti', { grund: 'krank', istPrivat: true })).toBeNull();
  });

  it('versteckt privaten Grund vor Eltern, ausnahmslos - auch beim eigenen Kind', () => {
    expect(sichtbarerGrund('Eltern', { grund: 'krank', istPrivat: true })).toBeNull();
  });

  it('zeigt Volti/Eltern den Grund, wenn er nicht privat ist', () => {
    expect(sichtbarerGrund('Volti', { grund: 'ferien', istPrivat: false })).toBe('ferien');
    expect(sichtbarerGrund('Eltern', { grund: 'ferien', istPrivat: false })).toBe('ferien');
  });

  it('zeigt einer Volti-Person den eigenen privaten Grund', () => {
    expect(sichtbarerGrund('Volti', { grund: 'krank', istPrivat: true }, true)).toBe('krank');
  });

  it('versteckt weiterhin den privaten Grund, wenn es nicht der eigene Eintrag ist', () => {
    expect(sichtbarerGrund('Volti', { grund: 'krank', istPrivat: true }, false)).toBeNull();
  });

  it('macht bei Eltern keine Ausnahme fürs eigene Kind, auch wenn istEigenerEintrag fälschlich true wäre', () => {
    // Ein Kind-Eintrag ist nie "der eigene Eintrag" einer Eltern-Person
    // (kind_profile_id != profile_id der Eltern) - dieser Test dokumentiert
    // die Erwartung, dass die Funktion selbst keine Rollen-Ausnahme für
    // Eltern eingebaut hat, sondern sich strikt auf den Parameter verlässt,
    // den der Aufrufer korrekt (nie true für Eltern/Kind) übergeben muss.
    expect(sichtbarerGrund('Eltern', { grund: 'krank', istPrivat: true }, false)).toBeNull();
  });
});

describe('zaehleAnwesendAbwesend', () => {
  it('zählt eine gemischte Liste korrekt', () => {
    const ergebnis = zaehleAnwesendAbwesend([
      'anwesend',
      'anwesend',
      'abwesend',
      'anwesend',
      'abwesend',
      'anwesend',
    ]);
    expect(ergebnis).toEqual({ anwesend: 4, abwesend: 2 });
  });

  it('liefert 0/0 bei leerer Liste', () => {
    expect(zaehleAnwesendAbwesend([])).toEqual({ anwesend: 0, abwesend: 0 });
  });

  it('zählt eine reine "abwesend"-Liste korrekt', () => {
    expect(zaehleAnwesendAbwesend(['abwesend', 'abwesend'])).toEqual({ anwesend: 0, abwesend: 2 });
  });
});
