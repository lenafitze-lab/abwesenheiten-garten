import { Injectable, signal } from '@angular/core';

export type Farbschema = 'Gelb' | 'Rot';

interface FarbschemaFarben {
  primary: string;
  primaryRgb: string;
  primaryContrast: string;
  primaryContrastRgb: string;
  primaryShade: string;
  primaryTint: string;
}

// Bewusst gedämpfte, nicht zu satte Töne (kein Neon-Gelb/-Rot), damit sich
// beide Schemata ruhig anfühlen und im Dark Mode nicht "stechen".
const FARBSCHEMA_FARBEN: Record<Farbschema, FarbschemaFarben> = {
  Gelb: {
    primary: '#d1a03a',
    primaryRgb: '209, 160, 58',
    primaryContrast: '#000000',
    primaryContrastRgb: '0, 0, 0',
    primaryShade: '#b88d33',
    primaryTint: '#d6a94e',
  },
  Rot: {
    primary: '#c05a5a',
    primaryRgb: '192, 90, 90',
    primaryContrast: '#ffffff',
    primaryContrastRgb: '255, 255, 255',
    primaryShade: '#a94f4f',
    primaryTint: '#c96f6f',
  },
};

// Im Dark Mode entsättigtes Gelb statt des für den Hellmodus gewählten Tons -
// auf dunklem Grund "leuchtet" das helle Gelb sonst unangenehm. Wird per JS
// (nicht per CSS) angewendet, weil wendeFarbschemaAn() die Farbe als
// Inline-Style setzt, das jede CSS-Regel für --ion-color-primary übersticht;
// eine reine :root.ion-palette-dark-Regel würde hier also nie greifen. Rot
// bleibt unverändert, da dafür kein separater Dark-Mode-Ton verlangt wurde.
const FARBSCHEMA_FARBEN_DARK: Partial<Record<Farbschema, FarbschemaFarben>> = {
  Gelb: {
    primary: '#e0b34c',
    primaryRgb: '224, 179, 76',
    primaryContrast: '#000000',
    primaryContrastRgb: '0, 0, 0',
    primaryShade: '#c59e43',
    primaryTint: '#e3bb5e',
  },
};

// Textfarbe für Badges mit halbtransparentem Akzent-Hintergrund
// (rgba(--ion-color-primary-rgb, 0.15), z.B. .typ-label "ANLASS"/"TRAINING").
// Ein Accessibility-Audit hat hier zu geringen Kontrast bemängelt: die volle
// Akzentfarbe als Text auf ihrem eigenen 15%-Tint ergibt in Hell wie Dunkel
// oft nur 2-4:1 statt der geforderten 4.5:1. Deutlich dunklerer (hell) bzw.
// hellerer (dunkel) Ton derselben Farbfamilie statt eines abgedunkelten
// Hintergrunds, damit der dezente Look erhalten bleibt. Für Gelb im Dark
// Mode reicht bereits der normale Akzentton (~6.3:1), deshalb dort identisch
// zu primary.
const BADGE_TEXT_FARBEN: Record<Farbschema, { light: string; dark: string }> = {
  Gelb: { light: '#5b4212', dark: '#e0b34c' },
  Rot: { light: '#8a3a3a', dark: '#e29b9b' },
};

const DARK_MODE_STORAGE_KEY = 'app-dark-mode';
const FARBSCHEMA_STORAGE_KEY = 'app-farbschema';

// Statusleisten-Farbe pro Farbschema und Hell-/Dunkelmodus. Betrifft primär
// Android, das die theme-color direkt als Statusleisten-Hintergrund
// übernimmt - iOS bleibt beim bereits umgesetzten black-translucent-Ansatz
// (transparent, folgt automatisch dem tatsächlichen Seitenhintergrund) und
// ignoriert diesen Wert für die Statusleiste selbst.
const STATUS_BAR_FARBEN: Record<Farbschema, { light: string; dark: string }> = {
  Gelb: { light: '#f5dfae', dark: '#2a2410' },
  Rot: { light: '#f7d9d3', dark: '#3a1e1a' },
};

/**
 * Verwaltet Darkmode und Farbschema als App-weiten State. Wendet die
 * Einstellungen direkt als CSS-Custom-Properties auf das Root-Element an,
 * damit sie ohne Neuladen greifen, und merkt sie sich in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private readonly _isDark = signal(this.leseGespeichertenDarkMode());
  private readonly _farbschema = signal<Farbschema>(this.leseGespeichertesFarbschema());

  readonly isDark = this._isDark.asReadonly();
  readonly farbschema = this._farbschema.asReadonly();

  constructor() {
    this.wendeDarkModeAn(this._isDark());
    this.wendeFarbschemaAn(this._farbschema());
    this.aktualisiereStatusBarFarbe();
  }

  toggleDarkMode(): void {
    const naechsterWert = !this._isDark();
    this._isDark.set(naechsterWert);
    localStorage.setItem(DARK_MODE_STORAGE_KEY, String(naechsterWert));
    this.wendeDarkModeAn(naechsterWert);
    // Die Farbschema-Farbe wird als Inline-Style gesetzt (siehe unten) und
    // übersticht damit jede CSS-Regel für --ion-color-primary - beim
    // Umschalten muss sie deshalb explizit mit dem neuen Dark-Mode-Wert
    // neu angewendet werden, sonst bleibt z.B. Gelb auch im Dark Mode hell.
    this.wendeFarbschemaAn(this._farbschema());
    this.aktualisiereStatusBarFarbe();
  }

  setFarbschema(schema: Farbschema): void {
    this._farbschema.set(schema);
    localStorage.setItem(FARBSCHEMA_STORAGE_KEY, schema);
    this.wendeFarbschemaAn(schema);
    this.aktualisiereStatusBarFarbe();
  }

  private wendeDarkModeAn(dark: boolean): void {
    document.documentElement.classList.toggle('ion-palette-dark', dark);
  }

  // Statusleisten-Farbe hängt von ZWEI unabhängigen Einstellungen ab
  // (Farbschema UND Hell-/Dunkelmodus) - deshalb ein eigener Schritt, der
  // nach jeder Änderung an einer der beiden neu aufgerufen wird, statt die
  // Logik in wendeDarkModeAn()/wendeFarbschemaAn() zu duplizieren.
  private aktualisiereStatusBarFarbe(): void {
    const farben = STATUS_BAR_FARBEN[this._farbschema()];
    this.setStatusBarColor(this._isDark() ? farben.dark : farben.light);
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

  private wendeFarbschemaAn(schema: Farbschema): void {
    const farben = (this._isDark() ? FARBSCHEMA_FARBEN_DARK[schema] : undefined) ?? FARBSCHEMA_FARBEN[schema];
    const root = document.documentElement.style;
    root.setProperty('--ion-color-primary', farben.primary);
    root.setProperty('--ion-color-primary-rgb', farben.primaryRgb);
    root.setProperty('--ion-color-primary-contrast', farben.primaryContrast);
    root.setProperty('--ion-color-primary-contrast-rgb', farben.primaryContrastRgb);
    root.setProperty('--ion-color-primary-shade', farben.primaryShade);
    root.setProperty('--ion-color-primary-tint', farben.primaryTint);

    const badgeText = BADGE_TEXT_FARBEN[schema];
    root.setProperty('--ion-color-primary-badge-text', this._isDark() ? badgeText.dark : badgeText.light);
  }

  private leseGespeichertenDarkMode(): boolean {
    const gespeichert = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (gespeichert !== null) {
      return gespeichert === 'true';
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  private leseGespeichertesFarbschema(): Farbschema {
    return localStorage.getItem(FARBSCHEMA_STORAGE_KEY) === 'Rot' ? 'Rot' : 'Gelb';
  }
}
