import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonInput,
  IonTextarea,
  IonToggle,
  IonNote,
  IonIcon,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { AbsenzenService } from '../../services/absenzen.service';

function endeNachStart(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const datum = group.get('datum')?.value;
    const startZeit = group.get('startZeit')?.value;
    const endZeit = group.get('endZeit')?.value;
    if (!datum || !startZeit || !endZeit) {
      return null;
    }
    const start = new Date(`${datum}T${startZeit}`);
    const ende = new Date(`${datum}T${endZeit}`);
    return ende > start ? null : { endeVorStart: true };
  };
}

function verfalldatumNachStart(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const datum = group.get('datum')?.value;
    const verfalldatum = group.get('verfalldatum')?.value;
    if (!datum || !verfalldatum) {
      return null;
    }
    return new Date(verfalldatum) >= new Date(datum) ? null : { verfalldatumVorStart: true };
  };
}

function endDatumNachStart(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const datum = group.get('datum')?.value;
    const endDatum = group.get('endDatum')?.value;
    if (!datum || !endDatum) {
      return null;
    }
    return new Date(endDatum) >= new Date(datum) ? null : { endDatumVorStart: true };
  };
}

@Component({
  selector: 'app-termin-erstellen',
  templateUrl: 'termin-erstellen.component.html',
  styleUrls: ['termin-erstellen.component.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonInput,
    IonTextarea,
    IonToggle,
    IonNote,
    IonIcon,
  ],
})
export class TerminErstellenComponent {
  private readonly fb = inject(FormBuilder);
  private readonly absenzenService = inject(AbsenzenService);
  private readonly modalController = inject(ModalController);
  private readonly toastController = inject(ToastController);

  readonly wirdGespeichert = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      typ: this.fb.nonNullable.control<'training' | 'anlass'>('training', Validators.required),
      titel: ['', Validators.required],
      datum: ['', Validators.required],
      startZeit: ['', Validators.required],
      endZeit: ['', Validators.required],
      endDatum: [''],
      istDauerauftrag: [false],
      verfalldatum: [''],
      bemerkung: [''],
    },
    { validators: [endeNachStart(), verfalldatumNachStart(), endDatumNachStart()] },
  );

  constructor() {
    addIcons({ closeOutline });
  }

  protected wochentag(): string | null {
    const datum = this.form.controls.datum.value;
    if (!datum) {
      return null;
    }
    return new Date(`${datum}T00:00`).toLocaleDateString('de-CH', { weekday: 'long' });
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

  protected verfalldatumFehler(): string | undefined {
    return this.form.hasError('verfalldatumVorStart')
      ? 'Verfalldatum muss nach dem Startdatum liegen.'
      : undefined;
  }

  protected endDatumFehler(): string | undefined {
    return this.form.hasError('endDatumVorStart') ? 'Enddatum muss nach dem Startdatum liegen.' : undefined;
  }

  abbrechen(): void {
    this.modalController.dismiss(null, 'abgebrochen');
  }

  async speichern(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { typ, titel, datum, startZeit, endZeit, endDatum, istDauerauftrag, verfalldatum, bemerkung } =
      this.form.getRawValue();

    this.wirdGespeichert.set(true);
    try {
      await this.absenzenService.erstelleTermin({
        typ,
        titel,
        start: new Date(`${datum}T${startZeit}`).toISOString(),
        ende: endZeit ? new Date(`${datum}T${endZeit}`).toISOString() : null,
        istDauerauftrag,
        verfalldatum: istDauerauftrag && verfalldatum ? verfalldatum : null,
        endDatum: typ === 'anlass' && endDatum ? endDatum : null,
        bemerkung: bemerkung.trim() ? bemerkung.trim() : null,
      });
      const toast = await this.toastController.create({
        message: 'Termin wurde erstellt.',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
      await toast.present();
      await this.modalController.dismiss(null, 'erstellt');
    } catch (error) {
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : 'Termin konnte nicht erstellt werden.',
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
