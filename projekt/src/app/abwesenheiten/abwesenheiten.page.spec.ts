import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideIonicAngular } from '@ionic/angular';

import { AbwesenheitenPage } from './abwesenheiten.page';
import { AuthService, AuthUser } from '../services/auth.service';

function baueTestbed(user: AuthUser | null): void {
  TestBed.configureTestingModule({
    providers: [
      provideIonicAngular(),
      { provide: AuthService, useValue: { currentUser: signal(user) } },
    ],
  });
}

function baueTestUser(role: AuthUser['role']): AuthUser {
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

describe('AbwesenheitenPage', () => {
  let component: AbwesenheitenPage;
  let fixture: ComponentFixture<AbwesenheitenPage>;

  it('sollte erstellt werden', async () => {
    baueTestbed(null);
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(AbwesenheitenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('zeigt den "+"-Button (istTrainer) nicht für Volti', async () => {
    baueTestbed(baueTestUser('Volti'));
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(AbwesenheitenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.istTrainer()).toBe(false);
  });

  it('zeigt den "+"-Button (istTrainer) nicht für Eltern', async () => {
    baueTestbed(baueTestUser('Eltern'));
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(AbwesenheitenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.istTrainer()).toBe(false);
  });

  it('zeigt den "+"-Button (istTrainer) für Trainer', async () => {
    baueTestbed(baueTestUser('Trainer'));
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(AbwesenheitenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.istTrainer()).toBe(true);
  });

  it('zeigt den "+"-Button (istTrainer) nicht ohne eingeloggte Person', async () => {
    baueTestbed(null);
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(AbwesenheitenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.istTrainer()).toBe(false);
  });
});
