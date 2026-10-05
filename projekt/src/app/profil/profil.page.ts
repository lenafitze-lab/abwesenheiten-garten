import { Component, computed, inject } from '@angular/core';
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
  IonCard,
  IonCardContent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { moon, sunny, checkmarkCircle, chevronForwardOutline } from 'ionicons/icons';
import { AuthService } from '../services/auth.service';
import { AppearanceService, Farbschema } from '../services/appearance.service';
import { ProfilBearbeitenComponent } from './profil-bearbeiten/profil-bearbeiten.component';

interface FarbschemaOption {
  wert: Farbschema;
  label: string;
  farbe: string;
}

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
    IonCard,
    IonCardContent,
  ],
})
export class ProfilPage {
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  private readonly modalController = inject(ModalController);
  protected readonly authService = inject(AuthService);
  protected readonly appearance = inject(AppearanceService);

  protected readonly farbschemaOptionen: FarbschemaOption[] = [
    { wert: 'Gelb', label: 'Gelb', farbe: '#d1a03a' },
    { wert: 'Rot', label: 'Rot', farbe: '#c05a5a' },
  ];

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
    addIcons({ moon, sunny, checkmarkCircle, chevronForwardOutline });
  }

  async bearbeiten(): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfilBearbeitenComponent,
    });
    await modal.present();
  }

  async abmelden(): Promise<void> {
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
