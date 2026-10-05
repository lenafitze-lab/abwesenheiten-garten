import { Role } from '../services/auth.service';

export type AbsenzStatus = 'anwesend' | 'abwesend';

export interface AbsenzSichtbarkeit {
  grund: string | null;
  istPrivat: boolean;
}

/**
 * Bestimmt, welchen Grund eine Rolle zu sehen bekommt. Trainer sehen immer
 * den echten Grund, ebenso die Person, deren eigener Eintrag es ist. Alle
 * anderen sehen ihn nur, wenn der Eintrag nicht privat ist - ausnahmslos,
 * auch beim eigenen Kind (das ist nie "der eigene Eintrag" einer Eltern-Person).
 */
export function sichtbarerGrund(
  rolle: Role | null,
  eintrag: AbsenzSichtbarkeit,
  istEigenerEintrag = false,
): string | null {
  if (rolle === 'Trainer' || istEigenerEintrag) {
    return eintrag.grund;
  }
  return eintrag.istPrivat ? null : eintrag.grund;
}

export interface AbsenzZaehler {
  anwesend: number;
  abwesend: number;
}

export function zaehleAnwesendAbwesend(stati: AbsenzStatus[]): AbsenzZaehler {
  return stati.reduce<AbsenzZaehler>(
    (zaehler, status) => {
      if (status === 'abwesend') {
        return { ...zaehler, abwesend: zaehler.abwesend + 1 };
      }
      return { ...zaehler, anwesend: zaehler.anwesend + 1 };
    },
    { anwesend: 0, abwesend: 0 },
  );
}

/** Bei "abwesend" ist der Grund Pflichtfeld (nicht leer/nicht nur Leerzeichen). */
export function istAbsenzGueltig(status: AbsenzStatus, grund: string): boolean {
  return status === 'anwesend' || grund.trim().length > 0;
}
