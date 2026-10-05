import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { AbsenzStatus } from '../abwesenheiten/absenz.utils';
import { generiereSerientermine } from '../abwesenheiten/serientermin.utils';

export interface Termin {
  id: string;
  gruppeId: string;
  titel: string;
  typ: 'training' | 'anlass' | 'turnier';
  start: string;
  ende: string | null;
  istDauerauftrag: boolean;
  verfalldatum: string | null;
  /** Gesetzt bei einer Tages-/Wochen-Instanz eines Anlasses/Dauerauftrags; verweist auf die Eltern-Zeile. */
  ausnahmeVonId: string | null;
  /** Optionale Notiz der Trainer-Person, z.B. Hallenwechsel oder Absage-Hinweis. */
  bemerkung: string | null;
  /** True, wenn eine Trainer-Person diesen einzelnen Termin abgesagt hat. */
  abgesagt: boolean;
}

export interface NeuerTermin {
  typ: 'training' | 'anlass';
  titel: string;
  start: string;
  ende: string | null;
  istDauerauftrag: boolean;
  verfalldatum: string | null;
  /** Bei Anlässen: Enddatum (yyyy-MM-dd), falls der Anlass mehrere Tage dauert. */
  endDatum: string | null;
  bemerkung: string | null;
}

export interface TerminAenderung {
  titel: string;
  /** HH:mm */
  startZeit: string;
  /** HH:mm, optional */
  endZeit: string | null;
  bemerkung: string | null;
}

export interface TeilnehmerAbsenz {
  profileId: string;
  vorname: string;
  nachname: string;
  status: AbsenzStatus;
  grund: string | null;
  istPrivat: boolean;
}

@Injectable({ providedIn: 'root' })
export class AbsenzenService {
  private readonly supabaseService = inject(SupabaseService);
  private get supabase() {
    return this.supabaseService.supabase;
  }

  private static readonly SELECT_FELDER =
    'id, gruppe_id, titel, typ, start, ende, ist_dauerauftrag, verfalldatum, ausnahme_von_id, bemerkung, abgesagt';

  /**
   * Lädt alle Termine und materialisiert dabei fehlende Wochen-Instanzen
   * eines Dauerauftrags nach (siehe materialisiereFehlendeSerientermine).
   * So bekommt jede angezeigte Karte eine echte event_id mit eigenen
   * Abwesenheiten, statt nur clientseitig berechneter Platzhalter-Termine.
   */
  async ladeTermine(): Promise<Termin[]> {
    const { data, error } = await this.supabase
      .from('trainings_anlaesse')
      .select(AbsenzenService.SELECT_FELDER)
      .order('start', { ascending: true });
    if (error) {
      throw new Error(error.message);
    }
    let termine = (data ?? []).map(this.zuTermin);

    const basisZeilen = termine.filter((t) => t.istDauerauftrag && !t.ausnahmeVonId);
    if (basisZeilen.length > 0) {
      const neue = await this.materialisiereFehlendeSerientermine(basisZeilen, termine, true);
      if (neue.length > 0) {
        termine = [...termine, ...neue].sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
        );
      }
    }

    return termine;
  }

  async ladeTermin(eventId: string): Promise<Termin | null> {
    const { data, error } = await this.supabase
      .from('trainings_anlaesse')
      .select(AbsenzenService.SELECT_FELDER)
      .eq('id', eventId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? this.zuTermin(data) : null;
  }

  /**
   * Legt einen neuen Trainer-Termin an (einmalig, Dauerauftrag-Basiszeile,
   * oder - bei einem mehrtägigen Anlass - eine Eltern-Zeile plus je eine
   * Tages-Instanz pro Kalendertag, verknüpft über "ausnahme_von_id". Nur so
   * bekommt jeder Tag eigene, unabhängige Abwesenheiten-Einträge, da
   * "abwesenheiten" pro event_id nur einen Status je Person speichert.
   */
  async erstelleTermin(neuerTermin: NeuerTermin): Promise<void> {
    const { data: auth } = await this.supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      throw new Error('Nicht angemeldet.');
    }

    const { data: profil, error: profilError } = await this.supabase
      .from('profiles')
      .select('gruppe_id')
      .eq('id', userId)
      .single();
    if (profilError || !profil?.gruppe_id) {
      throw new Error('Gruppe konnte nicht ermittelt werden.');
    }
    const gruppeId = profil.gruppe_id;

    const tage = this.mehrtaegigeKalendertage(neuerTermin);
    if (neuerTermin.typ === 'anlass' && tage.length > 1) {
      const { data: eltern, error: elternError } = await this.supabase
        .from('trainings_anlaesse')
        .insert({
          gruppe_id: gruppeId,
          typ: neuerTermin.typ,
          titel: neuerTermin.titel,
          start: neuerTermin.start,
          ende: this.mitUhrzeitVonEnde(tage[tage.length - 1], neuerTermin),
          ist_dauerauftrag: false,
          verfalldatum: null,
          bemerkung: neuerTermin.bemerkung,
        })
        .select('id')
        .single();
      if (elternError || !eltern) {
        throw new Error(elternError?.message ?? 'Anlass konnte nicht erstellt werden.');
      }

      const kindZeilen = tage.map((tag) => ({
        gruppe_id: gruppeId,
        typ: neuerTermin.typ,
        titel: neuerTermin.titel,
        start: this.mitUhrzeitVonStart(tag, neuerTermin),
        ende: this.mitUhrzeitVonEnde(tag, neuerTermin),
        ist_dauerauftrag: false,
        verfalldatum: null,
        ausnahme_von_id: eltern.id,
        bemerkung: neuerTermin.bemerkung,
      }));
      const { error: kinderError } = await this.supabase.from('trainings_anlaesse').insert(kindZeilen);
      if (kinderError) {
        throw new Error(kinderError.message);
      }
      return;
    }

    if (neuerTermin.istDauerauftrag) {
      const { data: basis, error: basisError } = await this.supabase
        .from('trainings_anlaesse')
        .insert({
          gruppe_id: gruppeId,
          typ: neuerTermin.typ,
          titel: neuerTermin.titel,
          start: neuerTermin.start,
          ende: neuerTermin.ende,
          ist_dauerauftrag: true,
          verfalldatum: neuerTermin.verfalldatum,
          bemerkung: neuerTermin.bemerkung,
        })
        .select(AbsenzenService.SELECT_FELDER)
        .single();
      if (basisError || !basis) {
        throw new Error(basisError?.message ?? 'Termin konnte nicht erstellt werden.');
      }

      // Bereits hier die anzeigbaren Wochen-Instanzen anlegen, damit die
      // Übersicht sofort echte Zähler für alle Serientermine hat, statt
      // erst beim nächsten Laden nachzuziehen.
      await this.materialisiereFehlendeSerientermine([this.zuTermin(basis)], [], false);
      return;
    }

    const { error } = await this.supabase.from('trainings_anlaesse').insert({
      gruppe_id: gruppeId,
      typ: neuerTermin.typ,
      titel: neuerTermin.titel,
      start: neuerTermin.start,
      ende: neuerTermin.ende,
      ist_dauerauftrag: false,
      verfalldatum: null,
      bemerkung: neuerTermin.bemerkung,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Aktualisiert genau eine Termin-Zeile (Titel, Datum, Uhrzeit, Bemerkung) -
   * für einen einmaligen Termin oder eine einzelne Dauerauftrag-Woche, ohne
   * die restliche Serie zu berühren. Setzt dabei immer auch abgesagt/
   * abgesagt_am zurück: das erneute Speichern über das Bearbeiten-Formular
   * wirkt so implizit als "Termin wieder aktivieren", ohne dass es dafür
   * einen eigenen Button braucht. War der Termin nicht abgesagt, ändert das
   * nichts (bleibt false/null).
   */
  async aktualisiereEinzelnesElement(eventId: string, datum: string, aenderung: TerminAenderung): Promise<void> {
    const { error } = await this.supabase
      .from('trainings_anlaesse')
      .update({
        titel: aenderung.titel,
        start: new Date(`${datum}T${aenderung.startZeit}`).toISOString(),
        ende: aenderung.endZeit ? new Date(`${datum}T${aenderung.endZeit}`).toISOString() : null,
        bemerkung: aenderung.bemerkung,
        abgesagt: false,
        abgesagt_am: null,
      })
      .eq('id', eventId);
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Aktualisiert Titel/Uhrzeit/Bemerkung einer ganzen Dauerauftrag-Serie:
   * die Basiszeile sowie alle bereits materialisierten, noch bevorstehenden
   * Wochen-Instanzen (vergangene Wochen bleiben als Verlauf unverändert).
   * Nur die Uhrzeit wird übernommen, das jeweilige Datum jeder Woche bleibt
   * bestehen - ein Wochentag-Wechsel für die ganze Serie ist hier bewusst
   * nicht vorgesehen, das wäre eine komplette Neuberechnung der Serie.
   */
  async aktualisiereSerie(basisId: string, aenderung: TerminAenderung): Promise<void> {
    const basis = await this.ladeTermin(basisId);
    if (!basis) {
      throw new Error('Serie konnte nicht gefunden werden.');
    }

    const [startStunden, startMinuten] = aenderung.startZeit.split(':').map(Number);
    const endeTeile = aenderung.endZeit ? aenderung.endZeit.split(':').map(Number) : null;

    const { error: basisError } = await this.supabase
      .from('trainings_anlaesse')
      .update({
        titel: aenderung.titel,
        start: this.mitNeuerUhrzeit(basis.start, startStunden, startMinuten),
        ende: endeTeile ? this.mitNeuerUhrzeit(basis.ende ?? basis.start, endeTeile[0], endeTeile[1]) : null,
        bemerkung: aenderung.bemerkung,
      })
      .eq('id', basisId);
    if (basisError) {
      throw new Error(basisError.message);
    }

    const { data: zukuenftige, error: ladeError } = await this.supabase
      .from('trainings_anlaesse')
      .select('id, start, ende')
      .eq('ausnahme_von_id', basisId)
      .gte('start', new Date().toISOString());
    if (ladeError) {
      throw new Error(ladeError.message);
    }

    for (const kind of zukuenftige ?? []) {
      const { error } = await this.supabase
        .from('trainings_anlaesse')
        .update({
          titel: aenderung.titel,
          start: this.mitNeuerUhrzeit(kind.start, startStunden, startMinuten),
          ende: endeTeile ? this.mitNeuerUhrzeit(kind.ende ?? kind.start, endeTeile[0], endeTeile[1]) : null,
          bemerkung: aenderung.bemerkung,
        })
        .eq('id', kind.id);
      if (error) {
        throw new Error(error.message);
      }
    }
  }

  /**
   * Löscht einen einzelnen Termin unwiderruflich - für einen einmaligen
   * Termin oder eine einzelne Dauerauftrag-Woche, ohne die restliche Serie
   * zu berühren. Zugehörige Abwesenheiten-Einträge werden per
   * ON DELETE CASCADE (siehe 0001_init.sql, Spalte abwesenheiten.event_id)
   * automatisch mitgelöscht.
   */
  async loescheEinzelnesElement(eventId: string): Promise<void> {
    const { error } = await this.supabase.from('trainings_anlaesse').delete().eq('id', eventId);
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Löscht alle noch bevorstehenden Instanzen einer Dauerauftrag-Serie
   * (vergangene Wochen bleiben als Verlauf erhalten) und begrenzt danach
   * das Verfalldatum der Basiszeile auf "gestern". Ohne diesen zweiten
   * Schritt würde materialisiereFehlendeSerientermine() beim nächsten Laden
   * die soeben gelöschten Wochen einfach wieder nachziehen, da die
   * Basiszeile selbst (ist_dauerauftrag = true) weiterhin existiert.
   */
  async loescheSerie(basisId: string): Promise<void> {
    const { error: loeschError } = await this.supabase
      .from('trainings_anlaesse')
      .delete()
      .eq('ausnahme_von_id', basisId)
      .gte('start', new Date().toISOString());
    if (loeschError) {
      throw new Error(loeschError.message);
    }

    const gestern = new Date();
    gestern.setDate(gestern.getDate() - 1);
    const verfalldatum = gestern.toISOString().slice(0, 10);

    const { error: verfallError } = await this.supabase
      .from('trainings_anlaesse')
      .update({ verfalldatum })
      .eq('id', basisId);
    if (verfallError) {
      throw new Error(verfallError.message);
    }
  }

  private mitNeuerUhrzeit(iso: string, stunden: number, minuten: number): string {
    const datum = new Date(iso);
    datum.setHours(stunden, minuten, 0, 0);
    return datum.toISOString();
  }

  /**
   * Legt für jede Dauerauftrag-Basiszeile die noch fehlenden wöchentlichen
   * Instanzen als echte Zeilen an (verknüpft über "ausnahme_von_id"), damit
   * jede angezeigte Karte eine eigene event_id mit echten Abwesenheiten hat.
   * Das INSERT ist per RLS nur Trainern erlaubt - beim opportunistischen
   * Nachziehen (stumm=true, z.B. beim Laden durch Volti/Eltern) werden
   * Berechtigungsfehler deshalb bewusst verschluckt: die fehlenden Wochen
   * erscheinen dann beim nächsten Laden durch eine Trainer-Person.
   */
  private async materialisiereFehlendeSerientermine(
    basisZeilen: Termin[],
    vorhandeneTermine: Termin[],
    stumm: boolean,
  ): Promise<Termin[]> {
    const neueZeilen: Termin[] = [];

    for (const basis of basisZeilen) {
      const vorhandeneStartZeiten = new Set(
        vorhandeneTermine
          .filter((t) => t.ausnahmeVonId === basis.id)
          .map((t) => new Date(t.start).getTime()),
      );

      const instanzen = generiereSerientermine({
        start: new Date(basis.start),
        ende: basis.ende ? new Date(basis.ende) : null,
        verfalldatum: basis.verfalldatum ? new Date(basis.verfalldatum) : null,
      });
      const fehlende = instanzen.filter((i) => !vorhandeneStartZeiten.has(i.start.getTime()));
      if (fehlende.length === 0) {
        continue;
      }

      const kindZeilen = fehlende.map((instanz) => ({
        gruppe_id: basis.gruppeId,
        typ: basis.typ,
        titel: basis.titel,
        start: instanz.start.toISOString(),
        ende: instanz.ende?.toISOString() ?? null,
        ist_dauerauftrag: false,
        verfalldatum: null,
        ausnahme_von_id: basis.id,
        bemerkung: basis.bemerkung,
      }));

      const { data, error } = await this.supabase
        .from('trainings_anlaesse')
        .insert(kindZeilen)
        .select(AbsenzenService.SELECT_FELDER);
      if (error) {
        if (stumm) {
          continue;
        }
        throw new Error(error.message);
      }
      neueZeilen.push(...(data ?? []).map(this.zuTermin));
    }

    return neueZeilen;
  }

  /** Liste der Kalendertage zwischen Start- und Enddatum (inklusive), falls ein Enddatum gesetzt ist. */
  private mehrtaegigeKalendertage(neuerTermin: NeuerTermin): Date[] {
    if (!neuerTermin.endDatum) {
      return [];
    }
    const start = new Date(neuerTermin.start);
    start.setHours(0, 0, 0, 0);
    const ende = new Date(`${neuerTermin.endDatum}T00:00`);
    if (ende.getTime() <= start.getTime()) {
      return [];
    }
    const tage: Date[] = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= ende.getTime()) {
      tage.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return tage;
  }

  private mitUhrzeitVonStart(tag: Date, neuerTermin: NeuerTermin): string {
    const start = new Date(neuerTermin.start);
    const ergebnis = new Date(tag);
    ergebnis.setHours(start.getHours(), start.getMinutes(), 0, 0);
    return ergebnis.toISOString();
  }

  private mitUhrzeitVonEnde(tag: Date, neuerTermin: NeuerTermin): string | null {
    if (!neuerTermin.ende) {
      return null;
    }
    const ende = new Date(neuerTermin.ende);
    const ergebnis = new Date(tag);
    ergebnis.setHours(ende.getHours(), ende.getMinutes(), 0, 0);
    return ergebnis.toISOString();
  }

  private zuTermin(row: {
    id: string;
    gruppe_id: string;
    titel: string;
    typ: 'training' | 'anlass' | 'turnier';
    start: string;
    ende: string | null;
    ist_dauerauftrag: boolean | null;
    verfalldatum: string | null;
    ausnahme_von_id: string | null;
    bemerkung: string | null;
    abgesagt?: boolean | null;
  }): Termin {
    return {
      id: row.id,
      gruppeId: row.gruppe_id,
      titel: row.titel,
      typ: row.typ,
      start: row.start,
      ende: row.ende,
      istDauerauftrag: row.ist_dauerauftrag ?? false,
      verfalldatum: row.verfalldatum,
      ausnahmeVonId: row.ausnahme_von_id,
      bemerkung: row.bemerkung,
      abgesagt: row.abgesagt ?? false,
    };
  }

  /**
   * Markiert einen einzelnen Termin (nicht die ganze Serie) als abgesagt.
   * Der Termin bleibt sichtbar, wird aber in der Übersicht durchgestrichen/
   * gedämpft dargestellt und verliert dort den Anwesend-/Abwesend-Bereich.
   * Wie bei aktualisiereEinzelnesElement() ist nur die eine Zeile betroffen -
   * bei einer Serie müsste jede Woche einzeln abgesagt werden.
   */
  async sageTerminAb(eventId: string): Promise<void> {
    const { error } = await this.supabase
      .from('trainings_anlaesse')
      .update({ abgesagt: true, abgesagt_am: new Date().toISOString() })
      .eq('id', eventId);
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Volti-Teilnehmerliste der eigenen Gruppe für ein Training/Anlass, mit
   * Absenz-Status. Fehlt eine Zeile in "abwesenheiten", gilt der Default
   * "anwesend" (kein manuelles Melden nötig, um anwesend zu sein).
   */
  async ladeTeilnehmer(eventId: string): Promise<TeilnehmerAbsenz[]> {
    const [voltiResult, absenzenResult] = await Promise.all([
      this.supabase
        .from('profiles')
        .select('id, vorname, nachname')
        .eq('rolle', 'volti')
        .is('geloescht_am', null),
      this.supabase
        .from('abwesenheiten_public')
        .select('profile_id, status, grund, ist_privat')
        .eq('event_id', eventId)
        .not('profile_id', 'is', null),
    ]);

    if (voltiResult.error) {
      throw new Error(voltiResult.error.message);
    }
    if (absenzenResult.error) {
      throw new Error(absenzenResult.error.message);
    }

    const absenzenNachProfil = new Map(absenzenResult.data?.map((a) => [a.profile_id as string, a]));

    return (voltiResult.data ?? [])
      .map((volti) => {
        const absenz = absenzenNachProfil.get(volti.id);
        return {
          profileId: volti.id,
          vorname: volti.vorname,
          nachname: volti.nachname,
          status: (absenz?.status as AbsenzStatus) ?? 'anwesend',
          grund: absenz?.grund ?? null,
          istPrivat: absenz?.ist_privat ?? true,
        };
      })
      .sort((a, b) => `${a.vorname} ${a.nachname}`.localeCompare(`${b.vorname} ${b.nachname}`));
  }

  async setzeAbsenz(
    eventId: string,
    profileId: string,
    status: AbsenzStatus,
    grund: string | null,
    istPrivat: boolean,
  ): Promise<void> {
    const { data: auth } = await this.supabase.auth.getUser();
    const gemeldetVon = auth.user?.id;

    const { error } = await this.supabase
      .from('abwesenheiten')
      .upsert(
        {
          event_id: eventId,
          profile_id: profileId,
          status,
          grund: status === 'abwesend' ? grund : null,
          ist_privat: istPrivat,
          gemeldet_von: gemeldetVon,
        },
        { onConflict: 'event_id,profile_id' },
      );
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Realtime-Abo auf Änderungen für ein Event. Wichtig: Der Payload
   * enthält technisch den ungemaskten "grund", da Supabase Realtime keine
   * Views unterstützt (siehe Migration 0006). Callback sollte daher nie
   * payload.new/old.grund direkt anzeigen, sondern die Zeile über
   * ladeTeilnehmer() neu holen bzw. serverseitig maskieren lassen.
   */
  abonniereEvent(eventId: string, onChange: () => void): RealtimeChannel {
    return this.supabase
      .channel(`abwesenheiten-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'abwesenheiten', filter: `event_id=eq.${eventId}` },
        () => onChange(),
      )
      .subscribe();
  }

  beendeAbo(channel: RealtimeChannel): void {
    void this.supabase.removeChannel(channel);
  }
}
