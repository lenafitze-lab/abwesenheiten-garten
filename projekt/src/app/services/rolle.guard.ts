import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Role } from './auth.service';

/**
 * Schützt eine Route vor Rollen, die dort nichts verloren haben (z.B. eine
 * künftige Trainer-only-Seite). RLS blockt fremde Rollen zwar schon auf
 * DB-Ebene, aber ohne diesen Guard bekäme man beim direkten Aufruf der URL
 * nur kaputte/leere Inhalte statt einer verständlichen Meldung.
 */
export function rolleGuard(erlaubteRollen: Role[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const rolle = authService.currentUser()?.role;
    if (rolle && erlaubteRollen.includes(rolle)) {
      return true;
    }

    return router.createUrlTree(['/fehler/keine-berechtigung']);
  };
}
