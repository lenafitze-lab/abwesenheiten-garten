import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AlertController, IonButton, IonIcon, IonSpinner, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronDownOutline, createOutline, informationCircleOutline, pencilOutline } from 'ionicons/icons';
import { AbsenzenService, TeilnehmerAbsenz } from '../../services/absenzen.service';
import { AuthService } from '../../services/auth.service';
import { AbsenzZaehler, sichtbarerGrund, zaehleAnwesendAbwesend } from '../absenz.utils';
import { AbsenzToggleComponent } from '../absenz-toggle/absenz-toggle.component';
import { TerminBearbeitenComponent } from '../termin-bearbeiten/termin-bearbeiten.component';

export interface TerminKarteTag {
  eventId: string;
  label: string;
  titel: string;
  start: string;
  ende: string | null;
  bemerkung: string | null;
  /** True, wenn eine Trainer-Person genau diesen Tag abgesagt hat. */
  abgesagt: boolean;
}

export interface TerminKarteDaten {
  /** null bei einer noch nicht angelegten Serientermin-Instanz (nicht aufklappbar). */
  id: string | null;
  titel: string;
  /** false bei Trainings: der Typ wird dort ausschliesslich über das Badge kommuniziert. */
  zeigeTitel: boolean;
  typLabel: string;
  start: string;
  ende: string | null;
  /** Optionale Notiz der Trainer-Person, per Info-Icon einsehbar. */
  bemerkung?: string | null;
  /** Gesetzt bei einer materialisierten Dauerauftrag-Woche; verweist auf die Serien-Basiszeile. */
  ausnahmeVonId?: string | null;
  /** True, wenn eine Trainer-Person diesen Termin abgesagt hat. */
  abgesagt?: boolean;
  /**
   * Bei einem mehrtägigen Anlass: eine echte, eigenständige Tages-Instanz
   * (eigene event_id) pro Kalendertag, jede mit unabhängigen Abwesenheiten.
   */
  tage?: TerminKarteTag[];
}

function imSetUmschalten<T>(set: Set<T>, wert: T): Set<T> {
  const naechstes = new Set(set);
  if (naechstes.has(wert)) {
    naechstes.delete(wert);
  } else {
    naechstes.add(wert);
  }
  return naechstes;
}

@Component({
  selector: 'app-termin-karte',
  templateUrl: 'termin-karte.component.html',
  styleUrls: ['termin-karte.component.scss'],
  imports: [DatePipe, NgTemplateOutlet, IonIcon, IonSpinner, IonButton],
})
export class TerminKarteComponent implements OnInit, OnDestroy {
  @Input({ required: true }) termin!: TerminKarteDaten;
  @Output() readonly terminGeaendert = new EventEmitter<void>();

  private readonly absenzenService = inject(AbsenzenService);
  private readonly authService = inject(AuthService);
  private readonly modalController = inject(ModalController);
  private readonly alertController = inject(AlertController);

  private readonly kanaeleNachEvent = new Map<string, RealtimeChannel>();

  // Anwesend- und Abwesend-Liste klappen pro Event unabhängig voneinander
  // auf/zu - kein gemeinsamer "Karte aufgeklappt"-Zustand mehr.
  private readonly anwesendOffenEvents = signal<Set<string>>(new Set());
  private readonly abwesendOffenEvents = signal<Set<string>>(new Set());
  private readonly teilnehmerNachEvent = signal<Map<string, TeilnehmerAbsenz[]>>(new Map());
  private readonly ladendEvents = signal<Set<string>>(new Set());
  private readonly fehlerNachEvent = signal<Map<string, string>>(new Map());

  /** Ist standardmässig offen, wenn eine Bemerkung vorhanden ist (siehe ngOnInit) - das Info-Icon blendet sie bei Bedarf aus. */
  readonly bemerkungOffen = signal(false);

  constructor() {
    addIcons({ chevronDownOutline, createOutline, informationCircleOutline, pencilOutline });
  }

  /**
   * Lädt die Zähler sofort für alle zugehörigen Events (nicht erst beim
   * Aufklappen), damit jede Karte in der Liste von Anfang an korrekte
   * Anwesend/Abwesend-Zahlen zeigt. Nur die jeweilige Namensliste bleibt
   * lazy und erscheint erst, wenn ihr Chip angeklickt wird.
   */
  ngOnInit(): void {
    this.bemerkungOffen.set(!!this.termin.bemerkung);

    if (!this.termin.id) {
      return;
    }
    const eventIds = this.termin.tage?.map((t) => t.eventId) ?? [this.termin.id];
    for (const eventId of eventIds) {
      void this.ladeFuerEvent(eventId);
    }
  }

  ngOnDestroy(): void {
    for (const kanal of this.kanaeleNachEvent.values()) {
      this.absenzenService.beendeAbo(kanal);
    }
  }

  zaehlerFuer(eventId: string): AbsenzZaehler {
    return zaehleAnwesendAbwesend((this.teilnehmerNachEvent().get(eventId) ?? []).map((t) => t.status));
  }

  anwesendFuer(eventId: string): TeilnehmerAbsenz[] {
    return (this.teilnehmerNachEvent().get(eventId) ?? []).filter((t) => t.status === 'anwesend');
  }

  abwesendFuer(eventId: string): TeilnehmerAbsenz[] {
    return (this.teilnehmerNachEvent().get(eventId) ?? []).filter((t) => t.status === 'abwesend');
  }

  ladendFuer(eventId: string): boolean {
    return this.ladendEvents().has(eventId);
  }

  fehlerFuer(eventId: string): string | null {
    return this.fehlerNachEvent().get(eventId) ?? null;
  }

  istAnwesendOffen(eventId: string): boolean {
    return this.anwesendOffenEvents().has(eventId);
  }

  istAbwesendOffen(eventId: string): boolean {
    return this.abwesendOffenEvents().has(eventId);
  }

  toggleAnwesend(eventId: string): void {
    this.anwesendOffenEvents.update((set) => imSetUmschalten(set, eventId));
  }

  toggleAbwesend(eventId: string): void {
    this.abwesendOffenEvents.update((set) => imSetUmschalten(set, eventId));
  }

  kannBearbeiten(person: TeilnehmerAbsenz): boolean {
    const user = this.authService.currentUser();
    if (user?.role === 'Trainer') {
      return true;
    }
    if (user?.role === 'Volti') {
      return person.profileId === user.id;
    }
    return false;
  }

  kannTerminBearbeiten(): boolean {
    return this.authService.currentUser()?.role === 'Trainer';
  }

  /**
   * Ist dieser Termin eine materialisierte Dauerauftrag-Woche, fragt zuerst
   * per Alert, ob nur diese eine Woche oder die ganze Serie angepasst
   * werden soll, bevor das Bearbeiten-Formular geöffnet wird.
   */
  async terminBearbeiten(): Promise<void> {
    if (!this.termin.id) {
      return;
    }
    const daten = {
      eventId: this.termin.id,
      basisId: this.termin.ausnahmeVonId ?? this.termin.id,
      titel: this.termin.titel,
      start: this.termin.start,
      ende: this.termin.ende,
      bemerkung: this.termin.bemerkung ?? null,
      abgesagt: this.termin.abgesagt ?? false,
    };

    if (!this.termin.ausnahmeVonId) {
      await this.oeffneBearbeitenModal('einzeln', daten);
      return;
    }

    const alert = await this.alertController.create({
      header: 'Serie anpassen?',
      message: 'Dieser Termin gehört zu einer wiederkehrenden Serie. Nur diesen einen Termin anpassen, oder die ganze Serie (alle zukünftigen Termine)?',
      buttons: [
        { text: 'Ganze Serie', handler: () => void this.oeffneBearbeitenModal('serie', daten) },
        { text: 'Nur dieser', handler: () => void this.oeffneBearbeitenModal('einzeln', daten) },
      ],
    });
    await alert.present();
  }

  /**
   * Bearbeiten/Absagen/Löschen für einen einzelnen Tag eines mehrtägigen
   * Anlasses - jeder Tag ist eine eigenständige Zeile mit eigener event_id
   * (siehe AbsenzenService.erstelleTermin) und wird deshalb unabhängig von
   * den übrigen Tagen bearbeitet, ohne "Serie anpassen?"-Rückfrage (das ist
   * kein wiederkehrender Dauerauftrag, sondern ein fixes Tage-Set).
   */
  async tagBearbeiten(tag: TerminKarteTag): Promise<void> {
    await this.oeffneBearbeitenModal('einzeln', {
      eventId: tag.eventId,
      basisId: tag.eventId,
      titel: tag.titel,
      start: tag.start,
      ende: tag.ende,
      bemerkung: tag.bemerkung,
      abgesagt: tag.abgesagt,
    });
  }

  private async oeffneBearbeitenModal(
    modus: 'einzeln' | 'serie',
    daten: {
      eventId: string;
      basisId: string;
      titel: string;
      start: string;
      ende: string | null;
      bemerkung: string | null;
      abgesagt: boolean;
    },
  ): Promise<void> {
    const modal = await this.modalController.create({
      component: TerminBearbeitenComponent,
      componentProps: {
        modus,
        eventId: daten.eventId,
        basisId: daten.basisId,
        titel: daten.titel,
        typLabel: this.termin.typLabel,
        datum: this.zuDatumString(daten.start),
        startZeit: this.zuZeitString(daten.start),
        endZeit: daten.ende ? this.zuZeitString(daten.ende) : null,
        bemerkung: daten.bemerkung,
        abgesagt: daten.abgesagt,
      },
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'aktualisiert' || role === 'abgesagt' || role === 'geloescht') {
      this.terminGeaendert.emit();
    }
  }

  private zuDatumString(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private zuZeitString(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /** Grund-Text für einen abwesenden Eintrag, z.B. "krank" oder "privat". Wird als "<Name> · <Grund>" angezeigt. */
  grundFuerAnzeige(person: TeilnehmerAbsenz): string {
    const user = this.authService.currentUser();
    const sichtbar = sichtbarerGrund(
      user?.role ?? null,
      { grund: person.grund, istPrivat: person.istPrivat },
      person.profileId === user?.id,
    );
    return sichtbar ?? 'privat';
  }

  async personAnklicken(eventId: string, person: TeilnehmerAbsenz): Promise<void> {
    if (!this.kannBearbeiten(person)) {
      return;
    }
    const modal = await this.modalController.create({
      component: AbsenzToggleComponent,
      cssClass: 'absenz-toggle-modal',
      componentProps: {
        eventId,
        profileId: person.profileId,
        personName: `${person.vorname} ${person.nachname}`,
        terminLabel: this.termin.titel,
        status: person.status,
        grund: person.grund,
        istPrivat: person.istPrivat,
      },
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'gespeichert') {
      await this.ladeFuerEvent(eventId);
    }
  }

  private async ladeFuerEvent(eventId: string): Promise<void> {
    this.ladendEvents.update((set) => new Set(set).add(eventId));
    const fehlerMap = new Map(this.fehlerNachEvent());
    fehlerMap.delete(eventId);
    this.fehlerNachEvent.set(fehlerMap);

    try {
      const teilnehmer = await this.absenzenService.ladeTeilnehmer(eventId);
      this.teilnehmerNachEvent.update((map) => new Map(map).set(eventId, teilnehmer));
      if (!this.kanaeleNachEvent.has(eventId)) {
        this.kanaeleNachEvent.set(
          eventId,
          this.absenzenService.abonniereEvent(eventId, () => void this.ladeFuerEvent(eventId)),
        );
      }
    } catch (error) {
      const map = new Map(this.fehlerNachEvent());
      map.set(eventId, error instanceof Error ? error.message : 'Laden fehlgeschlagen.');
      this.fehlerNachEvent.set(map);
    } finally {
      this.ladendEvents.update((set) => {
        const naechste = new Set(set);
        naechste.delete(eventId);
        return naechste;
      });
    }
  }
}
