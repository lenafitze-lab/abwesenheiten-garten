import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideIonicAngular } from '@ionic/angular';

import { TerminKarteComponent } from './termin-karte.component';
import { AbsenzenService, TeilnehmerAbsenz } from '../../services/absenzen.service';
import { AuthService, AuthUser } from '../../services/auth.service';

function baueTeilnehmer(): TeilnehmerAbsenz[] {
  return [
    { profileId: 'a1', vorname: 'Anika', nachname: 'Müller', status: 'anwesend', grund: null, istPrivat: true },
    { profileId: 'b2', vorname: 'Andreas', nachname: 'Hirt', status: 'abwesend', grund: 'krank', istPrivat: true },
  ];
}

function baueUser(role: AuthUser['role']): AuthUser {
  return {
    id: 'a1',
    email: 'test@example.com',
    role,
    firstName: 'Test',
    lastName: 'Person',
    avatarDataUrl: null,
    group: 'Garten 1',
  };
}

describe('TerminKarteComponent', () => {
  let component: TerminKarteComponent;
  let fixture: ComponentFixture<TerminKarteComponent>;
  let ladeTeilnehmerMock: ReturnType<typeof vi.fn>;
  let currentUserSignal: ReturnType<typeof signal<AuthUser | null>>;

  beforeEach(async () => {
    ladeTeilnehmerMock = vi.fn().mockResolvedValue(baueTeilnehmer());
    currentUserSignal = signal<AuthUser | null>(baueUser('Trainer'));

    await TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        {
          provide: AbsenzenService,
          useValue: {
            ladeTeilnehmer: ladeTeilnehmerMock,
            abonniereEvent: vi.fn().mockReturnValue({}),
            beendeAbo: vi.fn(),
          },
        },
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TerminKarteComponent);
    component = fixture.componentInstance;
    component.termin = {
      id: 'event-1',
      titel: 'Training',
      zeigeTitel: false,
      typLabel: 'Training',
      start: '2026-09-10T18:15:00.000Z',
      ende: '2026-09-10T19:45:00.000Z',
    };
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('sollte erstellt werden', () => {
    expect(component).toBeTruthy();
  });

  it('lädt die Zähler sofort, ohne dass eine Liste aufgeklappt werden muss', () => {
    expect(ladeTeilnehmerMock).toHaveBeenCalledWith('event-1');
    expect(component.zaehlerFuer('event-1')).toEqual({ anwesend: 1, abwesend: 1 });
  });

  it('klappt Anwesend- und Abwesend-Liste unabhängig voneinander auf/zu', () => {
    expect(component.istAnwesendOffen('event-1')).toBe(false);
    expect(component.istAbwesendOffen('event-1')).toBe(false);

    component.toggleAnwesend('event-1');
    expect(component.istAnwesendOffen('event-1')).toBe(true);
    expect(component.istAbwesendOffen('event-1')).toBe(false);

    component.toggleAbwesend('event-1');
    expect(component.istAnwesendOffen('event-1')).toBe(true);
    expect(component.istAbwesendOffen('event-1')).toBe(true);

    component.toggleAnwesend('event-1');
    expect(component.istAnwesendOffen('event-1')).toBe(false);
    expect(component.istAbwesendOffen('event-1')).toBe(true);
  });

  it('zeigt Trainern den echten Grund in der Abwesend-Zeile', () => {
    const abwesend = component.abwesendFuer('event-1')[0];
    expect(component.grundFuerAnzeige(abwesend)).toBe('krank');
  });

  it('zeigt Nicht-Trainern "privat" statt des echten Grundes', () => {
    currentUserSignal.set(baueUser('Volti'));
    const abwesend = component.abwesendFuer('event-1')[0];
    expect(component.grundFuerAnzeige(abwesend)).toBe('privat');
  });

  it('zeigt für Anwesend-Einträge keinen Grund an (nur in der Abwesend-Liste relevant)', () => {
    const anwesend = component.anwesendFuer('event-1')[0];
    expect(anwesend.grund).toBeNull();
  });

  it('stellt einen abgesagten Termin durchgestrichen dar, mit "Abgesagt"-Label, aber weiterhin bedienbarem Anwesend-/Abwesend-Bereich', () => {
    component.termin = {
      ...component.termin,
      zeigeTitel: true,
      abgesagt: true,
    };
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.abgesagt-label')?.textContent).toContain('Abgesagt');
    expect(element.querySelector('.titel')?.classList.contains('durchgestrichen')).toBe(true);
    expect(element.querySelector('.datum')?.classList.contains('durchgestrichen')).toBe(true);
    // Anwesend-/Abwesend-Bereich bleibt bei einer Absage bewusst sichtbar und
    // bedienbar - nur die Kopfzeile (Titel/Datum/Zeit) markiert die Absage.
    expect(element.querySelector('.status-zeile')).toBeTruthy();
    expect(element.querySelectorAll('.abschnitt').length).toBe(2);

    component.toggleAnwesend('event-1');
    fixture.detectChanges();
    expect(component.istAnwesendOffen('event-1')).toBe(true);
  });

  it('zeigt bei einem nicht abgesagten Termin weder Label noch Durchstreichung, dafür den Anwesend-/Abwesend-Bereich', () => {
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.abgesagt-label')).toBeNull();
    expect(element.querySelector('.status-zeile')).toBeTruthy();
  });

  describe('Bemerkung', () => {
    function baueFixtureMitBemerkung(bemerkung: string | null): ComponentFixture<TerminKarteComponent> {
      const bemerkungFixture = TestBed.createComponent(TerminKarteComponent);
      bemerkungFixture.componentInstance.termin = {
        id: 'event-2',
        titel: 'Training',
        zeigeTitel: false,
        typLabel: 'Training',
        start: '2026-09-10T18:15:00.000Z',
        ende: '2026-09-10T19:45:00.000Z',
        bemerkung,
      };
      return bemerkungFixture;
    }

    it('zeigt eine vorhandene Bemerkung standardmässig an, ohne Klick auf das Info-Icon', () => {
      const bemerkungFixture = baueFixtureMitBemerkung('Bitte Halle 2 statt Garten 1.');
      bemerkungFixture.detectChanges();

      const element = bemerkungFixture.nativeElement as HTMLElement;
      expect(element.querySelector('.bemerkung-box')?.textContent).toContain('Bitte Halle 2 statt Garten 1.');
      expect(bemerkungFixture.componentInstance.bemerkungOffen()).toBe(true);
    });

    it('blendet die Bemerkung über das Info-Icon aus (und wieder ein)', () => {
      const bemerkungFixture = baueFixtureMitBemerkung('Bitte Halle 2 statt Garten 1.');
      bemerkungFixture.detectChanges();
      const element = bemerkungFixture.nativeElement as HTMLElement;

      const infoButton = element.querySelector<HTMLElement>('.info-button');
      infoButton?.dispatchEvent(new Event('click'));
      bemerkungFixture.detectChanges();
      expect(bemerkungFixture.componentInstance.bemerkungOffen()).toBe(false);
      expect(element.querySelector('.bemerkung-box')).toBeNull();

      infoButton?.dispatchEvent(new Event('click'));
      bemerkungFixture.detectChanges();
      expect(bemerkungFixture.componentInstance.bemerkungOffen()).toBe(true);
      expect(element.querySelector('.bemerkung-box')).toBeTruthy();
    });

    it('bleibt ohne Bemerkung geschlossen und zeigt kein Info-Icon', () => {
      const bemerkungFixture = baueFixtureMitBemerkung(null);
      bemerkungFixture.detectChanges();

      expect(bemerkungFixture.componentInstance.bemerkungOffen()).toBe(false);
      expect((bemerkungFixture.nativeElement as HTMLElement).querySelector('.info-button')).toBeNull();
    });
  });

  describe('mehrtägiger Anlass (pro Tag eigene event_id)', () => {
    function baueTagFixture(): ComponentFixture<TerminKarteComponent> {
      const tagFixture = TestBed.createComponent(TerminKarteComponent);
      tagFixture.componentInstance.termin = {
        id: 'anlass-1',
        titel: 'Sommerlager',
        zeigeTitel: true,
        typLabel: 'Anlass',
        start: '2026-07-01T08:00:00.000Z',
        ende: '2026-07-03T17:00:00.000Z',
        tage: [
          {
            eventId: 'tag-1',
            label: 'Mittwoch',
            titel: 'Sommerlager',
            start: '2026-07-01T08:00:00.000Z',
            ende: '2026-07-01T17:00:00.000Z',
            bemerkung: null,
            abgesagt: true,
          },
          {
            eventId: 'tag-2',
            label: 'Donnerstag',
            titel: 'Sommerlager',
            start: '2026-07-02T08:00:00.000Z',
            ende: '2026-07-02T17:00:00.000Z',
            bemerkung: null,
            abgesagt: false,
          },
        ],
      };
      return tagFixture;
    }

    it('zeigt für jeden Tag einen eigenen Bearbeiten-Button für Trainer', async () => {
      const tagFixture = baueTagFixture();
      tagFixture.detectChanges();
      await tagFixture.whenStable();
      expect(tagFixture.nativeElement.querySelectorAll('.tag-gruppe .edit-termin-button').length).toBe(2);
    });

    it('zeigt den Bearbeiten-Button pro Tag nicht für Volti', async () => {
      currentUserSignal.set(baueUser('Volti'));
      const tagFixture = baueTagFixture();
      tagFixture.detectChanges();
      await tagFixture.whenStable();
      expect(tagFixture.nativeElement.querySelector('.tag-gruppe .edit-termin-button')).toBeNull();
    });

    it('stellt einen abgesagten Tag durchgestrichen mit eigenem "Abgesagt"-Label dar, unabhängig von den übrigen Tagen', async () => {
      const tagFixture = baueTagFixture();
      tagFixture.detectChanges();
      await tagFixture.whenStable();

      const tagGruppen = tagFixture.nativeElement.querySelectorAll('.tag-gruppe');
      expect(tagGruppen[0].querySelector('.tag-titel').classList.contains('durchgestrichen')).toBe(true);
      expect(tagGruppen[0].querySelector('.abgesagt-label')).toBeTruthy();
      expect(tagGruppen[1].querySelector('.tag-titel').classList.contains('durchgestrichen')).toBe(false);
      expect(tagGruppen[1].querySelector('.abgesagt-label')).toBeNull();
    });

    it('tagBearbeiten() öffnet das Bearbeiten-Formular direkt für diesen einen Tag, ohne Serie-Rückfrage', async () => {
      const tagFixture = baueTagFixture();
      tagFixture.detectChanges();
      await tagFixture.whenStable();
      const tagComponent = tagFixture.componentInstance;

      const createSpy = vi.spyOn(tagComponent['modalController'], 'create').mockResolvedValue({
        present: vi.fn().mockResolvedValue(undefined),
        onWillDismiss: vi.fn().mockResolvedValue({ role: undefined }),
      } as never);

      await tagComponent.tagBearbeiten(tagComponent.termin.tage![0]);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          componentProps: expect.objectContaining({
            modus: 'einzeln',
            eventId: 'tag-1',
            basisId: 'tag-1',
            typLabel: 'Anlass',
            abgesagt: true,
          }),
        }),
      );
    });
  });
});
