import { Injectable, signal } from '@angular/core';

/**
 * Verfolgt den Online-/Offline-Status des Browsers. Relevant, weil
 * Trainer/Eltern die App z.B. in der Reithalle mit schlechtem Empfang
 * öffnen - ohne Hinweis würden fehlgeschlagene Requests dort nur als leere
 * Listen oder generische Fehlermeldungen erscheinen.
 */
@Injectable({ providedIn: 'root' })
export class OfflineService {
  private readonly _istOnline = signal(navigator.onLine);
  readonly istOnline = this._istOnline.asReadonly();

  constructor() {
    window.addEventListener('online', () => this._istOnline.set(true));
    window.addEventListener('offline', () => this._istOnline.set(false));
  }
}
