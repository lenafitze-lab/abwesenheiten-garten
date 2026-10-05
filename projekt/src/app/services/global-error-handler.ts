import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Fängt Fehler ab, die sonst nirgendwo abgefangen wurden (z.B. eine
 * ungefangene Exception ausserhalb der üblichen try/catch-Blöcke in den
 * Seiten), damit nie eine leere weisse Seite erscheint, sondern immer
 * zumindest die generische Fehlerseite mit einer "Erneut versuchen"-Option.
 * Router wird bewusst erst lazy per Injector geholt (nicht im Constructor
 * injiziert), da ErrorHandler schon sehr früh beim App-Start erzeugt wird,
 * teils bevor der Router vollständig einsatzbereit ist.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly injector = inject(Injector);

  handleError(error: unknown): void {
    console.error('Unbehandelter Fehler:', error);

    // Verhindert eine Endlosschlaufe, falls die Fehlerseite selbst aus
    // irgendeinem Grund eine Exception werfen würde.
    if (window.location.pathname.startsWith('/fehler/')) {
      return;
    }

    const router = this.injector.get(Router);
    void router.navigateByUrl('/fehler/server');
  }
}
