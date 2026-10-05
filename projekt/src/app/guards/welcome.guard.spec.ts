import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HAS_SEEN_WELCOME_KEY, welcomeGuard } from './welcome.guard';
import { SupabaseService } from '../services/supabase.service';

describe('welcomeGuard', () => {
  let getSessionMock: ReturnType<typeof vi.fn>;
  let navigateByUrlMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.removeItem(HAS_SEEN_WELCOME_KEY);
    getSessionMock = vi.fn();
    navigateByUrlMock = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: { supabase: { auth: { getSession: getSessionMock } } },
        },
        { provide: Router, useValue: { navigateByUrl: navigateByUrlMock } },
      ],
    });
  });

  afterEach(() => {
    localStorage.removeItem(HAS_SEEN_WELCOME_KEY);
  });

  it('leitet bei aktiver Session direkt in die App weiter', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'abc' } } } });

    const ergebnis = await TestBed.runInInjectionContext(() =>
      welcomeGuard({} as never, {} as never),
    );

    expect(ergebnis).toBe(false);
    expect(navigateByUrlMock).toHaveBeenCalledWith('/tabs/abwesenheiten', { replaceUrl: true });
  });

  it('leitet ohne Session, aber mit gesetztem hasSeenWelcome-Flag zur Anmeldung weiter', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true');

    const ergebnis = await TestBed.runInInjectionContext(() =>
      welcomeGuard({} as never, {} as never),
    );

    expect(ergebnis).toBe(false);
    expect(navigateByUrlMock).toHaveBeenCalledWith('/auth/anmeldung', { replaceUrl: true });
  });

  it('zeigt die Willkommensseite, wenn weder Session noch Flag vorhanden sind', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    const ergebnis = await TestBed.runInInjectionContext(() =>
      welcomeGuard({} as never, {} as never),
    );

    expect(ergebnis).toBe(true);
    expect(navigateByUrlMock).not.toHaveBeenCalled();
  });
});
