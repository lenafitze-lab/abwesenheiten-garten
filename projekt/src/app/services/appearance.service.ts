import { Injectable, signal } from '@angular/core';

const DARK_MODE_STORAGE_KEY = 'app-dark-mode';

// Früher wählbares Farbschema (Gelb/Rot). Gelb ist jetzt fix in
// theme/variables.scss hinterlegt; der alte Key wird beim Start entfernt,
// damit keine Reste einer früheren Rot-Wahl liegen bleiben.
const ALTER_FARBSCHEMA_STORAGE_KEY = 'app-farbschema';

// Statusleisten-Farbe pro Hell-/Dunkelmodus. Betrifft primär Android, das
// die theme-color direkt als Statusleisten-Hintergrund übernimmt - iOS
// bleibt beim bereits umgesetzten black-translucent-Ansatz (transparent,
// folgt automatisch dem tatsächlichen Seitenhintergrund) und ignoriert
// diesen Wert für die Statusleiste selbst.
const STATUS_BAR_FARBEN = { light: '#f5dfae', dark: '#2a2410' };

/**
 * Verwaltet den Darkmode als App-weiten State. Setzt die Klasse
 * "ion-palette-dark" auf das Root-Element, damit die Farben aus
 * theme/variables.scss ohne Neuladen greifen, und merkt sich die Wahl in
 * localStorage.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private readonly _isDark = signal(this.leseGespeichertenDarkMode());

  readonly isDark = this._isDark.asReadonly();

  constructor() {
    localStorage.removeItem(ALTER_FARBSCHEMA_STORAGE_KEY);
    this.wendeDarkModeAn(this._isDark());
  }

  toggleDarkMode(): void {
    const naechsterWert = !this._isDark();
    this._isDark.set(naechsterWert);
    localStorage.setItem(DARK_MODE_STORAGE_KEY, String(naechsterWert));
    this.wendeDarkModeAn(naechsterWert);
  }

  private wendeDarkModeAn(dark: boolean): void {
    document.documentElement.classList.toggle('ion-palette-dark', dark);
    this.setStatusBarColor(dark ? STATUS_BAR_FARBEN.dark : STATUS_BAR_FARBEN.light);
  }

  private setStatusBarColor(farbe: string): void {
    // index.html enthält ZWEI theme-color-Tags (je einen für
    // prefers-color-scheme: light/dark) als Startwert, bevor dieser Service
    // geladen ist. Welches der beiden Tags der Browser als "aktiv"
    // behandelt, richtet sich nach der System-Einstellung, nicht nach der
    // Reihenfolge im DOM - bei manuellem Umschalten (z.B. System hell, App
    // manuell auf dunkel) müssen deshalb BEIDE Tags auf denselben Wert
    // gesetzt werden, sonst gewinnt bei einem Mismatch weiterhin die
    // System-Einstellung statt der bewussten Wahl der Person.
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', farbe);
    });
  }

  private leseGespeichertenDarkMode(): boolean {
    const gespeichert = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (gespeichert !== null) {
      return gespeichert === 'true';
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
