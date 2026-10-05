import { TestBed } from '@angular/core/testing';

import { AbsenzenService } from './absenzen.service';
import { SupabaseService } from './supabase.service';

/**
 * Baut einen minimalen Supabase-Client-Stub für .from(...).update(...).eq(...),
 * der die übergebenen Argumente für Assertions aufzeichnet.
 */
function baueSupabaseUpdateMock() {
  const eqMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
  const fromMock = vi.fn().mockReturnValue({ update: updateMock });
  return { fromMock, updateMock, eqMock };
}

/**
 * Baut einen minimalen Supabase-Client-Stub für .from(...).delete().eq(...),
 * wie ihn loescheEinzelnesElement() verwendet.
 */
function baueSupabaseDeleteMock() {
  const eqMock = vi.fn().mockResolvedValue({ error: null });
  const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
  const fromMock = vi.fn().mockReturnValue({ delete: deleteMock });
  return { fromMock, deleteMock, eqMock };
}

/**
 * Baut einen Supabase-Client-Stub, der sowohl .delete().eq().gte(...) (löscht
 * die zukünftigen Serien-Instanzen) als auch .update({...}).eq(...) (begrenzt
 * das Verfalldatum der Basiszeile) bedient, wie es loescheSerie() nacheinander
 * aufruft.
 */
function baueSupabaseSerieLoeschenMock() {
  const gteMock = vi.fn().mockResolvedValue({ error: null });
  const deleteEqMock = vi.fn().mockReturnValue({ gte: gteMock });
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock });

  const updateEqMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

  const fromMock = vi.fn().mockReturnValue({ delete: deleteMock, update: updateMock });
  return { fromMock, deleteMock, deleteEqMock, gteMock, updateMock, updateEqMock };
}

describe('AbsenzenService', () => {
  it('setzt beim Bearbeiten eines einzelnen Termins abgesagt/abgesagt_am zurück (implizites Reaktivieren)', async () => {
    const { fromMock, updateMock, eqMock } = baueSupabaseUpdateMock();

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { supabase: { from: fromMock } } }],
    });
    const service = TestBed.inject(AbsenzenService);

    await service.aktualisiereEinzelnesElement('event-1', '2026-09-10', {
      titel: 'Training',
      startZeit: '18:15',
      endZeit: '19:45',
      bemerkung: null,
    });

    expect(fromMock).toHaveBeenCalledWith('trainings_anlaesse');
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ abgesagt: false, abgesagt_am: null }));
    expect(eqMock).toHaveBeenCalledWith('id', 'event-1');
  });

  it('löscht bei loescheEinzelnesElement genau die eine Termin-Zeile über die id', async () => {
    const { fromMock, deleteMock, eqMock } = baueSupabaseDeleteMock();

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { supabase: { from: fromMock } } }],
    });
    const service = TestBed.inject(AbsenzenService);

    await service.loescheEinzelnesElement('event-1');

    expect(fromMock).toHaveBeenCalledWith('trainings_anlaesse');
    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith('id', 'event-1');
    // Das kaskadierende Löschen der zugehörigen abwesenheiten-Zeilen läuft
    // über die Datenbank-Fremdschlüsselbeziehung (ON DELETE CASCADE,
    // abwesenheiten.event_id -> trainings_anlaesse.id, siehe 0001_init.sql)
    // und lässt sich mit einem gemockten Client hier nicht selbst
    // nachweisen - nur, dass der Trainer-Client den DELETE korrekt absetzt.
  });

  it('löscht bei loescheSerie alle zukünftigen Instanzen der Serie und begrenzt das Verfalldatum der Basiszeile', async () => {
    const { fromMock, deleteMock, deleteEqMock, gteMock, updateMock, updateEqMock } = baueSupabaseSerieLoeschenMock();

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { supabase: { from: fromMock } } }],
    });
    const service = TestBed.inject(AbsenzenService);

    await service.loescheSerie('basis-1');

    expect(deleteMock).toHaveBeenCalled();
    expect(deleteEqMock).toHaveBeenCalledWith('ausnahme_von_id', 'basis-1');
    expect(gteMock).toHaveBeenCalledWith('start', expect.any(String));

    // Ohne diese Begrenzung würde materialisiereFehlendeSerientermine() die
    // gerade gelöschten Wochen beim nächsten Laden wieder nachziehen.
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ verfalldatum: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
    );
    expect(updateEqMock).toHaveBeenCalledWith('id', 'basis-1');
  });
});
