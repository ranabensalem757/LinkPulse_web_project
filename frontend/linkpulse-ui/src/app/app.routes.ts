import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { DEMO_MODE } from './core/demo/demo-mode';
import { DemoDashboardService, DemoIncidentsService, DemoSitesService } from './demo/demo-services';
import { DashboardService } from './core/services/dashboard.service';
import { IncidentsService } from './core/services/incidents.service';
import { SitesService } from './core/services/sites.service';

export const routes: Routes = [
  {
    path: 'demo',
    providers: [
      { provide: DEMO_MODE, useValue: true },
      { provide: DashboardService, useClass: DemoDashboardService },
      { provide: SitesService, useClass: DemoSitesService },
      { provide: IncidentsService, useClass: DemoIncidentsService },
    ],
    loadComponent: () =>
      import('./layout/demo-layout/demo-layout').then(m => m.DemoLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard').then(m => m.DashboardComponent),
        title: 'Dashboard',
      },
      {
        path: 'sites',
        loadComponent: () =>
          import('./pages/monitored-sites/monitored-sites').then(m => m.MonitoredSitesComponent),
        title: 'Sites surveillés',
      },
      {
        path: 'sites/:id',
        loadComponent: () =>
          import('./pages/site-details/site-details').then(m => m.SiteDetailsComponent),
        title: 'Détails du site',
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./pages/incidents/incidents').then(m => m.IncidentsComponent),
        title: 'Incidents',
      },
    ],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/auth/auth').then(m => m.AuthComponent),
    title: 'Connexion',
  },
  {
    path: 'connexion',
    loadComponent: () =>
      import('./pages/auth/auth').then(m => m.AuthComponent),
    title: 'Connexion',
  },
  {
    path: 'accueil',
    loadComponent: () =>
      import('./layout/public-layout/public-layout').then(m => m.PublicLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/home/home').then(m => m.HomeComponent),
        title: 'Accueil',
      },
    ],
  },
  {
    // Public landing page. `pathMatch: 'full'` keeps this route from swallowing
    // the console routes declared below (which share the empty base path).
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./layout/public-layout/public-layout').then(m => m.PublicLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/home/home').then(m => m.HomeComponent),
        title: 'Accueil',
      },
    ],
  },
  {
    // Authenticated console. Guarded as a whole so every child is protected.
    path: '',
    loadComponent: () =>
      import('./layout/console-layout/console-layout').then(m => m.ConsoleLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard').then(m => m.DashboardComponent),
        title: 'Dashboard',
      },
      {
        path: 'sites',
        loadComponent: () =>
          import('./pages/monitored-sites/monitored-sites').then(m => m.MonitoredSitesComponent),
        title: 'Sites surveillés',
      },
      {
        path: 'sites/:id',
        loadComponent: () =>
          import('./pages/site-details/site-details').then(m => m.SiteDetailsComponent),
        title: 'Détails du site',
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./pages/incidents/incidents').then(m => m.IncidentsComponent),
        title: 'Incidents',
      },
      {
        path: 'diagnostic',
        loadComponent: () =>
          import('./pages/diagnostic/diagnostic').then(m => m.DiagnosticComponent),
        title: 'Diagnostic',
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./layout/public-layout/public-layout').then(m => m.PublicLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/home/home').then(m => m.HomeComponent),
      },
    ],
  },
];