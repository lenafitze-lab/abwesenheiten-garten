import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { ErrorHandler, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDeCH from '@angular/common/locales/de-CH';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { GlobalErrorHandler } from './app/services/global-error-handler';

registerLocaleData(localeDeCH);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: LOCALE_ID, useValue: 'de-CH' },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // scrollAssist/scrollPadding sind Ionics automatisches "beim Fokussieren
    // eines Feldes die Seite hochscrollen, damit es über der Tastatur
    // sichtbar bleibt" - genau das fühlt sich als ruckartiges "alles
    // verschiebt sich" an. Moderne Mobile-Browser scrollen fokussierte
    // Felder ohnehin selbst ins Sichtfeld, daher hier bewusst deaktiviert.
    provideIonicAngular({ scrollAssist: false, scrollPadding: false }),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ],
});
