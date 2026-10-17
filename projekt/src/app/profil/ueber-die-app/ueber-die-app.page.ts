import { Component } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonImg,
  IonIcon,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { personOutline, codeSlashOutline } from 'ionicons/icons';
import { version as appVersion } from '../../../../package.json';
import { GRUPPEN_NAME } from '../../shared/gruppe';

@Component({
  selector: 'app-ueber-die-app',
  templateUrl: 'ueber-die-app.page.html',
  styleUrls: ['ueber-die-app.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonImg, IonIcon],
})
export class UeberDieAppPage {
  protected readonly gruppenName = GRUPPEN_NAME;
  protected readonly appVersion = appVersion;
  protected readonly jahr = new Date().getFullYear();

  constructor() {
    addIcons({ personOutline, codeSlashOutline });
  }
}
