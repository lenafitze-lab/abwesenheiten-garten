import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonInput,
  IonButton,
  IonAvatar,
  IonIcon,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { personCircleOutline, cameraOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { bildVorschauLaden, dateiAusEvent, feldFehler } from '../../shared/formular.utils';

@Component({
  selector: 'app-profil-vervollstaendigen',
  templateUrl: 'profil-vervollstaendigen.page.html',
  styleUrls: ['profil-vervollstaendigen.page.scss', '../auth-shared.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardContent,
    IonInput,
    IonButton,
    IonAvatar,
    IonIcon,
  ],
})
export class ProfilVervollstaendigenPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly profilbildVorschau = signal<string | null>(null);
  readonly fehlermeldung = signal<string | null>(null);
  readonly wirdGeladen = signal(false);

  readonly form = this.fb.nonNullable.group({
    vorname: ['', [Validators.required]],
    nachname: ['', [Validators.required]],
  });

  constructor() {
    addIcons({ personCircleOutline, cameraOutline });

    if (!this.authService.pendingEmail()) {
      this.router.navigateByUrl('/auth/registrierung');
    }
  }

  vornameFehler(): string | undefined {
    return feldFehler(this.form.controls.vorname, 'Vorname ist ein Pflichtfeld.');
  }

  nachnameFehler(): string | undefined {
    return feldFehler(this.form.controls.nachname, 'Nachname ist ein Pflichtfeld.');
  }

  onProfilbildAusgewaehlt(event: Event): void {
    const datei = dateiAusEvent(event);
    if (!datei) {
      return;
    }
    bildVorschauLaden(datei, (dataUrl) => this.profilbildVorschau.set(dataUrl));
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { vorname, nachname } = this.form.getRawValue();

    this.fehlermeldung.set(null);
    this.wirdGeladen.set(true);
    try {
      await this.authService.completeProfile(vorname, nachname, this.profilbildVorschau());
      this.router.navigateByUrl('/tabs/abwesenheiten');
    } catch (error) {
      this.fehlermeldung.set(error instanceof Error ? error.message : 'Registrierung fehlgeschlagen.');
    } finally {
      this.wirdGeladen.set(false);
    }
  }
}
