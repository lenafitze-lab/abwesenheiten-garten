import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProfilVervollstaendigenPage } from './profil-vervollstaendigen.page';
import { AuthService } from '../../services/auth.service';

describe('ProfilVervollstaendigenPage', () => {
  let component: ProfilVervollstaendigenPage;
  let fixture: ComponentFixture<ProfilVervollstaendigenPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
    }).compileComponents();

    // Pending-Registrierung simulieren, damit die Seite nicht zurück zur Registrierung leitet.
    TestBed.inject(AuthService).startRegistration('test@example.com', 'geheim123', {
      valid: true,
      role: 'Trainer',
      requiresRoleSelection: false,
    });

    fixture = TestBed.createComponent(ProfilVervollstaendigenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
