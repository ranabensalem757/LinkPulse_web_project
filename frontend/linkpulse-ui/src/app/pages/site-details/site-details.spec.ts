import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SiteDetailsComponent } from './site-details';
import {
  makeCheck,
  makeIncident,
  makeLatency,
  makeSite,
} from '../../testing/api-fixtures';

function configure() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SiteDetailsComponent],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
}

function flushSite(
  http: HttpTestingController,
  options: {
    checks?: ReturnType<typeof makeCheck>[];
    incidents?: ReturnType<typeof makeIncident>[];
  } = {},
): void {
  http.expectOne('/api/sites/test-site').flush(makeSite());
  http.expectOne('/api/sites/test-site/checks').flush(options.checks ?? []);
  http.expectOne(req => req.url.startsWith('/api/sites/test-site/latency')).flush(makeLatency([{ timestamp: '2026-01-01T00:00:00Z', valueMs: 100 }, { timestamp: '2026-01-01T01:00:00Z', valueMs: 120 }]));
  http.expectOne('/api/incidents').flush(options.incidents ?? []);
}

describe('SiteDetailsComponent', () => {
  it('shows loading, then empty states when there is no history', () => {
    configure();
    const fixture = TestBed.createComponent(SiteDetailsComponent);
    fixture.componentRef.setInput('id', 'test-site');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loading-state')).toBeTruthy();

    flushSite(TestBed.inject(HttpTestingController));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Site de test');
    expect(fixture.nativeElement.textContent).toContain('Aucune vérification');
    expect(fixture.nativeElement.textContent).toContain('Aucun incident lié');
  });

  it('renders metrics, checks and related incidents', () => {
    configure();
    const fixture = TestBed.createComponent(SiteDetailsComponent);
    fixture.componentRef.setInput('id', 'test-site');
    fixture.detectChanges();
    flushSite(TestBed.inject(HttpTestingController), {
      checks: [
        makeCheck({ id: 'c1', httpStatus: 200, responseTimeMs: 100, success: true, result: 'ok' }),
        makeCheck({ id: 'c2', httpStatus: 500, responseTimeMs: null, success: false, result: 'http_error' }),
      ],
      incidents: [makeIncident()],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dernières vérifications');
    expect(fixture.nativeElement.textContent).toContain('200');
    expect(fixture.nativeElement.textContent).toContain('Incidents liés');
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  });

  it('runs an immediate check', () => {
    configure();
    const fixture = TestBed.createComponent(SiteDetailsComponent);
    fixture.componentRef.setInput('id', 'test-site');
    fixture.detectChanges();
    flushSite(TestBed.inject(HttpTestingController));
    fixture.detectChanges();

    const runButton: HTMLButtonElement = fixture.nativeElement.querySelector('.hero__actions .btn');
    runButton.click();

    TestBed.inject(HttpTestingController)
      .expectOne(req => req.method === 'POST' && req.url === '/api/sites/test-site/checks/run')
      .flush(makeCheck({ id: 'c3', checkedAt: '2026-01-01T02:00:00Z', httpStatus: 200, responseTimeMs: 90 }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Test terminé');
  });

  it('shows an error state when the API fails', () => {
    configure();
    const fixture = TestBed.createComponent(SiteDetailsComponent);
    fixture.componentRef.setInput('id', 'test-site');
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/sites/test-site')
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.panel.missing')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('API indisponible');
  });
});