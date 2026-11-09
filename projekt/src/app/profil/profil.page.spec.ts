import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular, ToggleCustomEvent } from '@ionic/angular';

import { ProfilPage } from './profil.page';
import { AuthService, AuthUser } from '../services/auth.service';
import { PushService, PushZustand } from '../services/push.service';
import { GRUPPEN_NAME } from '../shared/gruppe';

const USER: AuthUser = {
  id: 'user-1',
  email: 'anna@example.ch',
  role: 'Volti',
  firstName: 'Anna',
  lastName: 'Muster',
  avatarDataUrl: null,
  group: GRUPPEN_NAME,
};

function bauePushMock(zustand: PushZustand, aktiv = false) {
  const aktivSignal = signal(aktiv);
  return {
    zustand: signal(zustand),
    aktiv: aktivSignal,
    aktivieren: vi.fn(async () => aktivSignal.set(true)),
    deaktivieren: vi.fn(async () => aktivSignal.set(false)),
    geraetAbmelden: vi.fn(async () => undefined),
  };
}

function toggleEvent(checked: boolean): ToggleCustomEvent {
  return { detail: { checked }, target: { checked } } as unknown as ToggleCustomEvent;
}

describe('ProfilPage', () => {
  let fixture: ComponentFixture<ProfilPage>;
  let authMock: { currentUser: ReturnType<typeof signal<AuthUser | null>>; logout: ReturnType<typeof vi.fn> };

  async function erstelle(push: ReturnType<typeof bauePushMock>): Promise<HTMLElement> {
    authMock = { currentUser: signal<AuthUser | null>(USER), logout: vi.fn(async () => undefined) };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'auth/anmeldung', children: [] }]),
        provideIonicAngular(),
        { provide: AuthService, useValue: authMock },
        { provide: PushService, useValue: push },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function umschalten(event: ToggleCustomEvent): Promise<void> {
    return (fixture.componentInstance as unknown as { benachrichtigungenUmschalten(e: ToggleCustomEvent): Promise<void> })
      .benachrichtigungenUmschalten(event);
  }

  it('should create', async () => {
    await erstelle(bauePushMock('verfuegbar'));
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('Schalter «Benachrichtigungen»', () => {
    it('leitet den Zustand aus der echten Subscription ab', async () => {
      const element = await erstelle(bauePushMock('verfuegbar', true));
      const toggle = element.querySelector('ion-toggle') as HTMLIonToggleElement;
      expect(toggle).not.toBeNull();
      expect(toggle.checked).toBe(true);
    });

    it('Einschalten fragt erst jetzt die Berechtigung an (aktivieren), Ausschalten entfernt die Subscription', async () => {
      const push = bauePushMock('verfuegbar');
      await erstelle(push);
      expect(push.aktivieren).not.toHaveBeenCalled();

      await umschalten(toggleEvent(true));
      expect(push.aktivieren).toHaveBeenCalledTimes(1);

      await umschalten(toggleEvent(false));
      expect(push.deaktivieren).toHaveBeenCalledTimes(1);
    });

    it('zeigt bei einem Fehler eine verständliche Meldung und stellt den Schalter zurück', async () => {
      const push = bauePushMock('verfuegbar');
      push.aktivieren.mockRejectedValueOnce(new Error('Benachrichtigungen wurden nicht erlaubt.'));
      const element = await erstelle(push);

      const event = toggleEvent(true);
      await umschalten(event);
      fixture.detectChanges();

      expect(event.target.checked).toBe(false);
      expect(element.querySelector('.benachrichtigungen-fehler')?.textContent).toContain(
        'Benachrichtigungen wurden nicht erlaubt.',
      );
    });

    it('zeigt auf dem iPhone ohne installierte App einen Hinweis statt des Schalters', async () => {
      const element = await erstelle(bauePushMock('ios-installieren'));
      expect(element.querySelector('ion-toggle')).toBeNull();
      expect(element.querySelector('.benachrichtigungen-hinweis')?.textContent).toContain(
        'Benachrichtigungen funktionieren auf dem iPhone nur, wenn du die App über Teilen → Zum Home-Bildschirm installierst.',
      );
    });

    it.each([
      ['nicht-unterstuetzt', 'Dieser Browser unterstützt keine Benachrichtigungen.'],
      ['blockiert', 'Benachrichtigungen sind im Browser blockiert.'],
    ] as const)('zeigt bei "%s" eine Meldung statt des Schalters', async (zustand, text) => {
      const element = await erstelle(bauePushMock(zustand));
      expect(element.querySelector('ion-toggle')).toBeNull();
      expect(element.querySelector('.benachrichtigungen-hinweis')?.textContent).toContain(text);
    });

    it('meldet das Gerät beim Abmelden von Push ab, bevor die Session endet', async () => {
      const push = bauePushMock('verfuegbar', true);
      await erstelle(push);

      await (fixture.componentInstance as unknown as { abmelden(): Promise<void> }).abmelden();

      expect(push.geraetAbmelden).toHaveBeenCalled();
      expect(push.geraetAbmelden.mock.invocationCallOrder[0]).toBeLessThan(authMock.logout.mock.invocationCallOrder[0]);
    });
  });
});
