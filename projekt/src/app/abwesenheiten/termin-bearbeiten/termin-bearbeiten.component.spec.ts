import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideIonicAngular } from '@ionic/angular';

import { TerminBearbeitenComponent } from './termin-bearbeiten.component';
import { AbsenzenService } from '../../services/absenzen.service';
import { AuthService, AuthUser } from '../../services/auth.service';

function baueUser(role: AuthUser['role']): AuthUser {
  return {
    id: 'user-1',
    email: 'test@example.com',
    role,
    firstName: 'Test',
    lastName: 'Person',
    avatarDataUrl: null,
    group: 'Garten 1',
  };
}

function baueFixture(
  modus: 'einzeln' | 'serie',
  abgesagt = false,
  typLabel = 'Training',
): ComponentFixture<TerminBearbeitenComponent> {
  const fixture = TestBed.createComponent(TerminBearbeitenComponent);
  const component = fixture.componentInstance;
  component.modus = modus;
  component.eventId = 'event-1';
  component.basisId = 'basis-1';
  component.titel = 'Training';
  component.typLabel = typLabel;
  component.datum = '2026-09-10';
  component.startZeit = '18:15';
  component.endZeit = '19:45';
  component.bemerkung = null;
  component.abgesagt = abgesagt;
  fixture.detectChanges();
  return fixture;
}

describe('TerminBearbeitenComponent', () => {
  let aktualisiereEinzelnesElementMock: ReturnType<typeof vi.fn>;
  let aktualisiereSerieMock: ReturnType<typeof vi.fn>;
  let sageTerminAbMock: ReturnType<typeof vi.fn>;
  let loescheEinzelnesElementMock: ReturnType<typeof vi.fn>;
  let loescheSerieMock: ReturnType<typeof vi.fn>;
  let currentUserSignal: ReturnType<typeof signal<AuthUser | null>>;

  beforeEach(async () => {
    aktualisiereEinzelnesElementMock = vi.fn().mockResolvedValue(undefined);
    aktualisiereSerieMock = vi.fn().mockResolvedValue(undefined);
    sageTerminAbMock = vi.fn().mockResolvedValue(undefined);
    loescheEinzelnesElementMock = vi.fn().mockResolvedValue(undefined);
    loescheSerieMock = vi.fn().mockResolvedValue(undefined);
    currentUserSignal = signal<AuthUser | null>(baueUser('Trainer'));

    await TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        {
          provide: AbsenzenService,
          useValue: {
            aktualisiereEinzelnesElement: aktualisiereEinzelnesElementMock,
            aktualisiereSerie: aktualisiereSerieMock,
            sageTerminAb: sageTerminAbMock,
            loescheEinzelnesElement: loescheEinzelnesElementMock,
            loescheSerie: loescheSerieMock,
          },
        },
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
      ],
    }).compileComponents();
  });

  it('sollte erstellt werden und die Eingabewerte vorausfüllen', () => {
    const fixture = baueFixture('einzeln');
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
    expect(component.form.controls.titel.value).toBe('Training');
    expect(component.form.controls.startZeit.value).toBe('18:15');
  });

  it('meldet einen Fehler, wenn die Endzeit vor der Startzeit liegt', () => {
    const fixture = baueFixture('einzeln');
    const component = fixture.componentInstance;
    component.form.controls.endZeit.setValue('17:00');
    expect(component.form.hasError('endeVorStart')).toBe(true);
  });

  it('deaktiviert das Datumsfeld im Serie-Modus', () => {
    const fixture = baueFixture('serie');
    const component = fixture.componentInstance;
    expect(component.form.controls.datum.disabled).toBe(true);
  });

  it('lässt das Datumsfeld im Einzeln-Modus aktiv', () => {
    const fixture = baueFixture('einzeln');
    const component = fixture.componentInstance;
    expect(component.form.controls.datum.disabled).toBe(false);
  });

  it('ruft im Einzeln-Modus aktualisiereEinzelnesElement mit der eventId auf', async () => {
    const fixture = baueFixture('einzeln');
    const component = fixture.componentInstance;
    await component.speichern();
    expect(aktualisiereEinzelnesElementMock).toHaveBeenCalledWith(
      'event-1',
      '2026-09-10',
      expect.objectContaining({ titel: 'Training', startZeit: '18:15', endZeit: '19:45' }),
    );
    expect(aktualisiereSerieMock).not.toHaveBeenCalled();
  });

  it('ruft im Serie-Modus aktualisiereSerie mit der basisId auf', async () => {
    const fixture = baueFixture('serie');
    const component = fixture.componentInstance;
    await component.speichern();
    expect(aktualisiereSerieMock).toHaveBeenCalledWith(
      'basis-1',
      expect.objectContaining({ titel: 'Training', startZeit: '18:15', endZeit: '19:45' }),
    );
    expect(aktualisiereEinzelnesElementMock).not.toHaveBeenCalled();
  });

  it('zeigt den "<Typ> absagen"-Button für eine Trainer-Person', () => {
    const fixture = baueFixture('einzeln');
    const button = fixture.nativeElement.querySelector('.absagen-button');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Training absagen');
  });

  it('zeigt den Absagen-Button nicht für Volti', () => {
    currentUserSignal.set(baueUser('Volti'));
    const fixture = baueFixture('einzeln');
    expect(fixture.nativeElement.querySelector('.absagen-button')).toBeNull();
  });

  it('zeigt den Absagen-Button nicht für Eltern', () => {
    currentUserSignal.set(baueUser('Eltern'));
    const fixture = baueFixture('einzeln');
    expect(fixture.nativeElement.querySelector('.absagen-button')).toBeNull();
  });

  it('zeigt den Absagen-Button nicht, wenn der Termin bereits abgesagt ist', () => {
    const fixture = baueFixture('einzeln', true);
    expect(fixture.nativeElement.querySelector('.absagen-button')).toBeNull();
  });

  it('setzt bei Bestätigung der Absage abgesagt über den Service und schliesst das Modal mit Rolle "abgesagt"', async () => {
    const fixture = baueFixture('einzeln');
    const component = fixture.componentInstance;
    const dismissSpy = vi.spyOn(component['modalController'], 'dismiss');

    await component['bestaetigeAbsagen']();

    expect(sageTerminAbMock).toHaveBeenCalledWith('event-1');
    expect(dismissSpy).toHaveBeenCalledWith(null, 'abgesagt');
  });

  it('ruft bei einem Absage-Fehler sageTerminAb auf, schliesst das Modal aber nicht', async () => {
    sageTerminAbMock.mockRejectedValueOnce(new Error('Netzwerkfehler'));
    const fixture = baueFixture('einzeln');
    const component = fixture.componentInstance;
    const dismissSpy = vi.spyOn(component['modalController'], 'dismiss');

    await component['bestaetigeAbsagen']();

    expect(sageTerminAbMock).toHaveBeenCalledWith('event-1');
    expect(dismissSpy).not.toHaveBeenCalled();
  });

  it('zeigt beim Speichern eines zuvor abgesagten Termins (Einzeln-Modus) den Reaktivierungs-Toast', async () => {
    const fixture = baueFixture('einzeln', true);
    const component = fixture.componentInstance;
    const toastSpy = vi.spyOn(component['toastController'], 'create');

    await component.speichern();

    expect(aktualisiereEinzelnesElementMock).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Training wurde wieder aktiviert.' }),
    );
  });

  it('zeigt beim normalen Speichern eines nicht abgesagten Termins weiterhin den Standard-Toast', async () => {
    const fixture = baueFixture('einzeln', false);
    const component = fixture.componentInstance;
    const toastSpy = vi.spyOn(component['toastController'], 'create');

    await component.speichern();

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Änderungen wurden gespeichert.' }),
    );
  });

  it('zeigt im Serie-Modus auch bei abgesagt=true den Standard-Toast (Reset gilt nur für aktualisiereEinzelnesElement)', async () => {
    const fixture = baueFixture('serie', true);
    const component = fixture.componentInstance;
    const toastSpy = vi.spyOn(component['toastController'], 'create');

    await component.speichern();

    expect(aktualisiereSerieMock).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Änderungen wurden gespeichert.' }),
    );
  });

  it('funktioniert identisch für einen Anlass: zeigt "Anlass absagen" und reaktiviert mit passendem Toast-Text', async () => {
    const fixture = baueFixture('einzeln', false, 'Anlass');
    const button = fixture.nativeElement.querySelector('.absagen-button');
    expect(button.textContent).toContain('Anlass absagen');

    const fixtureAbgesagt = baueFixture('einzeln', true, 'Anlass');
    const component = fixtureAbgesagt.componentInstance;
    const toastSpy = vi.spyOn(component['toastController'], 'create');

    await component.speichern();

    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Anlass wurde wieder aktiviert.' }));
  });

  it('zeigt den "<Typ> löschen"-Button für eine Trainer-Person, auch wenn der Termin bereits abgesagt ist', () => {
    const fixture = baueFixture('einzeln', true);
    const button = fixture.nativeElement.querySelector('.loeschen-button');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Training löschen');
  });

  it('zeigt den Löschen-Button nicht für Volti', () => {
    currentUserSignal.set(baueUser('Volti'));
    const fixture = baueFixture('einzeln');
    expect(fixture.nativeElement.querySelector('.loeschen-button')).toBeNull();
  });

  it('zeigt den Löschen-Button nicht für Eltern', () => {
    currentUserSignal.set(baueUser('Eltern'));
    const fixture = baueFixture('einzeln');
    expect(fixture.nativeElement.querySelector('.loeschen-button')).toBeNull();
  });

  it('öffnet vor dem Löschen einen Bestätigungsdialog mit Warnung zu den Abwesenheiten-Einträgen', async () => {
    const fixture = baueFixture('einzeln');
    const component = fixture.componentInstance;
    const createSpy = vi.spyOn(component['alertController'], 'create').mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
    } as never);

    await component.loeschen();

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'Training wirklich löschen?',
        message: expect.stringContaining('Anwesend-/Abwesend-Einträge unwiderruflich entfernt'),
      }),
    );
    expect(loescheEinzelnesElementMock).not.toHaveBeenCalled();
  });

  it('weist im Serie-Modus im Bestätigungsdialog zusätzlich auf die Serie hin', async () => {
    const fixture = baueFixture('serie');
    const component = fixture.componentInstance;
    const createSpy = vi.spyOn(component['alertController'], 'create').mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
    } as never);

    await component.loeschen();

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('alle zukünftigen Termine dieser Serie entfernt'),
      }),
    );
  });

  it('löscht im Einzeln-Modus nur diesen einen Termin und schliesst das Modal mit Rolle "geloescht"', async () => {
    const fixture = baueFixture('einzeln');
    const component = fixture.componentInstance;
    const dismissSpy = vi.spyOn(component['modalController'], 'dismiss');

    await component['bestaetigeLoeschen']();

    expect(loescheEinzelnesElementMock).toHaveBeenCalledWith('event-1');
    expect(loescheSerieMock).not.toHaveBeenCalled();
    expect(dismissSpy).toHaveBeenCalledWith(null, 'geloescht');
  });

  it('löscht im Serie-Modus die ganze (zukünftige) Serie über die basisId', async () => {
    const fixture = baueFixture('serie');
    const component = fixture.componentInstance;

    await component['bestaetigeLoeschen']();

    expect(loescheSerieMock).toHaveBeenCalledWith('basis-1');
    expect(loescheEinzelnesElementMock).not.toHaveBeenCalled();
  });

  it('schliesst das Modal bei einem Lösch-Fehler nicht', async () => {
    loescheEinzelnesElementMock.mockRejectedValueOnce(new Error('Netzwerkfehler'));
    const fixture = baueFixture('einzeln');
    const component = fixture.componentInstance;
    const dismissSpy = vi.spyOn(component['modalController'], 'dismiss');

    await component['bestaetigeLoeschen']();

    expect(dismissSpy).not.toHaveBeenCalled();
  });
});
