import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PasswortZuruecksetzenPage } from './passwort-zuruecksetzen.page';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';

function baueSupabaseServiceMock(session: { session: object | null }) {
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: session }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
    },
  };
}

describe('PasswortZuruecksetzenPage', () => {
  describe('mit gültigem Recovery-Token (aktive Session)', () => {
    let component: PasswortZuruecksetzenPage;
    let fixture: ComponentFixture<PasswortZuruecksetzenPage>;
    let neuesPasswortSetzenMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      neuesPasswortSetzenMock = vi.fn().mockResolvedValue(undefined);

      await TestBed.configureTestingModule({
        // Ziel-Route registriert, damit die navigateByUrl()-Weiterleitung nach
        // erfolgreichem Setzen im Test auflöst statt mit NG04002 abzulehnen.
        providers: [
          provideRouter([{ path: 'auth/anmeldung', component: PasswortZuruecksetzenPage }]),
          {
            provide: AuthService,
            useValue: { neuesPasswortSetzen: neuesPasswortSetzenMock, logout: vi.fn().mockResolvedValue(undefined) },
          },
          { provide: SupabaseService, useValue: baueSupabaseServiceMock({ session: { user: { id: 'u1' } } }) },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(PasswortZuruecksetzenPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('erkennt den Token als gültig und zeigt das Formular', () => {
      expect(component.tokenWirdGeprueft()).toBe(false);
      expect(component.tokenGueltig()).toBe(true);
    });

    it('verlangt mindestens 6 Zeichen beim neuen Passwort', () => {
      const control = component.form.controls.neuesPasswort;
      control.markAsTouched();
      control.setValue('abc');
      expect(component.neuesPasswortFehler()).toBe('Passwort muss mindestens 6 Zeichen lang sein.');
    });

    it('meldet Abweichung, wenn Passwort und Bestätigung nicht übereinstimmen', () => {
      component.form.controls.neuesPasswort.setValue('geheim123');
      const bestaetigung = component.form.controls.passwortBestaetigung;
      bestaetigung.markAsTouched();
      bestaetigung.setValue('anderesPasswort');
      expect(component.passwortBestaetigungFehler()).toBe('Die Passwörter stimmen nicht überein.');
    });

    it('akzeptiert übereinstimmende, ausreichend lange Passwörter', () => {
      component.form.controls.neuesPasswort.setValue('geheim123');
      const bestaetigung = component.form.controls.passwortBestaetigung;
      bestaetigung.markAsTouched();
      bestaetigung.setValue('geheim123');
      expect(component.passwortBestaetigungFehler()).toBeUndefined();
    });

    it('ruft neuesPasswortSetzen mit dem eingegebenen Passwort auf', async () => {
      component.form.controls.neuesPasswort.setValue('geheim123');
      component.form.controls.passwortBestaetigung.setValue('geheim123');
      await component.onSubmit();
      expect(neuesPasswortSetzenMock).toHaveBeenCalledWith('geheim123');
    });
  });

  describe('ohne gültigen Recovery-Token (keine Session)', () => {
    let component: PasswortZuruecksetzenPage;
    let fixture: ComponentFixture<PasswortZuruecksetzenPage>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: AuthService, useValue: { neuesPasswortSetzen: vi.fn(), logout: vi.fn() } },
          { provide: SupabaseService, useValue: baueSupabaseServiceMock({ session: null }) },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(PasswortZuruecksetzenPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('erkennt den fehlenden Token und zeigt das Formular nicht an', () => {
      expect(component.tokenWirdGeprueft()).toBe(false);
      expect(component.tokenGueltig()).toBe(false);
    });
  });
});
