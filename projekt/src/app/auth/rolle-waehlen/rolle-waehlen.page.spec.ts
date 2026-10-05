import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RolleWaehlenPage } from './rolle-waehlen.page';
import { AuthService } from '../../services/auth.service';

describe('RolleWaehlenPage', () => {
  let component: RolleWaehlenPage;
  let fixture: ComponentFixture<RolleWaehlenPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
    }).compileComponents();

    // Pending-Registrierung simulieren, damit die Seite nicht zurück zur Registrierung leitet.
    TestBed.inject(AuthService).startRegistration('test@example.com', 'geheim123', {
      valid: true,
      requiresRoleSelection: true,
    });

    fixture = TestBed.createComponent(RolleWaehlenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
