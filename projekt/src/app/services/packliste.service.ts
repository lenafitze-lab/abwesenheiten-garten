import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export interface PacklisteItem {
  id: string;
  name: string;
  abgehakt: boolean;
  abgehaktVonName: string | null;
  abgehaktAm: string | null;
}

@Injectable({ providedIn: 'root' })
export class PacklisteService {
  private readonly supabaseService = inject(SupabaseService);
  private get supabase() {
    return this.supabaseService.supabase;
  }

  /**
   * Lädt die globale Packliste der eigenen Gruppe. "abgehakt_von" verweist
   * auf auth.users (nicht direkt auf profiles), PostgREST kann das also
   * nicht automatisch embedden - deshalb wie bei ladeTeilnehmer() zwei
   * Abfragen und ein clientseitiger Join per Map.
   */
  async ladeItems(): Promise<PacklisteItem[]> {
    const { data: items, error } = await this.supabase
      .from('packliste_items')
      .select('id, name, abgehakt, abgehakt_von, abgehakt_am')
      .order('name', { ascending: true });
    if (error) {
      throw new Error(error.message);
    }

    const abgehaktVonIds = [...new Set((items ?? []).map((i) => i.abgehakt_von).filter((id): id is string => !!id))];

    const namenNachId = new Map<string, string>();
    if (abgehaktVonIds.length > 0) {
      const { data: profile, error: profilError } = await this.supabase
        .from('profiles')
        .select('id, vorname, nachname')
        .in('id', abgehaktVonIds);
      if (profilError) {
        throw new Error(profilError.message);
      }
      for (const p of profile ?? []) {
        namenNachId.set(p.id, `${p.vorname} ${p.nachname}`);
      }
    }

    return (items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      abgehakt: item.abgehakt ?? false,
      abgehaktVonName: item.abgehakt_von ? (namenNachId.get(item.abgehakt_von) ?? null) : null,
      abgehaktAm: item.abgehakt_am,
    }));
  }

  /** Ermittelt die eigene Gruppe - gebraucht für neue Items und das Realtime-Abo. */
  async ladeEigeneGruppeId(): Promise<string> {
    const { data: auth } = await this.supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      throw new Error('Nicht angemeldet.');
    }
    const { data, error } = await this.supabase.from('profiles').select('gruppe_id').eq('id', userId).single();
    if (error || !data?.gruppe_id) {
      throw new Error('Gruppe konnte nicht ermittelt werden.');
    }
    return data.gruppe_id;
  }

  async setzeAbgehakt(itemId: string, abgehakt: boolean): Promise<void> {
    const { data: auth } = await this.supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      throw new Error('Nicht angemeldet.');
    }

    const { error } = await this.supabase
      .from('packliste_items')
      .update({
        abgehakt,
        abgehakt_von: abgehakt ? userId : null,
        abgehakt_am: abgehakt ? new Date().toISOString() : null,
      })
      .eq('id', itemId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async fuegeItemHinzu(name: string): Promise<void> {
    const gruppeId = await this.ladeEigeneGruppeId();
    const { error } = await this.supabase.from('packliste_items').insert({ gruppe_id: gruppeId, name });
    if (error) {
      throw new Error(error.message);
    }
  }

  async loescheItem(itemId: string): Promise<void> {
    const { error } = await this.supabase.from('packliste_items').delete().eq('id', itemId);
    if (error) {
      throw new Error(error.message);
    }
  }

  /** Setzt alle abgehakten Items der eigenen Gruppe zurück (z.B. nach einem Anlass). */
  async allesZuruecksetzen(): Promise<void> {
    const { error } = await this.supabase
      .from('packliste_items')
      .update({ abgehakt: false, abgehakt_von: null, abgehakt_am: null })
      .eq('abgehakt', true);
    if (error) {
      throw new Error(error.message);
    }
  }

  abonniereGruppe(gruppeId: string, onChange: () => void): RealtimeChannel {
    return this.supabase
      .channel(`packliste-${gruppeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'packliste_items', filter: `gruppe_id=eq.${gruppeId}` },
        () => onChange(),
      )
      .subscribe();
  }

  beendeAbo(channel: RealtimeChannel): void {
    void this.supabase.removeChannel(channel);
  }
}
