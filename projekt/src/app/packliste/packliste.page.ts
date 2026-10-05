import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonCheckbox,
  IonInput,
  IonButton,
  AlertController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline } from 'ionicons/icons';
import { PacklisteItem, PacklisteService } from '../services/packliste.service';
import { AuthService } from '../services/auth.service';
import { OfflineService } from '../services/offline.service';

// Lokaler Cache der zuletzt geladenen Packliste, damit sie auch ohne
// Verbindung noch angezeigt werden kann (analog zum Termine-Cache in der
// Abwesenheiten-Seite). Abhaken/Hinzufügen/Löschen bleiben online-only,
// nur das Anzeigen funktioniert offline.
const PACKLISTE_CACHE_KEY = 'packliste-cache-v1';

interface PacklisteCache {
  items: PacklisteItem[];
  zeitpunkt: string;
}

function ladePacklisteCache(): PacklisteCache | null {
  try {
    const roh = localStorage.getItem(PACKLISTE_CACHE_KEY);
    return roh ? (JSON.parse(roh) as PacklisteCache) : null;
  } catch {
    return null;
  }
}

function speicherePacklisteCache(items: PacklisteItem[]): void {
  try {
    const cache: PacklisteCache = { items, zeitpunkt: new Date().toISOString() };
    localStorage.setItem(PACKLISTE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage evtl. voll oder blockiert - der Cache ist nur ein
    // Komfort-Feature, das darf das normale Laden nicht verhindern.
  }
}

@Component({
  selector: 'app-packliste',
  templateUrl: 'packliste.page.html',
  styleUrls: ['packliste.page.scss'],
  imports: [
    DatePipe,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSpinner,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonCheckbox,
    IonInput,
    IonButton,
  ],
})
export class PacklistePage implements OnDestroy {
  private readonly packlisteService = inject(PacklisteService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly offlineService = inject(OfflineService);

  readonly items = signal<PacklisteItem[]>([]);
  readonly ladend = signal(true);
  readonly ladeFehler = signal<string | null>(null);
  readonly wirdGespeichert = signal(false);
  readonly ausCache = signal(false);
  readonly cacheZeitpunkt = signal<string | null>(null);

  readonly istTrainer = computed(() => this.authService.currentUser()?.role === 'Trainer');
  readonly kannAbhaken = computed(() => {
    const rolle = this.authService.currentUser()?.role;
    return rolle === 'Trainer' || rolle === 'Volti';
  });

  readonly neuesItemForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
  });

  private kanal: RealtimeChannel | null = null;
  private warOffline = false;

  constructor() {
    addIcons({ addOutline, trashOutline });
    void this.init();

    // Sorgt dafür, dass die Liste sich "immer aktualisiert": kommt die
    // Verbindung nach einer Offline-Phase zurück, wird sofort neu geladen,
    // statt nur auf das Realtime-Abo zu vertrauen (das kann nach einem
    // Verbindungsabbruch etwas brauchen, bis es sich neu verbindet).
    effect(() => {
      const online = this.offlineService.istOnline();
      if (!online) {
        this.warOffline = true;
      } else if (this.warOffline) {
        this.warOffline = false;
        void this.laden();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.kanal) {
      this.packlisteService.beendeAbo(this.kanal);
    }
  }

  private async init(): Promise<void> {
    await this.laden();
    try {
      const gruppeId = await this.packlisteService.ladeEigeneGruppeId();
      this.kanal = this.packlisteService.abonniereGruppe(gruppeId, () => void this.laden());
    } catch {
      // Realtime ist ein Komfort-Feature - schlägt das Ermitteln der Gruppe
      // fehl, bleibt die Liste trotzdem nutzbar, nur ohne Live-Updates.
    }
  }

  async laden(): Promise<void> {
    this.ladend.set(true);
    this.ladeFehler.set(null);
    try {
      const items = await this.packlisteService.ladeItems();
      this.items.set(items);
      this.ausCache.set(false);
      speicherePacklisteCache(items);
    } catch (error) {
      const cache = ladePacklisteCache();
      if (cache) {
        this.items.set(cache.items);
        this.ausCache.set(true);
        this.cacheZeitpunkt.set(cache.zeitpunkt);
      } else {
        this.ladeFehler.set(error instanceof Error ? error.message : 'Laden fehlgeschlagen.');
      }
    } finally {
      this.ladend.set(false);
    }
  }

  async toggle(item: PacklisteItem): Promise<void> {
    if (!this.kannAbhaken()) {
      return;
    }
    try {
      await this.packlisteService.setzeAbgehakt(item.id, !item.abgehakt);
      await this.laden();
    } catch (error) {
      await this.zeigeFehlerToast(error);
    }
  }

  async hinzufuegen(): Promise<void> {
    if (this.neuesItemForm.invalid) {
      this.neuesItemForm.markAllAsTouched();
      return;
    }
    const name = this.neuesItemForm.controls.name.value.trim();
    if (!name) {
      return;
    }

    this.wirdGespeichert.set(true);
    try {
      await this.packlisteService.fuegeItemHinzu(name);
      this.neuesItemForm.reset();
      await this.laden();
    } catch (error) {
      await this.zeigeFehlerToast(error);
    } finally {
      this.wirdGespeichert.set(false);
    }
  }

  async loeschen(item: PacklisteItem): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Item löschen',
      message: `"${item.name}" wirklich aus der Packliste löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await this.packlisteService.loescheItem(item.id);
              await this.laden();
            } catch (error) {
              await this.zeigeFehlerToast(error);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async allesZuruecksetzen(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Alles zurücksetzen',
      message: 'Alle abgehakten Items werden wieder als offen markiert. Fortfahren?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Zurücksetzen',
          role: 'destructive',
          handler: async () => {
            try {
              await this.packlisteService.allesZuruecksetzen();
              await this.laden();
            } catch (error) {
              await this.zeigeFehlerToast(error);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private async zeigeFehlerToast(error: unknown): Promise<void> {
    const toast = await this.toastController.create({
      message: error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
      duration: 3000,
      color: 'danger',
      position: 'top',
    });
    await toast.present();
  }
}
