const WOCHE_IN_MS = 7 * 24 * 60 * 60 * 1000;

/** Horizont für Serientermine ohne Verfalldatum ("unbegrenzt" lässt sich
 * nicht als Liste rendern, deshalb ein praktisches Zeitfenster ab jetzt). */
export const SERIENTERMIN_HORIZONT_WOCHEN = 26;

export interface SerienterminBasis {
  start: Date;
  ende: Date | null;
  verfalldatum: Date | null;
}

export interface SerienterminInstanz {
  start: Date;
  ende: Date | null;
}

/**
 * Berechnet die wöchentlich wiederkehrenden Instanzen eines Dauerauftrags
 * ab dessen Startdatum, bis zum Verfalldatum (inklusive) - oder, falls
 * keins gesetzt ist, bis zu einem festen Horizont ab "jetzt".
 */
export function generiereSerientermine(
  basis: SerienterminBasis,
  jetzt: Date = new Date(),
): SerienterminInstanz[] {
  const dauerMs = basis.ende ? basis.ende.getTime() - basis.start.getTime() : null;
  // "verfalldatum" ist in der Datenbank ein reines Datum ohne Uhrzeit
  // (Mitternacht) - als Grenze zählt trotzdem der ganze Tag, sonst würde
  // ein Termin, der später am Verfalltag stattfindet, fälschlich fehlen.
  const grenze = basis.verfalldatum
    ? new Date(
        basis.verfalldatum.getFullYear(),
        basis.verfalldatum.getMonth(),
        basis.verfalldatum.getDate(),
        23,
        59,
        59,
        999,
      ).getTime()
    : jetzt.getTime() + SERIENTERMIN_HORIZONT_WOCHEN * WOCHE_IN_MS;

  const instanzen: SerienterminInstanz[] = [];
  let startZeit = basis.start.getTime();
  while (startZeit <= grenze) {
    instanzen.push({
      start: new Date(startZeit),
      ende: dauerMs !== null ? new Date(startZeit + dauerMs) : null,
    });
    startZeit += WOCHE_IN_MS;
  }
  return instanzen;
}
