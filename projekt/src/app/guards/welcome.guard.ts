import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const HAS_SEEN_WELCOME_KEY = 'hasSeenWelcome';

/**
 * Steuert, ob die Willkommensseite angezeigt wird:
 * - Aktive Session vorhanden -> direkt in die App (tabs).
 * - Keine Session, aber Willkommensseite schon gesehen -> direkt zur Anmeldung.
 * - Sonst -> Willkommensseite anzeigen.
 */
export const welcomeGuard: CanActivateFn = async () => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabaseService.supabase.auth.getSession();
  console.log('[welcomeGuard] getSession() ergab Session vorhanden:', !!data.session);
  if (data.session) {
    router.navigateByUrl('/tabs/abwesenheiten', { replaceUrl: true });
    return false;
  }

  if (localStorage.getItem(HAS_SEEN_WELCOME_KEY)) {
    router.navigateByUrl('/auth/anmeldung', { replaceUrl: true });
    return false;
  }

  return true;
};
