import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonAvatar,
  IonIcon,
  IonInput,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { personCircleOutline, cameraOutline, closeOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { bildVorschauLaden, dateiAusEvent, feldFehler } from '../../shared/formular.utils';

@Component({
  selector: 'app-profil-bearbeiten',
  templateUrl: 'profil-bearbeiten.component.html',
  styleUrls: ['profil-bearbeiten.component.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonAvatar,
    IonIcon,
    IonInput,
  ],
})
export class ProfilBearbeitenComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly modalController = inject(ModalController);
  private readonly toastController = inject(ToastController);

  private readonly ausgewaehlteDatei = signal<File | null>(null);
  readonly bildVorschau = signal<string | null>(this.authService.currentUser()?.avatarDataUrl ?? null);
  readonly wirdGespeichert = signal(false);

  readonly form = this.fb.nonNullable.group({
    vorname: [this.authService.currentUser()?.firstName ?? '', [Validators.required]],
    nachname: [this.authService.currentUser()?.lastName ?? '', [Validators.required]],
  });

  constructor() {
    addIcons({ personCircleOutline, cameraOutline, closeOutline });
  }

  vornameFehler(): string | undefined {
    return feldFehler(this.form.controls.vorname, 'Vorname ist ein Pflichtfeld.');
  }

  nachnameFehler(): string | undefined {
    return feldFehler(this.form.controls.nachname, 'Nachname ist ein Pflichtfeld.');
  }

  onBildAusgewaehlt(event: Event): void {
    const datei = dateiAusEvent(event);
    if (!datei) {
      return;
    }
    this.ausgewaehlteDatei.set(datei);
    bildVorschauLaden(datei, (dataUrl) => this.bildVorschau.set(dataUrl));
  }

  abbrechen(): void {
    this.modalController.dismiss(null, 'abgebrochen');
  }

  async speichern(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { vorname, nachname } = this.form.getRawValue();

    this.wirdGespeichert.set(true);
    try {
      await this.authService.saveProfile(vorname, nachname, this.ausgewaehlteDatei());
      const toast = await this.toastController.create({
        message: 'Profil aktualisiert.',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
      await toast.present();
      await this.modalController.dismiss(null, 'gespeichert');
    } catch (error) {
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : 'Profil konnte nicht gespeichert werden.',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    } finally {
      this.wirdGespeichert.set(false);
    }
  }
}
