import type { AbstractControl } from '@angular/forms';

/**
 * Liefert die Fehlermeldung für ein berührtes, ungültiges Formularfeld.
 * `fehlerNachrichten` wird der Reihe nach geprüft (erste passende
 * Fehler-Art gewinnt); trifft keine zu, greift `fallback`.
 */
export function feldFehler(
  control: AbstractControl,
  fallback: string,
  fehlerNachrichten: Record<string, string> = {},
): string | undefined {
  if (!control.touched || control.valid) {
    return undefined;
  }
  for (const [fehlerArt, nachricht] of Object.entries(fehlerNachrichten)) {
    if (control.hasError(fehlerArt)) {
      return nachricht;
    }
  }
  return fallback;
}

/** Liest die erste aus einem Datei-Input ausgewählte Datei aus, falls vorhanden. */
export function dateiAusEvent(event: Event): File | undefined {
  const input = event.target as HTMLInputElement;
  return input.files?.[0];
}

/** Lädt eine Bilddatei asynchron als Data-URL für eine Vorschau. */
export function bildVorschauLaden(datei: File, onGeladen: (dataUrl: string) => void): void {
  const reader = new FileReader();
  reader.onload = () => onGeladen(reader.result as string);
  reader.readAsDataURL(datei);
}
