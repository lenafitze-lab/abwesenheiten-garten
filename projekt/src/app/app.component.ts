import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet, IonIcon } from '@ionic/angular';
import { SwUpdate } from '@angular/service-worker';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline } from 'ionicons/icons';
import { AppearanceService } from './services/appearance.service';
import { OfflineService } from './services/offline.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [IonApp, IonRouterOutlet, IonIcon],
})
export class AppComponent {
  // Injizieren genügt: der Constructor von AppearanceService wendet
  // Darkmode/Farbschema sofort beim App-Start an.
  private readonly appearance = inject(AppearanceService);
  private swUpdate = inject(SwUpdate);
  protected readonly offlineService = inject(OfflineService);

  constructor() {
    addIcons({ cloudOfflineOutline });
    this.swUpdate.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        if (confirm('Neue Version verfügbar. Seite neu laden?')) {
          window.location.reload();
        }
      }
    });
  }
}