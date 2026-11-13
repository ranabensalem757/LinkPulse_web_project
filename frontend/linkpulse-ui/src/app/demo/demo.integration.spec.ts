import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';

describe('Independent demo mode', () => {
  beforeEach(() => {
    localStorage.removeItem('lp_user');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem('lp_user');
  });

  it('navigates through static demo pages, disables real operations, and exits publicly', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/demo');
    harness.fixture.detectChanges();

    const router = TestBed.inject(Router);
    const http = TestBed.inject(HttpTestingController);
    expect(router.url).toBe('/demo/dashboard');
    expect(harness.fixture.nativeElement.textContent).toContain('Données statiques fictives');
    expect(harness.fixture.nativeElement.textContent).toContain('Checkout Web');
    expect(harness.fixture.nativeElement.textContent).toContain('Temps de réponse global');
    expect(harness.fixture.nativeElement.querySelector('.chart path')?.getAttribute('d')).toContain('M');
    expect(localStorage.getItem('lp_user')).toBeNull();

    const rangeTab = Array.from(
      harness.fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>,
    ).find(button => button.textContent?.trim() === '1H');
    rangeTab?.click();
    harness.fixture.detectChanges();
    expect(rangeTab?.getAttribute('aria-selected')).toBe('true');

    const sitesLink = Array.from(
      harness.fixture.nativeElement.querySelectorAll('.sidebar__link') as NodeListOf<HTMLAnchorElement>,
    ).find(link => link.textContent?.includes('Sites surveillés'));
    expect(sitesLink?.getAttribute('href')).toBe('/demo/sites');
    sitesLink?.click();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(router.url).toBe('/demo/sites');

    const offlineTab = Array.from(
      harness.fixture.nativeElement.querySelectorAll('.filters button') as NodeListOf<HTMLButtonElement>,
    ).find(button => button.textContent?.includes('Hors ligne'));
    offlineTab?.click();
    harness.fixture.detectChanges();
    expect(harness.fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    expect(harness.fixture.nativeElement.textContent).toContain('Checkout Web');

    await harness.navigateByUrl('/demo/sites');
    harness.fixture.detectChanges();
    const addButton = harness.fixture.nativeElement.querySelector('.page-head__actions .btn--primary') as HTMLButtonElement;
    addButton.click();
    harness.fixture.detectChanges();
    expect(harness.fixture.nativeElement.textContent).toContain('création de sites est désactivée');
    expect(harness.fixture.nativeElement.querySelector('.modal')).toBeNull();

    const pauseButton = harness.fixture.nativeElement.querySelector('button[aria-label="Mettre en pause"]') as HTMLButtonElement;
    pauseButton.click();
    harness.fixture.detectChanges();
    expect(harness.fixture.nativeElement.textContent).toContain('modification des sites est désactivée');

    const actionsButton = harness.fixture.nativeElement.querySelector('button[aria-label="Autres actions"]') as HTMLButtonElement;
    actionsButton.click();
    harness.fixture.detectChanges();
    (harness.fixture.nativeElement.querySelector('.menu button') as HTMLButtonElement).click();
    harness.fixture.detectChanges();
    expect(harness.fixture.nativeElement.textContent).toContain('suppression des sites est désactivée');

    await harness.navigateByUrl('/demo/sites/edge-api');
    harness.fixture.detectChanges();
    expect(harness.fixture.nativeElement.textContent).toContain('Edge API');
    const checkButton = harness.fixture.nativeElement.querySelector('.hero__actions .btn') as HTMLButtonElement;
    checkButton.click();
    harness.fixture.detectChanges();
    expect(harness.fixture.nativeElement.textContent).toContain('désactivés en mode démo');

    await harness.navigateByUrl('/demo/incidents');
    harness.fixture.detectChanges();
    expect(harness.fixture.nativeElement.textContent).toContain('Registre des incidents');
    expect(harness.fixture.nativeElement.textContent).toContain('Fiche de preuve technique');
    const resolvedTab = Array.from(
      harness.fixture.nativeElement.querySelectorAll('.tabs button') as NodeListOf<HTMLButtonElement>,
    ).find(button => button.textContent?.includes('Résolus'));
    resolvedTab?.click();
    harness.fixture.detectChanges();
    const incidentList = harness.fixture.nativeElement.querySelector('.split ul')?.textContent ?? '';
    expect(incidentList).toContain('Status Page');
    expect(incidentList).not.toContain('Checkout Web');

    const exitLink = harness.fixture.nativeElement.querySelector('.demo-exit') as HTMLAnchorElement;
    exitLink.click();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(router.url).toBe('/');
    expect(harness.fixture.nativeElement.textContent).toContain('Voir la démo');
    expect(localStorage.getItem('lp_user')).toBeNull();

    http.expectNone(request => request.url.startsWith('/api/'));
  }, 15_000);
});
