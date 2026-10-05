import { TestBed } from '@angular/core/testing';
import { AppearanceService } from './appearance.service';

/**
 * Badges/Chips im Trainings-Tab binden ihre Farbe ausschliesslich über
 * `var(--ion-color-primary)` / `var(--ion-color-primary-rgb)`. Dieser Test
 * stellt sicher, dass genau diese Variablen beim Farbschema-Wechsel korrekt
 * gesetzt werden - das ist der Mechanismus, auf den sich das Badge-Rendering
 * für beide Farbschemata verlässt (in jsdom lässt sich das rgba()-Ergebnis
 * eines Elements nicht zuverlässig auslesen, deshalb wird hier direkt die
 * CSS-Variable geprüft statt eines Elements berechneten Stils).
 */
describe('AppearanceService', () => {
  let service: AppearanceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppearanceService);
  });

  it('setzt --ion-color-primary beim Schema "Gelb" auf den gedämpften Gelbton', () => {
    service.setFarbschema('Gelb');
    expect(document.documentElement.style.getPropertyValue('--ion-color-primary')).toBe('#d1a03a');
    expect(document.documentElement.style.getPropertyValue('--ion-color-primary-rgb')).toBe('209, 160, 58');
  });

  it('setzt --ion-color-primary beim Schema "Rot" auf den gedämpften Rotton', () => {
    service.setFarbschema('Rot');
    expect(document.documentElement.style.getPropertyValue('--ion-color-primary')).toBe('#c05a5a');
    expect(document.documentElement.style.getPropertyValue('--ion-color-primary-rgb')).toBe('192, 90, 90');
  });

  it('spiegelt das aktuelle Schema im "farbschema"-Signal', () => {
    service.setFarbschema('Rot');
    expect(service.farbschema()).toBe('Rot');
    service.setFarbschema('Gelb');
    expect(service.farbschema()).toBe('Gelb');
  });
});

/**
 * .typ-label zeigt Text in --ion-color-primary-badge-text auf einem
 * halbtransparenten --ion-color-primary-Hintergrund (rgba(..., 0.15)). Ein
 * Accessibility-Audit hat dafür zu geringen Kontrast gemeldet - dieser Test
 * stellt sicher, dass alle vier Kombinationen aus Farbschema (Gelb/Rot) und
 * Modus (Hell/Dunkel) einzeln auf den jeweils berechneten, ausreichend
 * kontrastreichen Ton gesetzt werden (nicht nur eine Kombination "zufällig"
 * passt, während eine andere weiterhin zu schwach bleibt).
 */
describe('AppearanceService - Badge-Textfarbe (Kontrast)', () => {
  let service: AppearanceService;

  beforeEach(() => {
    localStorage.removeItem('app-dark-mode');
    localStorage.removeItem('app-farbschema');
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppearanceService);
    if (service.isDark()) {
      service.toggleDarkMode();
    }
  });

  afterEach(() => {
    localStorage.removeItem('app-dark-mode');
    localStorage.removeItem('app-farbschema');
  });

  it('Gelb + Hell: dunkler Ockerton für ausreichenden Kontrast auf dem hellen Tint', () => {
    service.setFarbschema('Gelb');
    expect(document.documentElement.style.getPropertyValue('--ion-color-primary-badge-text')).toBe('#5b4212');
  });

  it('Gelb + Dunkel: der normale (bereits entsättigte) Akzentton reicht hier schon aus', () => {
    service.setFarbschema('Gelb');
    service.toggleDarkMode();
    expect(document.documentElement.style.getPropertyValue('--ion-color-primary-badge-text')).toBe('#e0b34c');
  });

  it('Rot + Hell: dunkler Rotton für ausreichenden Kontrast auf dem hellen Tint', () => {
    service.setFarbschema('Rot');
    expect(document.documentElement.style.getPropertyValue('--ion-color-primary-badge-text')).toBe('#8a3a3a');
  });

  it('Rot + Dunkel: heller Rotton für ausreichenden Kontrast auf dem dunklen Tint', () => {
    service.setFarbschema('Rot');
    service.toggleDarkMode();
    expect(document.documentElement.style.getPropertyValue('--ion-color-primary-badge-text')).toBe('#e29b9b');
  });
});

/**
 * index.html hält zwei theme-color-Tags bereit (je einer für
 * prefers-color-scheme: light/dark) als Startwert vor dem Laden dieses
 * Service. Da der Dark/Light-Modus UND das Farbschema in der App beide
 * manuell umgeschaltet werden, muss der Service nach JEDER der beiden
 * Änderungen BEIDE Tags aktiv auf denselben, zur aktuellen Kombination
 * passenden Wert setzen - sonst könnte bei einem Mismatch zwischen System-
 * und App-Einstellung weiterhin das falsche Tag "gewinnen", oder ein
 * Farbschema-Wechsel würde die Statusleiste gar nicht erst nachziehen.
 */
describe('AppearanceService - Statusleisten-Farbe (theme-color)', () => {
  let metaHell: HTMLMetaElement;
  let metaDunkel: HTMLMetaElement;

  beforeEach(() => {
    metaHell = document.createElement('meta');
    metaHell.setAttribute('name', 'theme-color');
    metaHell.setAttribute('media', '(prefers-color-scheme: light)');
    metaHell.setAttribute('content', '#ffffff');
    document.head.appendChild(metaHell);

    metaDunkel = document.createElement('meta');
    metaDunkel.setAttribute('name', 'theme-color');
    metaDunkel.setAttribute('media', '(prefers-color-scheme: dark)');
    metaDunkel.setAttribute('content', '#15161a');
    document.head.appendChild(metaDunkel);

    localStorage.removeItem('app-dark-mode');
    localStorage.removeItem('app-farbschema');
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    metaHell.remove();
    metaDunkel.remove();
    localStorage.removeItem('app-dark-mode');
    localStorage.removeItem('app-farbschema');
  });

  it('setzt beide theme-color-Tags auf den dunklen Farbschema-Ton beim Umschalten auf Dark Mode', () => {
    const service = TestBed.inject(AppearanceService);
    service.setFarbschema('Gelb');

    if (!service.isDark()) {
      service.toggleDarkMode();
    }

    expect(metaHell.getAttribute('content')).toBe('#2a2410');
    expect(metaDunkel.getAttribute('content')).toBe('#2a2410');
  });

  it('setzt beide theme-color-Tags auf den hellen Farbschema-Ton zurück beim Umschalten auf Light Mode', () => {
    const service = TestBed.inject(AppearanceService);
    service.setFarbschema('Gelb');

    if (!service.isDark()) {
      service.toggleDarkMode();
    }
    service.toggleDarkMode();

    expect(service.isDark()).toBe(false);
    expect(metaHell.getAttribute('content')).toBe('#f5dfae');
    expect(metaDunkel.getAttribute('content')).toBe('#f5dfae');
  });

  it('zieht die Statusleisten-Farbe auch bei einem reinen Farbschema-Wechsel (ohne Dark/Light-Wechsel) nach', () => {
    const service = TestBed.inject(AppearanceService);
    if (service.isDark()) {
      service.toggleDarkMode();
    }

    service.setFarbschema('Rot');
    expect(metaHell.getAttribute('content')).toBe('#f7d9d3');

    service.setFarbschema('Gelb');
    expect(metaHell.getAttribute('content')).toBe('#f5dfae');
  });
});
