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
        title: 'Démo — Tableau de bord LinkPulse',
      },
      {
        path: 'sites',
        loadComponent: () =>
          import('./pages/monitored-sites/monitored-sites').then(m => m.MonitoredSitesComponent),
        title: 'Démo — Sites surveillés LinkPulse',
      },
      {
        path: 'sites/:id',
        loadComponent: () =>
          import('./pages/site-details/site-details').then(m => m.SiteDetailsComponent),
        title: 'Démo — Détail du site LinkPulse',
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./pages/incidents/incidents').then(m => m.IncidentsComponent),
        title: 'Démo — Incidents LinkPulse',
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/auth/auth').then(m => m.AuthComponent),
    title: 'Connexion — LinkPulse',
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
        title: 'LinkPulse — Surveillez vos sites web',
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
        title: 'Tableau de bord — LinkPulse',
      },
      {
        path: 'sites',
        loadComponent: () =>
          import('./pages/monitored-sites/monitored-sites').then(m => m.MonitoredSitesComponent),
        title: 'Sites surveillés — LinkPulse',
      },
      {
        path: 'sites/:id',
        loadComponent: () =>
          import('./pages/site-details/site-details').then(m => m.SiteDetailsComponent),
        title: 'Détail du site — LinkPulse',
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./pages/incidents/incidents').then(m => m.IncidentsComponent),
        title: 'Incidents — LinkPulse',
      },
      {
        path: 'diagnostic',
        loadComponent: () =>
          import('./pages/diagnostic/diagnostic').then(m => m.DiagnosticComponent),
        title: 'Diagnostic — LinkPulse',
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];