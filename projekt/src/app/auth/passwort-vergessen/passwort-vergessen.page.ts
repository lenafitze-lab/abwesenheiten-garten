import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonAvatar,
  IonIcon,
  IonCard,
  IonCardContent,
  IonInput,
  IonButton,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { mailOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { feldFehler } from '../../shared/formular.utils';

@Component({
  selector: 'app-passwort-vergessen',
  templateUrl: 'passwort-vergessen.page.html',
  styleUrls: ['passwort-vergessen.page.scss', '../auth-shared.scss'],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonAvatar,
    IonIcon,
    IonCard,
    IonCardContent,
    IonInput,
    IonButton,
  ],
})
export class PasswortVergessenPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toastController = inject(ToastController);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly linkGesendet = signal(false);
  readonly wirdGeladen = signal(false);

  constructor() {
    addIcons({ mailOutline });
  }

  emailFehler(): string | undefined {
    return feldFehler(this.form.controls.email, 'Bitte eine gültige E-Mail-Adresse eingeben.', {
      required: 'E-Mail ist ein Pflichtfeld.',
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email } = this.form.getRawValue();

    this.wirdGeladen.set(true);
    try {
      await this.authService.passwortVergessen(email);
      // Bewusst dieselbe Meldung unabhängig vom tatsächlichen Ergebnis -
      // sonst liesse sich daraus ablesen, ob zu dieser E-Mail ein Account
      // existiert.
      this.linkGesendet.set(true);
    } catch (error) {
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : 'Der Link konnte nicht verschickt werden.',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    } finally {
      this.wirdGeladen.set(false);
    }
  }
}
