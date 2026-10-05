import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';

import { UeberDieAppPage } from './ueber-die-app.page';
import { version as appVersion } from '../../../../package.json';

describe('UeberDieAppPage', () => {
  let component: UeberDieAppPage;
  let fixture: ComponentFixture<UeberDieAppPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideIonicAngular()],
    }).compileComponents();

    fixture = TestBed.createComponent(UeberDieAppPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sollte erstellt werden', () => {
    expect(component).toBeTruthy();
  });

  it('zeigt die aktuelle App-Version aus package.json als Badge an', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.version-badge')?.textContent).toContain(appVersion);
  });

  it('zeigt Entwickler und Technologien in der Info-Karte', () => {
    const element = fixture.nativeElement as HTMLElement;
    const zeilen = element.querySelectorAll('.info-zeile');
    expect(zeilen.length).toBe(2);
    expect(zeilen[0].textContent).toContain('Lena Fitze');
    expect(zeilen[1].textContent).toContain('Ionic & Angular, Supabase');
  });

  it('zeigt das aktuelle Jahr im Copyright-Hinweis', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.copyright')?.textContent).toContain(String(new Date().getFullYear()));
  });
});
