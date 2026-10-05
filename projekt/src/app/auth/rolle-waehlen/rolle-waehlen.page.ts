import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonAvatar,
  IonIcon,
  IonCard,
  IonCardContent,
  IonItem,
  IonRadioGroup,
  IonRadio,
  IonButton,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { peopleOutline, personOutline, peopleCircleOutline } from 'ionicons/icons';
import { AuthService, Role } from '../../services/auth.service';

@Component({
  selector: 'app-rolle-waehlen',
  templateUrl: 'rolle-waehlen.page.html',
  styleUrls: ['rolle-waehlen.page.scss', '../auth-shared.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonAvatar,
    IonIcon,
    IonCard,
    IonCardContent,
    IonItem,
    IonRadioGroup,
    IonRadio,
    IonButton,
  ],
})
export class RolleWaehlenPage {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly ausgewaehlteRolle = signal<Role | null>(null);

  constructor() {
    addIcons({ peopleOutline, personOutline, peopleCircleOutline });

    if (!this.authService.pendingEmail()) {
      this.router.navigateByUrl('/auth/registrierung');
    }
  }

  waehleRolle(rolle: Role): void {
    this.ausgewaehlteRolle.set(rolle);
  }

  weiter(): void {
    const rolle = this.ausgewaehlteRolle();
    if (!rolle) {
      return;
    }
    this.authService.setRole(rolle);
    this.router.navigateByUrl('/auth/registrierung/profil');
  }
}
