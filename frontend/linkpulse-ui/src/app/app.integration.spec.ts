import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { mockApiInterceptor } from './core/interceptors/mock-api.interceptor';

const USER_KEY = 'lp_user';

describe('LinkPulse routing integration', () => {
  beforeEach(() => {
    localStorage.removeItem(USER_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(USER_KEY);
  });

  function configure() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
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

  it('renders the dashboard for an authenticated visitor', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 'u1', email: 'ops@linkpulse.io', name: 'ops' }));
    configure();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard');
    await new Promise(resolve => setTimeout(resolve, 500));
    harness.detectChanges();
    expect((harness.routeNativeElement?.textContent ?? '')).toContain('Disponibilité globale');
    expect(harness.routeNativeElement?.querySelectorAll('.metric').length).toBe(4);
  }, 15_000);

  it('binds the route parameter on /sites/:id', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 'u1', email: 'ops@linkpulse.io', name: 'ops' }));
    configure();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/sites/site-1');
    await new Promise(resolve => setTimeout(resolve, 500));
    harness.detectChanges();
    expect((harness.routeNativeElement?.textContent ?? '')).toContain('Portfolio personnel');
  }, 15_000);
});