import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideIonicAngular } from '@ionic/angular';

import { PacklistePage } from './packliste.page';
import { PacklisteItem, PacklisteService } from '../services/packliste.service';
import { AuthService, AuthUser } from '../services/auth.service';

function baueItems(): PacklisteItem[] {
  return [
    { id: 'i1', name: 'Voltigegurt', abgehakt: false, abgehaktVonName: null, abgehaktAm: null },
    { id: 'i2', name: 'Pad', abgehakt: true, abgehaktVonName: 'Anika Müller', abgehaktAm: '2026-09-10T10:00:00Z' },
  ];
}

function baueUser(role: AuthUser['role']): AuthUser {
  return {
    id: 'u1',
    email: 'test@example.com',
    role,
    firstName: 'Test',
    lastName: 'Person',
    avatarDataUrl: null,
    group: 'Garten 1',
  };
}

describe('PacklistePage', () => {
  let component: PacklistePage;
  let fixture: ComponentFixture<PacklistePage>;
  let ladeItemsMock: ReturnType<typeof vi.fn>;
  let setzeAbgehaktMock: ReturnType<typeof vi.fn>;
  let currentUserSignal: ReturnType<typeof signal<AuthUser | null>>;

  beforeEach(async () => {
    ladeItemsMock = vi.fn().mockResolvedValue(baueItems());
    setzeAbgehaktMock = vi.fn().mockResolvedValue(undefined);
    currentUserSignal = signal<AuthUser | null>(baueUser('Trainer'));

    await TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        {
          provide: PacklisteService,
          useValue: {
            ladeItems: ladeItemsMock,
            ladeEigeneGruppeId: vi.fn().mockResolvedValue('gruppe-1'),
            abonniereGruppe: vi.fn().mockReturnValue({}),
            beendeAbo: vi.fn(),
            setzeAbgehakt: setzeAbgehaktMock,
            fuegeItemHinzu: vi.fn().mockResolvedValue(undefined),
            loescheItem: vi.fn().mockResolvedValue(undefined),
            allesZuruecksetzen: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PacklistePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('sollte erstellt werden', () => {
    expect(component).toBeTruthy();
  });

  it('lädt die Items beim Start', () => {
    expect(ladeItemsMock).toHaveBeenCalled();
    expect(component.items().length).toBe(2);
  });

  it('zeigt istTrainer und kannAbhaken korrekt für Trainer', () => {
    expect(component.istTrainer()).toBe(true);
    expect(component.kannAbhaken()).toBe(true);
  });

  it('erlaubt Volti das Abhaken, aber keine Trainer-only Aktionen', () => {
    currentUserSignal.set(baueUser('Volti'));
    expect(component.istTrainer()).toBe(false);
    expect(component.kannAbhaken()).toBe(true);
  });

  it('erlaubt Eltern weder Abhaken noch Trainer-only Aktionen', () => {
    currentUserSignal.set(baueUser('Eltern'));
    expect(component.istTrainer()).toBe(false);
    expect(component.kannAbhaken()).toBe(false);
  });

  it('ruft setzeAbgehakt mit dem umgekehrten Status auf', async () => {
    const item = component.items()[0];
    await component.toggle(item);
    expect(setzeAbgehaktMock).toHaveBeenCalledWith(item.id, !item.abgehakt);
  });

  it('verhindert das Abhaken für Eltern', async () => {
    currentUserSignal.set(baueUser('Eltern'));
    const item = component.items()[0];
    await component.toggle(item);
    expect(setzeAbgehaktMock).not.toHaveBeenCalled();
  });
});
