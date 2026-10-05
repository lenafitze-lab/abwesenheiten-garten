import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';
import { welcomeGuard } from './guards/welcome.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'welcome',
  },
  {
    path: 'welcome',
    canActivate: [welcomeGuard],
    loadComponent: () => import('./welcome/welcome.page').then((m) => m.WelcomePage),
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then((m) => m.routes),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'fehler/:typ',
    loadComponent: () => import('./fehler/fehler.page').then((m) => m.FehlerPage),
  },
  {
    path: '**',
    redirectTo: 'fehler/404',
  },
];
