import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonIcon, IonToggle, IonTextarea, ModalController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkCircleOutline, closeCircleOutline } from 'ionicons/icons';
import { AbsenzenService } from '../../services/absenzen.service';
import { AbsenzStatus, istAbsenzGueltig } from '../absenz.utils';

@Component({
  selector: 'app-absenz-toggle',
  templateUrl: 'absenz-toggle.component.html',
  styleUrls: ['absenz-toggle.component.scss'],
  imports: [FormsModule, IonButton, IonIcon, IonToggle, IonTextarea],
})
export class AbsenzToggleComponent implements OnInit {
  @Input({ required: true }) eventId!: string;
  @Input({ required: true }) profileId!: string;
  @Input({ required: true }) personName!: string;
  @Input({ required: true }) terminLabel!: string;
  @Input() status: AbsenzStatus = 'anwesend';
  @Input() grund: string | null = null;
  @Input() istPrivat = true;

  private readonly absenzenService = inject(AbsenzenService);
  private readonly modalController = inject(ModalController);
  private readonly toastController = inject(ToastController);

  protected readonly istAbwesend = signal(false);
  protected readonly grundText = signal('');
  protected readonly privatAktiv = signal(true);
  protected readonly beruehrt = signal(false);
  protected readonly wirdGespeichert = signal(false);

  protected readonly grundFehler = computed(() => {
    if (!this.beruehrt()) {
      return undefined;
    }
    const status: AbsenzStatus = this.istAbwesend() ? 'abwesend' : 'anwesend';
    return istAbsenzGueltig(status, this.grundText()) ? undefined : 'Bitte einen Grund angeben.';
  });

  constructor() {
    addIcons({ closeOutline, checkmarkCircleOutline, closeCircleOutline });
  }

  ngOnInit(): void {
    this.istAbwesend.set(this.status === 'abwesend');
    this.grundText.set(this.grund ?? '');
    this.privatAktiv.set(this.istPrivat);
  }

  onStatusWechsel(abwesend: boolean): void {
    this.istAbwesend.set(abwesend);
  }

  onGrundChange(wert: string): void {
    this.grundText.set(wert);
    this.beruehrt.set(true);
  }

  abbrechen(): void {
    this.modalController.dismiss(null, 'abgebrochen');
  }

  async speichern(): Promise<void> {
    const status: AbsenzStatus = this.istAbwesend() ? 'abwesend' : 'anwesend';
    this.beruehrt.set(true);
    if (!istAbsenzGueltig(status, this.grundText())) {
      return;
    }

    this.wirdGespeichert.set(true);
    try {
      await this.absenzenService.setzeAbsenz(
        this.eventId,
        this.profileId,
        status,
        this.grundText().trim(),
        this.privatAktiv(),
      );
      await this.modalController.dismiss(null, 'gespeichert');
    } catch (error) {
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : 'Speichern fehlgeschlagen.',
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
