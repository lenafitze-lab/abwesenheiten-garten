import { TestBed } from '@angular/core/testing';
import { AppearanceService } from './appearance.service';

/**
 * Das Farbschema ist fix Gelb und liegt ausschliesslich in
 * theme/variables.scss. Der Service darf --ion-color-primary deshalb nicht
 * mehr als Inline-Style setzen - ein Inline-Style würde die CSS-Werte
 * (inkl. des eigenen Dark-Mode-Gelbs) überstechen.
 */
describe('AppearanceService', () => {
  beforeEach(() => {
    localStorage.removeItem('app-dark-mode');
    document.documentElement.removeAttribute('style');
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.removeItem('app-dark-mode');
    localStorage.removeItem('app-farbschema');
  });

  it('entfernt beim Start eine alte Farbschema-Wahl aus localStorage', () => {
    localStorage.setItem('app-farbschema', 'Rot');
    TestBed.inject(AppearanceService);
    expect(localStorage.getItem('app-farbschema')).toBeNull();
  });

  it('setzt keine Akzentfarbe als Inline-Style, auch nicht beim Dark-Mode-Wechsel', () => {
    const service = TestBed.inject(AppearanceService);
    service.toggleDarkMode();
    service.toggleDarkMode();
    expect(document.documentElement.style.getPropertyValue('--ion-color-primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--ion-color-primary-badge-text')).toBe('');
  });

  it('schaltet die Klasse "ion-palette-dark" passend zum Dark-Mode-Signal', () => {
    const service = TestBed.inject(AppearanceService);
    const vorher = service.isDark();
    service.toggleDarkMode();
    expect(service.isDark()).toBe(!vorher);
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(!vorher);
    expect(localStorage.getItem('app-dark-mode')).toBe(String(!vorher));
  });
});

/**
 * index.html hält zwei theme-color-Tags bereit (je einer für
 * prefers-color-scheme: light/dark) als Startwert vor dem Laden dieses
 * Service. Da der Dark/Light-Modus in der App manuell umgeschaltet wird,
 * muss der Service nach jeder Änderung BEIDE Tags aktiv auf denselben Wert
 * setzen - sonst könnte bei einem Mismatch zwischen System- und
 * App-Einstellung weiterhin das falsche Tag "gewinnen".
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
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    metaHell.remove();
    metaDunkel.remove();
    localStorage.removeItem('app-dark-mode');
  });

  it('setzt beide theme-color-Tags auf den dunklen Gelbton beim Umschalten auf Dark Mode', () => {
    const service = TestBed.inject(AppearanceService);

    if (!service.isDark()) {
      service.toggleDarkMode();
    }

    expect(metaHell.getAttribute('content')).toBe('#2a2410');
    expect(metaDunkel.getAttribute('content')).toBe('#2a2410');
  });

  it('setzt beide theme-color-Tags auf den hellen Gelbton zurück beim Umschalten auf Light Mode', () => {
    const service = TestBed.inject(AppearanceService);

    if (!service.isDark()) {
      service.toggleDarkMode();
    }
    service.toggleDarkMode();

    expect(service.isDark()).toBe(false);
    expect(metaHell.getAttribute('content')).toBe('#f5dfae');
    expect(metaDunkel.getAttribute('content')).toBe('#f5dfae');
  });
});
