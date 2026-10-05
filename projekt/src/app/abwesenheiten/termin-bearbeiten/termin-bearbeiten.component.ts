import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonInput,
  IonTextarea,
  IonNote,
  IonIcon,
  AlertController,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { AbsenzenService } from '../../services/absenzen.service';
import { AuthService } from '../../services/auth.service';

/** Vergleicht reine Uhrzeit-Strings ("HH:mm") statt Datumsobjekte - bei einer Serie gibt es kein einzelnes Datum. */
function endeNachStartZeit(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const startZeit = group.get('startZeit')?.value;
    const endZeit = group.get('endZeit')?.value;
    if (!startZeit || !endZeit) {
      return null;
    }
    return endZeit > startZeit ? null : { endeVorStart: true };
  };
}

@Component({
  selector: 'app-termin-bearbeiten',
  templateUrl: 'termin-bearbeiten.component.html',
  styleUrls: ['termin-bearbeiten.component.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonInput,
    IonTextarea,
    IonNote,
    IonIcon,
  ],
})
export class TerminBearbeitenComponent implements OnInit {
  /** 'einzeln': nur diese eine Zeile (eventId) ändern. 'serie': Basiszeile + alle zukünftigen Wochen (basisId). */
  @Input({ required: true }) modus!: 'einzeln' | 'serie';
  @Input({ required: true }) eventId!: string;
  @Input({ required: true }) basisId!: string;
  @Input({ required: true }) titel!: string;
  /** "Training", "Anlass" oder "Turnier" - für die Absagen-Texte ("Training absagen" bzw. "Anlass absagen"). */
  @Input({ required: true }) typLabel!: string;
  /** yyyy-MM-dd - nur im 'einzeln'-Modus relevant/editierbar. */
  @Input({ required: true }) datum!: string;
  @Input({ required: true }) startZeit!: string;
  @Input() endZeit: string | null = null;
  @Input() bemerkung: string | null = null;
  @Input() abgesagt = false;

  private readonly fb = inject(FormBuilder);
  private readonly absenzenService = inject(AbsenzenService);
  private readonly authService = inject(AuthService);
  private readonly modalController = inject(ModalController);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);

  readonly wirdGespeichert = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      titel: ['', Validators.required],
      datum: ['', Validators.required],
      startZeit: ['', Validators.required],
      endZeit: ['', Validators.required],
      bemerkung: [''],
    },
    { validators: [endeNachStartZeit()] },
  );

  constructor() {
    addIcons({ closeOutline });
  }

  ngOnInit(): void {
    this.form.setValue({
      titel: this.titel,
      datum: this.datum,
      startZeit: this.startZeit,
      endZeit: this.endZeit ?? '',
      bemerkung: this.bemerkung ?? '',
    });
    if (this.modus === 'serie') {
      // Im Serie-Modus gilt die Änderung für viele Wochen - ein einzelnes
      // Datum ergibt hier keinen Sinn und wird deshalb nicht bearbeitet.
      this.form.controls.datum.disable();
    }
  }

  protected endZeitFehler(): string | undefined {
    const control = this.form.controls.endZeit;
    if (!control.touched) {
      return undefined;
    }
    if (control.hasError('required')) {
      return 'Endzeit ist ein Pflichtfeld.';
    }
    return this.form.hasError('endeVorStart') ? 'Ende muss nach dem Start liegen.' : undefined;
  }

  abbrechen(): void {
    this.modalController.dismiss(null, 'abgebrochen');
  }

  /** Der "Training/Anlass absagen"-Button ist wie das Bearbeiten selbst nur für Trainer gedacht. */
  protected istTrainer(): boolean {
    return this.authService.currentUser()?.role === 'Trainer';
  }

  async absagen(): Promise<void> {
    const alert = await this.alertController.create({
      header: `${this.typLabel} wirklich absagen?`,
      message: `Das ${this.typLabel} bleibt sichtbar, wird aber als abgesagt markiert.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Absagen', role: 'destructive', handler: () => void this.bestaetigeAbsagen() },
      ],
    });
    await alert.present();
  }

  protected async bestaetigeAbsagen(): Promise<void> {
    try {
      await this.absenzenService.sageTerminAb(this.eventId);
      const toast = await this.toastController.create({
        message: `${this.typLabel} wurde abgesagt.`,
        duration: 2000,
        color: 'success',
        position: 'top',
      });
      await toast.present();
      await this.modalController.dismiss(null, 'abgesagt');
    } catch (error) {
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : `${this.typLabel} konnte nicht abgesagt werden.`,
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    }
  }

  /**
   * Löscht diesen Termin unwiderruflich. Im 'serie'-Modus (nur erreichbar,
   * wenn beim Öffnen "Ganze Serie" gewählt wurde) betrifft das alle noch
   * bevorstehenden Instanzen der Serie, nicht nur die aktuell angezeigte -
   * der Bestätigungsdialog weist deshalb zusätzlich darauf hin.
   */
  async loeschen(): Promise<void> {
    const serienHinweis =
      this.modus === 'serie'
        ? ' Dies ist ein wiederkehrender Termin: Beim Löschen werden alle zukünftigen Termine dieser Serie entfernt, vergangene Termine bleiben als Verlauf erhalten.'
        : '';
    const alert = await this.alertController.create({
      header: `${this.typLabel} wirklich löschen?`,
      message: `Dabei werden auch alle zugehörigen Anwesend-/Abwesend-Einträge unwiderruflich entfernt.${serienHinweis}`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Löschen', role: 'destructive', handler: () => void this.bestaetigeLoeschen() },
      ],
    });
    await alert.present();
  }

  protected async bestaetigeLoeschen(): Promise<void> {
    try {
      if (this.modus === 'serie') {
        await this.absenzenService.loescheSerie(this.basisId);
      } else {
        await this.absenzenService.loescheEinzelnesElement(this.eventId);
      }
      const toast = await this.toastController.create({
        message: `${this.typLabel} wurde gelöscht.`,
        duration: 2000,
        color: 'success',
        position: 'top',
      });
      await toast.present();
      await this.modalController.dismiss(null, 'geloescht');
    } catch (error) {
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : `${this.typLabel} konnte nicht gelöscht werden.`,
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    }
  }

  async speichern(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { titel, datum, startZeit, endZeit, bemerkung } = this.form.getRawValue();
    const aenderung = {
      titel,
      startZeit,
      endZeit: endZeit ? endZeit : null,
      bemerkung: bemerkung.trim() ? bemerkung.trim() : null,
    };

    // Nur im Einzeln-Modus wird abgesagt/abgesagt_am zurückgesetzt (siehe
    // AbsenzenService.aktualisiereEinzelnesElement) - Speichern wirkt hier
    // also implizit als "Termin wieder aktivieren", ohne eigenen Button.
    const wirdReaktiviert = this.modus === 'einzeln' && this.abgesagt;

    this.wirdGespeichert.set(true);
    try {
      if (this.modus === 'serie') {
        await this.absenzenService.aktualisiereSerie(this.basisId, aenderung);
      } else {
        await this.absenzenService.aktualisiereEinzelnesElement(this.eventId, datum, aenderung);
      }
      const toast = await this.toastController.create({
        message: wirdReaktiviert ? `${this.typLabel} wurde wieder aktiviert.` : 'Änderungen wurden gespeichert.',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
      await toast.present();
      await this.modalController.dismiss(null, 'aktualisiert');
    } catch (error) {
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : 'Änderungen konnten nicht gespeichert werden.',
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
