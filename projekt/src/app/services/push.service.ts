import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SupabaseService } from './supabase.service';

/**
 * Was der Profil-Schalter anzeigen soll:
 * - "ios-installieren": iPhone/iPad im Browser - Web Push geht dort nur als installierte App
 * - "nicht-unterstuetzt": Browser kann kein Web Push (oder Service Worker inaktiv, z.B. bei ng serve)
 * - "nicht-eingerichtet": kein VAPID-Key in der Environment hinterlegt
 * - "blockiert": Person hat die Berechtigung im Browser verweigert
 * - "verfuegbar": Schalter kann benutzt werden
 */
export type PushZustand = 'ios-installieren' | 'nicht-unterstuetzt' | 'nicht-eingerichtet' | 'blockiert' | 'verfuegbar';

/**
 * Web-Push-Benachrichtigungen über den Angular Service Worker. Die
 * Browser-Berechtigung wird nur über aktivieren() angefragt (also erst nach
 * einem Klick auf den Schalter), nie automatisch beim App-Start.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly swPush = inject(SwPush);
  private readonly supabaseService = inject(SupabaseService);

  private readonly _berechtigung = signal<NotificationPermission | null>(this.leseBerechtigung());
  private readonly _aktiv = signal(false);

  /** true, wenn dieses Gerät eine Subscription hat UND sie für die angemeldete Person gespeichert ist. */
  readonly aktiv = this._aktiv.asReadonly();

  readonly zustand = computed<PushZustand>(() => {
    if (istIos() && !istStandalone()) {
      return 'ios-installieren';
    }
    if (!this.swPush.isEnabled || !('PushManager' in window) || this._berechtigung() === null) {
      return 'nicht-unterstuetzt';
    }
    if (!environment.vapidPublicKey) {
      return 'nicht-eingerichtet';
    }
    if (this._berechtigung() === 'denied') {
      return 'blockiert';
    }
    return 'verfuegbar';
  });

  constructor() {
    if (this.swPush.isEnabled) {
      this.swPush.subscription
        .pipe(takeUntilDestroyed(inject(DestroyRef)))
        .subscribe((sub) => void this.pruefeGespeichert(sub));
    }
  }

  async aktivieren(): Promise<void> {
    let sub: PushSubscription;
    try {
      sub = await this.swPush.requestSubscription({ serverPublicKey: environment.vapidPublicKey });
    } catch {
      this._berechtigung.set(this.leseBerechtigung());
      if (this._berechtigung() === 'denied') {
        throw new Error(
          'Benachrichtigungen sind im Browser blockiert. Du kannst sie in den Website-Einstellungen wieder erlauben.',
        );
      }
      throw new Error('Benachrichtigungen wurden nicht erlaubt.');
    }
    this._berechtigung.set(this.leseBerechtigung());

    const schluessel = sub.toJSON().keys ?? {};
    const { error } = await this.supabaseService.supabase.rpc('push_subscription_speichern', {
      p_endpoint: sub.endpoint,
      p_p256dh: schluessel['p256dh'],
      p_auth: schluessel['auth'],
    });
    if (error) {
      await this.swPush.unsubscribe().catch(() => undefined);
      this._aktiv.set(false);
      throw new Error('Benachrichtigungen konnten nicht gespeichert werden. Bitte versuche es später nochmals.');
    }
    this._aktiv.set(true);
  }

  /** Entfernt die Subscription dieses Geräts aus der Datenbank und im Browser. */
  async deaktivieren(): Promise<void> {
    if (!this.swPush.isEnabled) {
      return;
    }
    const sub = await firstValueFrom(this.swPush.subscription);
    if (sub) {
      // Auch wenn das Löschen in der DB scheitert, im Browser abmelden: der
      // Endpoint wird damit ungültig und send-push räumt die Zeile beim
      // nächsten Versand (410) selbst auf.
      await this.supabaseService.supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await this.swPush.unsubscribe();
    }
    this._aktiv.set(false);
  }

  /**
   * Vor dem Abmelden/Löschen aufrufen: sonst bekäme die nächste Person, die
   * sich auf diesem Gerät anmeldet, weiterhin die Nachrichten der vorherigen.
   */
  async geraetAbmelden(): Promise<void> {
    try {
      await this.deaktivieren();
    } catch {
      // Abmelden darf daran nie scheitern.
    }
  }

  private async pruefeGespeichert(sub: PushSubscription | null): Promise<void> {
    if (!sub) {
      this._aktiv.set(false);
      return;
    }
    const { data } = await this.supabaseService.supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', sub.endpoint)
      .maybeSingle();
    this._aktiv.set(Boolean(data));
  }

  private leseBerechtigung(): NotificationPermission | null {
    return typeof Notification === 'undefined' ? null : Notification.permission;
  }
}

function istIos(): boolean {
  // iPadOS meldet sich als "MacIntel", unterscheidet sich aber durch Touch.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function istStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
