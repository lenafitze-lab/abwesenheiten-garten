import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logInOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { feldFehler } from '../../shared/formular.utils';

@Component({
  selector: 'app-anmeldung',
  templateUrl: 'anmeldung.page.html',
  styleUrls: ['anmeldung.page.scss', '../auth-shared.scss'],
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
export class AnmeldungPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    passwort: ['', [Validators.required]],
  });

  readonly fehlermeldung = signal<string | null>(null);
  readonly wirdGeladen = signal(false);
  readonly sitzungAbgelaufen = signal(false);

  constructor() {
    addIcons({ logInOutline });
    this.sitzungAbgelaufen.set(this.route.snapshot.queryParamMap.get('grund') === 'sitzung-abgelaufen');
  }

  emailFehler(): string | undefined {
    return feldFehler(this.form.controls.email, 'Bitte eine gültige E-Mail-Adresse eingeben.', {
      required: 'E-Mail ist ein Pflichtfeld.',
    });
  }

  passwortFehler(): string | undefined {
    return feldFehler(this.form.controls.passwort, 'Passwort ist ein Pflichtfeld.');
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, passwort } = this.form.getRawValue();

    this.fehlermeldung.set(null);
    this.wirdGeladen.set(true);
    try {
      await this.authService.login(email, passwort);
      this.router.navigateByUrl('/tabs/abwesenheiten');
    } catch (error) {
      this.fehlermeldung.set(error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      this.wirdGeladen.set(false);
    }
  }
}
