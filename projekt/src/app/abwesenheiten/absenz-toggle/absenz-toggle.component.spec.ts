import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';

import { AbsenzToggleComponent } from './absenz-toggle.component';
import { AbsenzenService } from '../../services/absenzen.service';

function baueFixture(): ComponentFixture<AbsenzToggleComponent> {
  const fixture = TestBed.createComponent(AbsenzToggleComponent);
  const component = fixture.componentInstance;
  component.eventId = 'event-1';
  component.profileId = 'profil-1';
  component.personName = 'Anika Müller';
  component.terminLabel = 'Training';
  component.status = 'anwesend';
  component.grund = null;
  component.istPrivat = true;
  fixture.detectChanges();
  return fixture;
}

describe('AbsenzToggleComponent', () => {
  let setzeAbsenzMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    setzeAbsenzMock = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        { provide: AbsenzenService, useValue: { setzeAbsenz: setzeAbsenzMock } },
      ],
    }).compileComponents();
  });

  it('zeigt beim Speichern einer Abwesenheit ohne Grund die Fehlermeldung an und speichert nicht', async () => {
    const fixture = baueFixture();
    const component = fixture.componentInstance;
    component.onStatusWechsel(true);
    fixture.detectChanges();

    await component.speichern();
    fixture.detectChanges();

    expect(component['grundFehler']()).toBe('Bitte einen Grund angeben.');
    const textarea = fixture.nativeElement.querySelector('.grund-feld');
    expect(textarea.classList.contains('ion-invalid')).toBe(true);
    expect(textarea.classList.contains('ion-touched')).toBe(true);
    expect(textarea.errorText).toBe('Bitte einen Grund angeben.');
    expect(setzeAbsenzMock).not.toHaveBeenCalled();
  });

  it('zeigt keine Fehlermeldung, solange das Feld nicht berührt/gespeichert wurde', () => {
    const fixture = baueFixture();
    const component = fixture.componentInstance;
    component.onStatusWechsel(true);
    fixture.detectChanges();

    expect(component['grundFehler']()).toBeUndefined();
  });

  it('speichert erfolgreich, sobald ein Grund eingegeben wurde', async () => {
    const fixture = baueFixture();
    const component = fixture.componentInstance;
    component.onStatusWechsel(true);
    component.onGrundChange('krank');
    fixture.detectChanges();

    await component.speichern();

    expect(component['grundFehler']()).toBeUndefined();
    expect(setzeAbsenzMock).toHaveBeenCalledWith('event-1', 'profil-1', 'abwesend', 'krank', true);
  });
});
