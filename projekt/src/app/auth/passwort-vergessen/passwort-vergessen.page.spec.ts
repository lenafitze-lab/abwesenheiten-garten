import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PasswortVergessenPage } from './passwort-vergessen.page';
import { AuthService } from '../../services/auth.service';

describe('PasswortVergessenPage', () => {
  let component: PasswortVergessenPage;
  let fixture: ComponentFixture<PasswortVergessenPage>;
  let passwortVergessenMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    passwortVergessenMock = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { passwortVergessen: passwortVergessenMock } }],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswortVergessenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sollte erstellt werden', () => {
    expect(component).toBeTruthy();
  });

  it('markiert ein leeres E-Mail-Feld als Pflichtfeld', () => {
    const control = component.form.controls.email;
    control.markAsTouched();
    control.setValue('');
    expect(component.emailFehler()).toBe('E-Mail ist ein Pflichtfeld.');
  });

  it('lehnt eine ungültige E-Mail-Adresse ab', () => {
    const control = component.form.controls.email;
    control.markAsTouched();
    control.setValue('keine-email');
    expect(component.emailFehler()).toBe('Bitte eine gültige E-Mail-Adresse eingeben.');
  });

  it('zeigt bei einer gültigen E-Mail-Adresse keinen Fehler', () => {
    const control = component.form.controls.email;
    control.markAsTouched();
    control.setValue('test@example.com');
    expect(component.emailFehler()).toBeUndefined();
  });

  it('verhindert das Absenden bei ungültigem Formular', async () => {
    component.form.controls.email.setValue('keine-email');
    await component.onSubmit();
    expect(passwortVergessenMock).not.toHaveBeenCalled();
  });

  it('zeigt nach erfolgreichem Aufruf die neutrale Erfolgsmeldung an', async () => {
    component.form.controls.email.setValue('test@example.com');
    await component.onSubmit();
    expect(passwortVergessenMock).toHaveBeenCalledWith('test@example.com');
    expect(component.linkGesendet()).toBe(true);
  });
});
