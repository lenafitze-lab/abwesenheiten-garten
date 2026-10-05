import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { FehlerPage } from './fehler.page';

function baueFixture(typ: string | null): ComponentFixture<FehlerPage> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideIonicAngular(),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(typ ? { typ } : {}) } },
      },
    ],
  });
  const fixture = TestBed.createComponent(FehlerPage);
  fixture.detectChanges();
  return fixture;
}

describe('FehlerPage', () => {
  it('zeigt die 404-Meldung bei unbekanntem Typ', () => {
    const fixture = baueFixture('irgendwas');
    expect(fixture.componentInstance.inhalt().titel).toBe('Seite nicht gefunden');
  });

  it('zeigt die 404-Meldung, wenn kein Typ übergeben wird', () => {
    const fixture = baueFixture(null);
    expect(fixture.componentInstance.inhalt().titel).toBe('Seite nicht gefunden');
  });

  it('zeigt die Berechtigungs-Meldung', () => {
    const fixture = baueFixture('keine-berechtigung');
    expect(fixture.componentInstance.inhalt().titel).toBe('Keine Berechtigung');
  });

  it('zeigt die Server-Fehler-Meldung', () => {
    const fixture = baueFixture('server');
    expect(fixture.componentInstance.inhalt().titel).toBe('Etwas ist schiefgelaufen');
  });
});
