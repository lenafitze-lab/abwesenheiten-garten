import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';

import { TerminErstellenComponent } from './termin-erstellen.component';

describe('TerminErstellenComponent', () => {
  let component: TerminErstellenComponent;
  let fixture: ComponentFixture<TerminErstellenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideIonicAngular()],
    }).compileComponents();

    fixture = TestBed.createComponent(TerminErstellenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sollte erstellt werden', () => {
    expect(component).toBeTruthy();
  });

  it('ist ungültig, solange Pflichtfelder (Typ/Titel/Datum/Startzeit) fehlen', () => {
    expect(component.form.invalid).toBe(true);
  });

  it('ist gültig, wenn alle Pflichtfelder gesetzt sind und kein Dauerauftrag aktiv ist', () => {
    component.form.setValue({
      typ: 'training',
      titel: 'Training',
      datum: '2026-09-10',
      startZeit: '18:15',
      endZeit: '19:45',
      endDatum: '',
      istDauerauftrag: false,
      verfalldatum: '',
      bemerkung: '',
    });
    expect(component.form.valid).toBe(true);
  });

  it('ist ungültig, wenn bei einem Training die Endzeit fehlt', () => {
    component.form.setValue({
      typ: 'training',
      titel: 'Training',
      datum: '2026-09-10',
      startZeit: '18:15',
      endZeit: '',
      endDatum: '',
      istDauerauftrag: false,
      verfalldatum: '',
      bemerkung: '',
    });
    expect(component.form.controls.endZeit.hasError('required')).toBe(true);
    expect(component.form.valid).toBe(false);
  });

  it('ist auch bei einem Anlass ungültig, wenn die Endzeit fehlt', () => {
    component.form.setValue({
      typ: 'anlass',
      titel: 'Turnier',
      datum: '2026-09-10',
      startZeit: '18:15',
      endZeit: '',
      endDatum: '',
      istDauerauftrag: false,
      verfalldatum: '',
      bemerkung: '',
    });
    expect(component.form.controls.endZeit.hasError('required')).toBe(true);
    expect(component.form.valid).toBe(false);
  });

  it('meldet einen Fehler, wenn die Endzeit vor der Startzeit liegt', () => {
    component.form.setValue({
      typ: 'training',
      titel: 'Training',
      datum: '2026-09-10',
      startZeit: '18:15',
      endZeit: '17:00',
      endDatum: '',
      istDauerauftrag: false,
      verfalldatum: '',
      bemerkung: '',
    });
    expect(component.form.hasError('endeVorStart')).toBe(true);
    expect(component.form.valid).toBe(false);
  });

  it('meldet keinen Endzeit-Fehler, wenn die Endzeit nach der Startzeit liegt', () => {
    component.form.setValue({
      typ: 'training',
      titel: 'Training',
      datum: '2026-09-10',
      startZeit: '18:15',
      endZeit: '19:45',
      endDatum: '',
      istDauerauftrag: false,
      verfalldatum: '',
      bemerkung: '',
    });
    expect(component.form.hasError('endeVorStart')).toBe(false);
  });

  it('meldet einen Fehler, wenn das Verfalldatum vor dem Startdatum liegt', () => {
    component.form.setValue({
      typ: 'training',
      titel: 'Training',
      datum: '2026-09-10',
      startZeit: '18:15',
      endZeit: '',
      endDatum: '',
      istDauerauftrag: true,
      verfalldatum: '2026-09-01',
      bemerkung: '',
    });
    expect(component.form.hasError('verfalldatumVorStart')).toBe(true);
  });

  it('meldet keinen Verfalldatum-Fehler, wenn es nach dem Startdatum liegt', () => {
    component.form.setValue({
      typ: 'training',
      titel: 'Training',
      datum: '2026-09-10',
      startZeit: '18:15',
      endZeit: '',
      endDatum: '',
      istDauerauftrag: true,
      verfalldatum: '2026-10-01',
      bemerkung: '',
    });
    expect(component.form.hasError('verfalldatumVorStart')).toBe(false);
  });

  it('meldet einen Fehler, wenn das Enddatum (mehrtägiger Anlass) vor dem Startdatum liegt', () => {
    component.form.setValue({
      typ: 'anlass',
      titel: 'Turnier',
      datum: '2026-09-05',
      startZeit: '09:00',
      endZeit: '',
      endDatum: '2026-09-01',
      istDauerauftrag: false,
      verfalldatum: '',
      bemerkung: '',
    });
    expect(component.form.hasError('endDatumVorStart')).toBe(true);
  });

  it('meldet keinen Enddatum-Fehler, wenn es nach dem Startdatum liegt', () => {
    component.form.setValue({
      typ: 'anlass',
      titel: 'Turnier',
      datum: '2026-09-05',
      startZeit: '09:00',
      endZeit: '',
      endDatum: '2026-09-06',
      istDauerauftrag: false,
      verfalldatum: '',
      bemerkung: '',
    });
    expect(component.form.hasError('endDatumVorStart')).toBe(false);
  });
});
