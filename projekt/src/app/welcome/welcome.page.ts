import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonImg } from '@ionic/angular';
import { HAS_SEEN_WELCOME_KEY } from '../guards/welcome.guard';

@Component({
  selector: 'app-welcome',
  templateUrl: 'welcome.page.html',
  styleUrls: ['welcome.page.scss'],
  imports: [IonContent, IonButton, IonImg],
})
export class WelcomePage {
  private readonly router = inject(Router);

  weiterZuRegistrierung(): void {
    this.markiereAlsGesehen();
    this.router.navigateByUrl('/auth/registrierung');
  }

  weiterZuAnmeldung(): void {
    this.markiereAlsGesehen();
    this.router.navigateByUrl('/auth/anmeldung');
  }

  private markiereAlsGesehen(): void {
    localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true');
  }
}
