import { SERIENTERMIN_HORIZONT_WOCHEN, generiereSerientermine } from './serientermin.utils';

describe('generiereSerientermine', () => {
  it('generiert wöchentliche Instanzen bis inkl. Verfalldatum', () => {
    const basis = {
      start: new Date(2026, 8, 3, 18, 15), // Donnerstag, 03.09.2026, 18:15
      ende: new Date(2026, 8, 3, 19, 45),
      verfalldatum: new Date(2026, 8, 24), // 3 Wochen später
    };

    const instanzen = generiereSerientermine(basis);

    expect(instanzen).toHaveLength(4); // 03.09, 10.09, 17.09, 24.09
    expect(instanzen[0].start).toEqual(new Date(2026, 8, 3, 18, 15));
    expect(instanzen[1].start).toEqual(new Date(2026, 8, 10, 18, 15));
    expect(instanzen[2].start).toEqual(new Date(2026, 8, 17, 18, 15));
    expect(instanzen[3].start).toEqual(new Date(2026, 8, 24, 18, 15));
  });

  it('schliesst eine Instanz genau am Verfalldatum noch ein', () => {
    const basis = {
      start: new Date(2026, 8, 3, 18, 15),
      ende: null,
      verfalldatum: new Date(2026, 8, 17, 18, 15),
    };

    const instanzen = generiereSerientermine(basis);

    expect(instanzen.map((i) => i.start.getTime())).toEqual([
      new Date(2026, 8, 3, 18, 15).getTime(),
      new Date(2026, 8, 10, 18, 15).getTime(),
      new Date(2026, 8, 17, 18, 15).getTime(),
    ]);
  });

  it('bricht kurz nach dem Verfalldatum ab (keine Instanz danach)', () => {
    const basis = {
      start: new Date(2026, 8, 3, 18, 15),
      ende: null,
      verfalldatum: new Date(2026, 8, 16, 18, 15), // 1 Tag vor der 3. Instanz
    };

    const instanzen = generiereSerientermine(basis);

    expect(instanzen).toHaveLength(2);
  });

  it('behält die Dauer (ende - start) in jeder Instanz bei', () => {
    const basis = {
      start: new Date(2026, 8, 3, 18, 15),
      ende: new Date(2026, 8, 3, 19, 45),
      verfalldatum: new Date(2026, 8, 17),
    };

    const instanzen = generiereSerientermine(basis);

    for (const instanz of instanzen) {
      expect(instanz.ende!.getTime() - instanz.start.getTime()).toBe(90 * 60 * 1000);
    }
  });

  it('behält den Wochentag in jeder Instanz bei', () => {
    const basis = {
      start: new Date(2026, 8, 3, 18, 15), // Donnerstag
      ende: null,
      verfalldatum: new Date(2026, 9, 1),
    };

    const instanzen = generiereSerientermine(basis);

    for (const instanz of instanzen) {
      expect(instanz.start.getDay()).toBe(basis.start.getDay());
    }
  });

  it('nutzt ohne Verfalldatum einen festen Horizont ab "jetzt"', () => {
    const jetzt = new Date(2026, 8, 1);
    const basis = {
      start: new Date(2026, 8, 3, 18, 15),
      ende: null,
      verfalldatum: null,
    };

    const instanzen = generiereSerientermine(basis, jetzt);
    const letzte = instanzen[instanzen.length - 1];

    const horizontMs = SERIENTERMIN_HORIZONT_WOCHEN * 7 * 24 * 60 * 60 * 1000;
    expect(letzte.start.getTime()).toBeLessThanOrEqual(jetzt.getTime() + horizontMs);
    expect(letzte.start.getTime() + 7 * 24 * 60 * 60 * 1000).toBeGreaterThan(jetzt.getTime() + horizontMs);
  });

  it('liefert bei einmaligem Termin (kein Dauerauftrag-Aufruf) trotzdem nur die erste Instanz, wenn Verfalldatum == Startdatum', () => {
    const basis = {
      start: new Date(2026, 8, 3, 18, 15),
      ende: new Date(2026, 8, 3, 19, 45),
      verfalldatum: new Date(2026, 8, 3, 18, 15),
    };

    expect(generiereSerientermine(basis)).toHaveLength(1);
  });
});
