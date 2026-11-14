import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter, Router, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Title } from '@angular/platform-browser';
import { routes } from './app.routes';
import { AppTitleStrategy } from './app-title.strategy';
import { makeLatency, makeSite } from './testing/api-fixtures';

const USER_KEY = 'lp_user';

describe('LinkPulse routing integration', () => {
  beforeEach(() => {
    localStorage.removeItem(USER_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(USER_KEY);
  });

  function configure() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  }

  it('redirects an unauthenticated visitor from /dashboard to /login', async () => {
    configure();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard');
    expect(TestBed.inject(Router).url).toContain('/login');
    expect((harness.routeNativeElement?.textContent ?? '')).toContain('Bon retour');
  }, 15_000);

  it('binds the route parameter on /sites/:id', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 'u1', email: 'ops@linkpulse.io', name: 'ops' }));
    configure();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/sites/test-site');
    harness.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/sites/test-site').flush(makeSite({ id: 'test-site', name: 'Site de test' }));
    http.expectOne('/api/sites/test-site/checks').flush([]);
    http.expectOne(req => req.url.startsWith('/api/sites/test-site/latency')).flush(makeLatency());
    http.expectOne('/api/incidents').flush([]);
    harness.detectChanges();

    expect((harness.routeNativeElement?.textContent ?? '')).toContain('Site de test');
  }, 15_000);

  it('uses the default title for unknown routes', async () => {
    configure();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/unrecognized-route');

    expect(TestBed.inject(Router).url).toBe('/unrecognized-route');
    expect(TestBed.inject(Title).getTitle()).toBe('LinkPulse');
  }, 15_000);
});