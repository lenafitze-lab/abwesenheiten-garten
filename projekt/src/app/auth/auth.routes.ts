import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'anmeldung',
    loadComponent: () => import('./anmeldung/anmeldung.page').then((m) => m.AnmeldungPage),
  },
  {
    path: 'registrierung',
    loadComponent: () => import('./registrierung/registrierung.page').then((m) => m.RegistrierungPage),
  },
  {
    path: 'registrierung/rolle',
    loadComponent: () => import('./rolle-waehlen/rolle-waehlen.page').then((m) => m.RolleWaehlenPage),
  },
  {
    path: 'registrierung/profil',
    loadComponent: () =>
      import('./profil-vervollstaendigen/profil-vervollstaendigen.page').then(
        (m) => m.ProfilVervollstaendigenPage,
      ),
  },
  {
    path: 'passwort-vergessen',
    loadComponent: () => import('./passwort-vergessen/passwort-vergessen.page').then((m) => m.PasswortVergessenPage),
  },
  {
    path: 'passwort-zuruecksetzen',
    loadComponent: () =>
      import('./passwort-zuruecksetzen/passwort-zuruecksetzen.page').then((m) => m.PasswortZuruecksetzenPage),
  },
  {
    path: '',
    redirectTo: 'anmeldung',
    pathMatch: 'full',
  },
];
