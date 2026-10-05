import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FunctionsHttpError, Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export type Role = 'Volti' | 'Eltern' | 'Trainer';
type DbRolle = 'trainer' | 'volti' | 'eltern';

export interface InviteCodeResolution {
  valid: boolean;
  role?: Role;
  requiresRoleSelection: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role | null;
  firstName: string;
  lastName: string;
  avatarDataUrl: string | null;
  group: string;
}

// TODO: Ersetze die hartcodierten Codes durch eine echte Backend-Prüfung
// (z.B. eine "einladungscodes"-Tabelle in Supabase).
const GROUP_INVITE_CODE = 'GARTEN1-2026';
const TRAINER_INVITE_CODE = 'GARTEN1-TRAINER';
const GROUP_NAME = 'Garten 1';

const ROLE_TO_DB: Record<Role, DbRolle> = {
  Trainer: 'trainer',
  Volti: 'volti',
  Eltern: 'eltern',
};

const DB_TO_ROLE: Record<DbRolle, Role> = {
  trainer: 'Trainer',
  volti: 'Volti',
  eltern: 'Eltern',
};

/**
 * Grossschreibung am Wortanfang (auch nach Bindestrich), damit Vor-/Nachnamen
 * unabhängig von der Eingabe einheitlich angezeigt werden (z.B. "anne-sophie
 * güttinger" -> "Anne-Sophie Güttinger").
 */
function kapitalisiereName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((wort) =>
      wort
        .split('-')
        .map((teil) => (teil ? teil.charAt(0).toUpperCase() + teil.slice(1).toLowerCase() : teil))
        .join('-'),
    )
    .join(' ');
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private get supabase() {
    return this.supabaseService.supabase;
  }

  private readonly _currentUser = signal<AuthUser | null>(null);
  private readonly _pendingEmail = signal<string | null>(null);
  private readonly _pendingPasswort = signal<string | null>(null);
  private readonly _pendingRole = signal<Role | null>(null);
  private readonly _requiresRoleSelection = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);
  readonly pendingEmail = this._pendingEmail.asReadonly();
  readonly pendingRole = this._pendingRole.asReadonly();
  readonly requiresRoleSelection = this._requiresRoleSelection.asReadonly();

  // Unterscheidet einen bewussten Logout/Löschen (keine Meldung nötig) von
  // einem Session-Verlust mitten in der Nutzung (z.B. abgelaufenes Token) -
  // nur Letzteres soll auf der Anmeldung mit "Sitzung abgelaufen" erklärt
  // werden, statt kommentarlos zur Anmeldung zurückzuwerfen.
  private absichtlichAbgemeldet = false;
  private warEingeloggt = false;

  // currentUser wird erst nach dem ersten onAuthStateChange-Event (inkl. des
  // asynchronen ladeProfil()-Requests) zuverlässig gesetzt. Guards, die direkt
  // beim App-Start über eingeloggt/ausgeloggt entscheiden (z.B. authGuard nach
  // einem Kaltstart der PWA), müssen deshalb erst dieses Promise abwarten -
  // sonst lesen sie das Signal, bevor es befüllt ist, und werfen eine
  // eigentlich gültig eingeloggte Person fälschlicherweise zur Anmeldung.
  private authReadyResolve!: () => void;
  private readonly authReadyPromise = new Promise<void>((resolve) => {
    this.authReadyResolve = resolve;
  });

  constructor() {
    let istErstesEvent = true;

    // Hält currentUser mit der Supabase-Session synchron (z.B. nach einem
    // Seiten-Reload oder wenn sich die Nutzerin in einem anderen Tab abmeldet).
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthService] onAuthStateChange', event, 'session vorhanden:', !!session);
      void this.verarbeiteAuthEvent(session).finally(() => {
        if (istErstesEvent) {
          istErstesEvent = false;
          this.authReadyResolve();
        }
      });
    });
  }

  /**
   * Wird von Guards abgewartet, die beim App-Start (insbesondere nach einem
   * Kaltstart der als PWA installierten App) über eingeloggt/ausgeloggt
   * entscheiden müssen, bevor Supabase seine Session aus dem localStorage
   * gelesen und das zugehörige Profil geladen hat.
   */
  waitUntilReady(): Promise<void> {
    return this.authReadyPromise;
  }

  private async verarbeiteAuthEvent(session: Session | null): Promise<void> {
    if (session?.user) {
      this.warEingeloggt = true;
      await this.ladeProfil(session.user.id, session.user.email ?? '');
      return;
    }

    const warUnerwartet = this.warEingeloggt && !this.absichtlichAbgemeldet;
    this._currentUser.set(null);
    this.warEingeloggt = false;
    this.absichtlichAbgemeldet = false;
    if (warUnerwartet) {
      void this.router.navigateByUrl('/auth/anmeldung?grund=sitzung-abgelaufen');
    }
  }

  async login(email: string, passwort: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password: passwort });
    if (error) {
      throw new Error(this.uebersetzeFehler(error.message));
    }
  }

  async logout(): Promise<void> {
    this.absichtlichAbgemeldet = true;
    await this.supabase.auth.signOut();
  }

  /**
   * Löst den "Passwort vergessen"-Flow aus: Supabase verschickt (falls zu
   * dieser E-Mail ein Account existiert) einen Link mit Recovery-Token an
   * "/auth/passwort-zuruecksetzen". Antwortet bewusst gleich, egal ob die
   * E-Mail existiert - die Aufruferin darf daraus keinen Rückschluss auf
   * bestehende Accounts ziehen können.
   */
  async passwortVergessen(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/passwort-zuruecksetzen`,
    });
    if (error) {
      throw new Error(this.uebersetzeFehler(error.message));
    }
  }

  /**
   * Setzt das Passwort der Person, die über den Recovery-Link aus
   * "passwortVergessen" angemeldet wurde, endgültig neu.
   */
  async neuesPasswortSetzen(neuesPasswort: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password: neuesPasswort });
    if (error) {
      throw new Error(this.uebersetzeFehler(error.message));
    }
  }

  /**
   * "Löscht" den eigenen Account über die "delete-account" Edge Function
   * (braucht den service_role-Key, der nie im Frontend liegen darf) - in
   * Wirklichkeit ein weiches Löschen: der Login wird dauerhaft gesperrt und
   * die profiles-Zeile per "geloescht_am" markiert, aber nicht entfernt, so
   * dass sie in Supabase weiterhin sichtbar/nachvollziehbar bleibt.
   */
  async deleteAccount(): Promise<void> {
    // Frisch abfragen statt des gecachten currentUser-Signals: so ist
    // sichergestellt, dass wir eine tatsächlich gültige, aktuelle userId an
    // die Function schicken statt eines möglicherweise veralteten/leeren
    // Werts. signOut() darf hier bewusst erst NACH dem erfolgreichen
    // Aufruf passieren, sonst fehlt der Function der Authorization-Header.
    const {
      data: { user },
      error: userError,
    } = await this.supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Nicht angemeldet.');
    }

    const { error } = await this.supabase.functions.invoke('delete-account', {
      body: { userId: user.id },
    });

    if (error) {
      let details = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          details = await error.context.text();
        } catch {
          // Response-Body war nicht lesbar - details bleibt bei error.message.
        }
      }
      console.error('delete-account Edge Function fehlgeschlagen:', details);
      throw new Error(this.uebersetzeFehler(details));
    }

    this.absichtlichAbgemeldet = true;
    await this.supabase.auth.signOut();
  }

  /**
   * Prüft einen Einladungscode und leitet daraus die Rolle ab.
   * Aktuell gegen hartcodierte Konstanten, später leicht durch einen
   * echten Backend-Aufruf ersetzbar.
   */
  resolveRoleFromInviteCode(code: string): InviteCodeResolution {
    const normalized = code.trim().toUpperCase();

    if (normalized === TRAINER_INVITE_CODE) {
      return { valid: true, role: 'Trainer', requiresRoleSelection: false };
    }

    if (normalized === GROUP_INVITE_CODE) {
      return { valid: true, requiresRoleSelection: true };
    }

    return { valid: false, requiresRoleSelection: false };
  }

  /**
   * Prüft per Datenbankfunktion, ob mit dieser E-Mail-Adresse bereits ein
   * Konto existiert. Schlägt die Prüfung technisch fehl, wird "nicht
   * registriert" angenommen, damit die eigentliche Registrierung (die den
   * Fall über signUp() ohnehin nochmals abfängt) nicht blockiert wird.
   */
  async isEmailRegistered(email: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('email_ist_registriert', { p_email: email });
    if (error) {
      return false;
    }
    return Boolean(data);
  }

  startRegistration(email: string, passwort: string, resolution: InviteCodeResolution): void {
    this._pendingEmail.set(email);
    this._pendingPasswort.set(passwort);
    this._pendingRole.set(resolution.role ?? null);
    this._requiresRoleSelection.set(resolution.requiresRoleSelection);
  }

  setRole(role: Role): void {
    this._pendingRole.set(role);
  }

  /**
   * Schliesst die Registrierung ab: legt den Supabase-Auth-User und die
   * zugehörige profiles-Zeile an und meldet die Nutzerin an.
   */
  async completeProfile(firstName: string, lastName: string, avatarDataUrl: string | null): Promise<void> {
    const email = this._pendingEmail();
    const passwort = this._pendingPasswort();
    const role = this._pendingRole();
    if (!email || !passwort || !role) {
      throw new Error('Registrierung wurde nicht korrekt gestartet.');
    }

    const { data: gruppe, error: gruppeError } = await this.supabase
      .from('gruppen')
      .select('id')
      .eq('name', GROUP_NAME)
      .single();
    if (gruppeError || !gruppe) {
      throw new Error('Gruppe konnte nicht gefunden werden.');
    }

    const { data: signUpData, error: signUpError } = await this.supabase.auth.signUp({
      email,
      password: passwort,
    });
    if (signUpError) {
      throw new Error(this.uebersetzeFehler(signUpError.message));
    }
    const userId = signUpData.user?.id;
    if (!userId) {
      throw new Error('Registrierung fehlgeschlagen.');
    }

    const vorname = kapitalisiereName(firstName);
    const nachname = kapitalisiereName(lastName);

    const { error: profilError } = await this.supabase.from('profiles').insert({
      id: userId,
      rolle: ROLE_TO_DB[role],
      vorname,
      nachname,
      bild: avatarDataUrl,
      gruppe_id: gruppe.id,
    });
    if (profilError) {
      throw new Error(this.uebersetzeFehler(profilError.message));
    }

    this._currentUser.set({
      id: userId,
      email,
      role,
      firstName: vorname,
      lastName: nachname,
      avatarDataUrl,
      group: GROUP_NAME,
    });

    this._pendingEmail.set(null);
    this._pendingPasswort.set(null);
    this._pendingRole.set(null);
    this._requiresRoleSelection.set(false);
  }

  private async ladeProfil(userId: string, email: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('rolle, vorname, nachname, bild')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      this._currentUser.set(null);
      return;
    }

    this._currentUser.set({
      id: userId,
      email,
      role: DB_TO_ROLE[data.rolle as DbRolle],
      firstName: data.vorname,
      lastName: data.nachname,
      avatarDataUrl: data.bild,
      group: GROUP_NAME,
    });
  }

  /**
   * Aktualisiert Vor-/Nachname und optional das Profilbild (Upload zu
   * Supabase Storage, Bucket "avatars", Pfad "<userId>/avatar.<ext>").
   * Rolle ist bewusst nicht änderbar.
   */
  async saveProfile(vorname: string, nachname: string, bildDatei: File | null): Promise<void> {
    const user = this._currentUser();
    if (!user) {
      throw new Error('Nicht angemeldet.');
    }

    let bildUrl = user.avatarDataUrl;
    if (bildDatei) {
      const erweiterung = bildDatei.name.split('.').pop() || 'jpg';
      const pfad = `${user.id}/avatar.${erweiterung}`;
      // Datei vorher als ArrayBuffer einlesen statt das File-Objekt direkt
      // zu übergeben: Auf manchen mobilen Browsern/WebViews kommt der
      // Request-Body sonst leer an ("No content provided").
      const inhalt = await bildDatei.arrayBuffer();
      const { error: uploadError } = await this.supabase.storage
        .from('avatars')
        .upload(pfad, inhalt, { upsert: true, contentType: bildDatei.type || 'image/jpeg' });
      if (uploadError) {
        throw new Error(this.uebersetzeFehler(uploadError.message));
      }
      const { data: oeffentlicheUrl } = this.supabase.storage.from('avatars').getPublicUrl(pfad);
      // Cache-Busting: Pfad bleibt bei jedem Upload gleich (upsert), ohne
      // den Query-Parameter würde der Browser das alte Bild zwischenspeichern.
      bildUrl = `${oeffentlicheUrl.publicUrl}?t=${Date.now()}`;
    }

    const vornameFormatiert = kapitalisiereName(vorname);
    const nachnameFormatiert = kapitalisiereName(nachname);

    const { error } = await this.supabase
      .from('profiles')
      .update({ vorname: vornameFormatiert, nachname: nachnameFormatiert, bild: bildUrl })
      .eq('id', user.id);
    if (error) {
      throw new Error(this.uebersetzeFehler(error.message));
    }

    this._currentUser.set({
      ...user,
      firstName: vornameFormatiert,
      lastName: nachnameFormatiert,
      avatarDataUrl: bildUrl,
    });
  }

  private uebersetzeFehler(message: string): string {
    if (message.includes('User already registered')) {
      return 'Für diese E-Mail-Adresse besteht bereits ein Konto.';
    }
    if (message.includes('Invalid login credentials')) {
      return 'E-Mail-Adresse oder Passwort ist falsch.';
    }
    if (message.includes('Email not confirmed')) {
      return 'Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Bestätigungs-E-Mail).';
    }
    if (message.includes('New password should be different')) {
      return 'Das neue Passwort muss sich vom alten unterscheiden.';
    }
    if (message.includes('Auth session missing')) {
      return 'Deine Sitzung ist abgelaufen. Bitte fordere einen neuen Link an.';
    }
    if (message.includes('For security purposes')) {
      return 'Aus Sicherheitsgründen bitte kurz warten, bevor du erneut einen Link anforderst.';
    }
    if (message.includes('Error sending recovery email') || message.includes('Error sending confirmation email')) {
      // Kommt vom Supabase-Server selbst (Mailversand fehlgeschlagen, meist
      // weil das strenge Standard-Rate-Limit ohne eigenen SMTP-Anbieter
      // erreicht wurde) - lässt sich nicht durch Code hier beheben.
      return 'Die E-Mail konnte gerade nicht verschickt werden. Bitte versuch es in ein paar Minuten erneut.';
    }
    return message;
  }
}
