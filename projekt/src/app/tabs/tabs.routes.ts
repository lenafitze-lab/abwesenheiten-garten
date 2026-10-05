import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'abwesenheiten',
        loadComponent: () =>
          import('../abwesenheiten/abwesenheiten.page').then((m) => m.AbwesenheitenPage),
      },
      {
        path: 'packliste',
        loadComponent: () =>
          import('../packliste/packliste.page').then((m) => m.PacklistePage),
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('../profil/profil.page').then((m) => m.ProfilPage),
      },
      {
        // Bewusst kein Menüpunkt/Icon dafür - nur über die klickbare
        // Versionsnummer im Profil erreichbar (siehe profil.page.html).
        path: 'profil/ueber-die-app',
        loadComponent: () =>
          import('../profil/ueber-die-app/ueber-die-app.page').then((m) => m.UeberDieAppPage),
      },
      {
        path: '',
        redirectTo: '/tabs/abwesenheiten',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/abwesenheiten',
    pathMatch: 'full',
  },
];
