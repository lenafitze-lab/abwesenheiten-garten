import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AlertController,
  ModalController,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonAvatar,
  IonChip,
  IonGrid,
  IonRow,
  IonCol,
  IonToggle,
  ToggleCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { moon, sunny, chevronForwardOutline } from 'ionicons/icons';
import { AuthService } from '../services/auth.service';
import { AppearanceService } from '../services/appearance.service';
import { PushService, PushZustand } from '../services/push.service';
import { ProfilBearbeitenComponent } from './profil-bearbeiten/profil-bearbeiten.component';

const PUSH_HINWEISE: Record<Exclude<PushZustand, 'verfuegbar'>, string> = {
  'ios-installieren':
    'Benachrichtigungen funktionieren auf dem iPhone nur, wenn du die App über Teilen → Zum Home-Bildschirm installierst.',
  'nicht-unterstuetzt': 'Dieser Browser unterstützt keine Benachrichtigungen.',
  'nicht-eingerichtet': 'Benachrichtigungen sind noch nicht eingerichtet.',
  blockiert:
    'Benachrichtigungen sind im Browser blockiert. Du kannst sie in den Website-Einstellungen deines Browsers wieder erlauben.',
};

@Component({
  selector: 'app-profil',
  templateUrl: 'profil.page.html',
  styleUrls: ['profil.page.scss'],
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonAvatar,
    IonChip,
    IonGrid,
    IonRow,
    IonCol,
    IonToggle,
  ],
})
export class ProfilPage {
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  private readonly modalController = inject(ModalController);
  protected readonly authService = inject(AuthService);
  protected readonly appearance = inject(AppearanceService);
  protected readonly push = inject(PushService);

  protected readonly pushLaedt = signal(false);
  protected readonly pushFehler = signal<string | null>(null);
  protected readonly pushHinweis = computed(() => {
    const zustand = this.push.zustand();
    return zustand === 'verfuegbar' ? null : PUSH_HINWEISE[zustand];
  });

  protected readonly anzeigename = computed(() => {
    const user = this.authService.currentUser();
    if (!user) {
      return '';
    }
    const name = `${user.firstName} ${user.lastName}`.trim();
    return name || user.email;
  });

  protected readonly initialen = computed(() => {
    const user = this.authService.currentUser();
    if (!user) {
      return '';
    }
    const kuerzel = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.trim();
    return (kuerzel || user.email.charAt(0)).toUpperCase();
  });

  constructor() {
    addIcons({ moon, sunny, chevronForwardOutline });
  }

  async bearbeiten(): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfilBearbeitenComponent,
    });
    await modal.present();
  }

  async benachrichtigungenUmschalten(event: ToggleCustomEvent): Promise<void> {
    const einschalten = event.detail.checked;
    this.pushLaedt.set(true);
    this.pushFehler.set(null);
    try {
      if (einschalten) {
        await this.push.aktivieren();
      } else {
        await this.push.deaktivieren();
      }
    } catch (error) {
      this.pushFehler.set(error instanceof Error ? error.message : 'Das hat leider nicht geklappt.');
    } finally {
      this.pushLaedt.set(false);
      // Schlägt das Umschalten fehl, bleibt push.aktiv() gleich - Angular
      // setzt [checked] dann nicht neu, der Schalter muss manuell zurück.
      event.target.checked = this.push.aktiv();
    }
  }

  async abmelden(): Promise<void> {
    await this.push.geraetAbmelden();
    await this.authService.logout();
    this.router.navigateByUrl('/auth/anmeldung');
  }

  async profilLoeschen(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Profil löschen',
      message: 'Möchtest du dein Profil wirklich löschen? Das kann nicht rückgängig gemacht werden.',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await this.push.geraetAbmelden();
              await this.authService.deleteAccount();
              this.router.navigateByUrl('/auth/anmeldung');
            } catch (error) {
              const fehlerAlert = await this.alertController.create({
                header: 'Löschen fehlgeschlagen',
                message: error instanceof Error ? error.message : 'Profil konnte nicht gelöscht werden.',
                buttons: ['OK'],
              });
              await fehlerAlert.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
