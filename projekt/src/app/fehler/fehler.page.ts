import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon, IonButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { compassOutline, lockClosedOutline, cloudOfflineOutline } from 'ionicons/icons';

type FehlerTyp = '404' | 'keine-berechtigung' | 'server';

interface FehlerInhalt {
  icon: string;
  titel: string;
  meldung: string;
  aktionsText: string;
}

const FEHLER_INHALTE: Record<FehlerTyp, FehlerInhalt> = {
  '404': {
    icon: 'compass-outline',
    titel: 'Seite nicht gefunden',
    meldung: 'Diese Seite gibt es nicht (mehr) - vielleicht wurde die Seite gelöscht oder der Link ist veraltet.',
    aktionsText: 'Zur Startseite',
  },
  'keine-berechtigung': {
    icon: 'lock-closed-outline',
    titel: 'Keine Berechtigung',
    meldung:
      'Für diesen Bereich brauchst du eine andere Rolle. Falls du glaubst, dass das ein Fehler ist, wende dich an eine Trainerin oder einen Trainer.',
    aktionsText: 'Zur Startseite',
  },
  server: {
    icon: 'cloud-offline-outline',
    titel: 'Etwas ist schiefgelaufen',
    meldung: 'Die Verbindung zum Server hat gerade nicht geklappt. Bitte versuch es in ein paar Momenten erneut.',
    aktionsText: 'Erneut versuchen',
  },
};

function istFehlerTyp(wert: string | null): wert is FehlerTyp {
  return wert === '404' || wert === 'keine-berechtigung' || wert === 'server';
}

@Component({
  selector: 'app-fehler',
  templateUrl: 'fehler.page.html',
  styleUrls: ['fehler.page.scss'],
  imports: [IonContent, IonIcon, IonButton],
})
export class FehlerPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly typ = signal<FehlerTyp>('404');

  readonly inhalt = computed(() => FEHLER_INHALTE[this.typ()]);

  constructor() {
    addIcons({ compassOutline, lockClosedOutline, cloudOfflineOutline });
    const wert = this.route.snapshot.paramMap.get('typ');
    this.typ.set(istFehlerTyp(wert) ? wert : '404');
  }

  aktion(): void {
    if (this.typ() === 'server') {
      window.location.reload();
      return;
    }
    this.router.navigateByUrl('/');
  }
}
