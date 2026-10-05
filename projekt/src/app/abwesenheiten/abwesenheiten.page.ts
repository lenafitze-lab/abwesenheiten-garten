import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonChip,
  IonSpinner,
  IonFab,
  IonFabButton,
  IonIcon,
  ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline } from 'ionicons/icons';
import { AbsenzenService, Termin } from '../services/absenzen.service';
import { AuthService } from '../services/auth.service';
import { TerminErstellenComponent } from './termin-erstellen/termin-erstellen.component';
import { TerminKarteComponent, TerminKarteDaten } from './termin-karte/termin-karte.component';

type AbwesenheitenSegment = 'alle' | 'trainings' | 'anlaesse' | 'abgeschlossen';

const TYP_LABEL: Record<Termin['typ'], string> = {
  training: 'Training',
  anlass: 'Anlass',
  turnier: 'Turnier',
};

// Lokaler Cache der zuletzt geladenen Termine, damit die Übersicht (Titel,
// Datum, Uhrzeit) auch ohne Verbindung noch angezeigt werden kann - z.B.
// wenn Trainer/Eltern die App in der Reithalle mit schlechtem Empfang
// öffnen. Live-Anwesenheiten je Karte bleiben davon unberührt (die werden
// weiterhin einzeln pro Karte nachgeladen und brauchen Verbindung).
const TERMINE_CACHE_KEY = 'abwesenheiten-cache-v1';

interface TermineCache {
  termine: Termin[];
  zeitpunkt: string;
}

function ladeTermineCache(): TermineCache | null {
  try {
    const roh = localStorage.getItem(TERMINE_CACHE_KEY);
    return roh ? (JSON.parse(roh) as TermineCache) : null;
  } catch {
    return null;
  }
}

function speichereTermineCache(termine: Termin[]): void {
  try {
    const cache: TermineCache = { termine, zeitpunkt: new Date().toISOString() };
    localStorage.setItem(TERMINE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage evtl. voll oder blockiert - der Cache ist nur ein
    // Komfort-Feature, das darf das normale Laden nicht verhindern.
  }
}

@Component({
  selector: 'app-abwesenheiten',
  templateUrl: 'abwesenheiten.page.html',
  styleUrls: ['abwesenheiten.page.scss'],
  imports: [
    DatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonChip,
    IonSpinner,
    IonFab,
    IonFabButton,
    IonIcon,
    TerminKarteComponent,
  ],
})
export class AbwesenheitenPage {
  private readonly absenzenService = inject(AbsenzenService);
  private readonly authService = inject(AuthService);
  private readonly modalController = inject(ModalController);

  readonly segment = signal<AbwesenheitenSegment>('alle');
  readonly ladend = signal(true);
  readonly ladeFehler = signal<string | null>(null);
  readonly ausCache = signal(false);
  readonly cacheZeitpunkt = signal<string | null>(null);
  private readonly termine = signal<Termin[]>([]);

  readonly istTrainer = computed(() => this.authService.currentUser()?.role === 'Trainer');

  private readonly alleAnzeigen = computed<(TerminKarteDaten & { typ: Termin['typ'] })[]>(() => {
    const alle = this.termine();
    const kinderNachEltern = new Map<string, Termin[]>();
    for (const t of alle) {
      if (t.ausnahmeVonId) {
        const liste = kinderNachEltern.get(t.ausnahmeVonId) ?? [];
        liste.push(t);
        kinderNachEltern.set(t.ausnahmeVonId, liste);
      }
    }

    return alle
      // Tages-Instanzen eines mehrtägigen Anlasses werden nur über ihr
      // Eltern-Element gerendert, nicht als eigene Karte in der Liste.
      .filter((t) => !t.ausnahmeVonId)
      .flatMap((t) => this.zuAnzeigen(t, kinderNachEltern.get(t.id)))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  });

  private readonly bevorstehend = computed(() =>
    this.alleAnzeigen().filter((t) => this.terminEnde(t).getTime() >= Date.now()),
  );
  private readonly vergangen = computed(() =>
    this.alleAnzeigen().filter((t) => this.terminEnde(t).getTime() < Date.now()),
  );

  readonly currentList = computed(() => {
    switch (this.segment()) {
      case 'alle':
        return this.bevorstehend();
      case 'trainings':
        return this.bevorstehend().filter((t) => t.typ === 'training');
      case 'anlaesse':
        return this.bevorstehend().filter((t) => t.typ !== 'training');
      case 'abgeschlossen':
        return this.vergangen();
    }
  });

  constructor() {
    addIcons({ addOutline });
    void this.laden();
  }

  onSegmentChange(value: string | number | undefined): void {
    if (value === 'alle' || value === 'trainings' || value === 'anlaesse' || value === 'abgeschlossen') {
      this.segment.set(value);
    }
  }

  async terminErstellen(): Promise<void> {
    const modal = await this.modalController.create({ component: TerminErstellenComponent });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'erstellt') {
      await this.laden();
    }
  }

  private zuAnzeigen(termin: Termin, kinder?: Termin[]): (TerminKarteDaten & { typ: Termin['typ'] })[] {
    // Titel wird immer angezeigt (auch bei Trainings) - Trainer sollen z.B.
    // "Halle 2" oder einen Gruppennamen direkt in der Übersicht sehen,
    // nicht nur über die Bemerkung.
    const zeigeTitel = true;

    if (kinder && kinder.length > 0) {
      const sortierteKinder = [...kinder].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      );

      if (termin.istDauerauftrag) {
        // Dauerauftrag: jede Woche ist eine eigenständige, unabhängige
        // Karte mit echter event_id (siehe AbsenzenService.ladeTermine()),
        // nicht mehr ein clientseitig berechneter Platzhalter.
        return sortierteKinder.map((kind) => ({
          id: kind.id,
          titel: kind.titel,
          zeigeTitel,
          typLabel: TYP_LABEL[kind.typ],
          typ: kind.typ,
          start: kind.start,
          ende: kind.ende,
          bemerkung: kind.bemerkung,
          ausnahmeVonId: kind.ausnahmeVonId,
          abgesagt: kind.abgesagt,
        }));
      }

      // Mehrtägiger Anlass: eine Karte mit pro Tag aufklappbaren Unterblöcken.
      return [
        {
          id: termin.id,
          titel: termin.titel,
          zeigeTitel,
          typLabel: TYP_LABEL[termin.typ],
          typ: termin.typ,
          start: termin.start,
          ende: termin.ende,
          bemerkung: termin.bemerkung,
          abgesagt: termin.abgesagt,
          tage: sortierteKinder.map((kind) => ({
            eventId: kind.id,
            label: new Date(kind.start).toLocaleDateString('de-CH', { weekday: 'long' }),
            titel: kind.titel,
            start: kind.start,
            ende: kind.ende,
            bemerkung: kind.bemerkung,
            abgesagt: kind.abgesagt,
          })),
        },
      ];
    }

    // Kein Kind vorhanden: einmaliger Termin, oder (Fallback) eine
    // Dauerauftrag-Basiszeile, deren Wochen noch nicht materialisiert sind.
    return [
      {
        id: termin.id,
        titel: termin.titel,
        zeigeTitel,
        typLabel: TYP_LABEL[termin.typ],
        typ: termin.typ,
        start: termin.start,
        ende: termin.ende,
        bemerkung: termin.bemerkung,
        ausnahmeVonId: termin.ausnahmeVonId,
        abgesagt: termin.abgesagt,
      },
    ];
  }

  private terminEnde(termin: TerminKarteDaten): Date {
    return new Date(termin.ende ?? termin.start);
  }

  protected async laden(): Promise<void> {
    this.ladend.set(true);
    this.ladeFehler.set(null);
    try {
      const termine = await this.absenzenService.ladeTermine();
      this.termine.set(termine);
      this.ausCache.set(false);
      speichereTermineCache(termine);
    } catch (error) {
      // Ohne Verbindung (z.B. in der Reithalle) auf die zuletzt geladenen
      // Termine zurückfallen, statt nur einen Fehler zu zeigen - Live-
      // Anwesenheiten je Karte bleiben davon unberührt, die brauchen
      // weiterhin eine Verbindung.
      const cache = ladeTermineCache();
      if (cache) {
        this.termine.set(cache.termine);
        this.ausCache.set(true);
        this.cacheZeitpunkt.set(cache.zeitpunkt);
      } else {
        this.ladeFehler.set(error instanceof Error ? error.message : 'Laden fehlgeschlagen.');
      }
    } finally {
      this.ladend.set(false);
    }
  }
}
