import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wichtig: erst abwarten, bis Supabase die Session aus dem Storage gelesen
  // und das Profil geladen hat. Ohne das wird nach einem Kaltstart der PWA
  // (z.B. iPhone-Homescreen-Icon nach vollständigem Schliessen der App) das
  // isLoggedIn()-Signal synchron als "false" gelesen, obwohl im Hintergrund
  // noch eine gültige Session geladen wird - die Person würde fälschlicherweise
  // zur Anmeldung weitergeleitet.
  await authService.waitUntilReady();

  if (authService.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/auth/anmeldung']);
};
