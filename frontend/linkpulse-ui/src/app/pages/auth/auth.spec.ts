import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthComponent } from './auth';
import { AuthService } from '../../core/services/auth.service';

function setValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function tick(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 30));
}

describe('AuthComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('lp_user');
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem('lp_user');
  });

  async function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        provideRouter([{ path: 'dashboard', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(AuthComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders both tabs', async () => {
    const f = await setup();
    const tabs = f.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent.trim()).toContain('Se connecter');
    expect(tabs[1].textContent.trim()).toContain('Créer un compte');
  });

  it('shows login form by default', async () => {
    const f = await setup();
    expect(f.nativeElement.querySelector('#login-email')).toBeTruthy();
    expect(f.nativeElement.querySelector('#reg-email')).toBeFalsy();
  });

  it('switches to register panel on tab click', async () => {
    const f = await setup();
    const tabs = f.nativeElement.querySelectorAll('[role="tab"]');
    tabs[1].click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('#reg-email')).toBeTruthy();
    expect(f.nativeElement.querySelector('#login-email')).toBeFalsy();
  });

  it('password toggle changes input type', async () => {
    const f = await setup();
    const passwordInput = f.nativeElement.querySelector('#login-password');
    expect(passwordInput.type).toBe('password');
    f.nativeElement.querySelector('.toggle-pwd').click();
    f.detectChanges();
    expect(passwordInput.type).toBe('text');
  });

  it('validates the login form before submitting', async () => {
    const f = await setup();
    const form = f.nativeElement.querySelector('form');
    setValue(form.querySelector('#login-email'), '');
    setValue(form.querySelector('#login-password'), '');
    form.dispatchEvent(new Event('submit'));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('adresse e-mail valide');
  });

  it('logs in through the API and persists the session', async () => {
    const f = await setup();
    const form = f.nativeElement.querySelector('form');
    setValue(form.querySelector('#login-email'), 'ops@linkpulse.io');
    setValue(form.querySelector('#login-password'), 'LinkPulse1');
    form.dispatchEvent(new Event('submit'));

    TestBed.inject(HttpTestingController)
      .expectOne(req => req.method === 'POST' && req.url === '/api/connexion')
      .flush({ succes: true, client: { id: 'u1', email: 'ops@linkpulse.io', name: 'ops' } });

    await tick();
    f.detectChanges();

    expect(localStorage.getItem('lp_user')).toContain('ops@linkpulse.io');
    expect(TestBed.inject(Router).url).toContain('/dashboard');
  });

  it('registers through the API', async () => {
    const f = await setup();
    f.nativeElement.querySelectorAll('[role="tab"]')[1].click();
    f.detectChanges();

    const form = f.nativeElement.querySelector('form');
    setValue(form.querySelector('#reg-email'), 'new@linkpulse.io');
    setValue(form.querySelector('#reg-password'), 'LinkPulse1');
    setValue(form.querySelector('#reg-confirm'), 'LinkPulse1');
    form.dispatchEvent(new Event('submit'));

    TestBed.inject(HttpTestingController)
      .expectOne(req => req.method === 'POST' && req.url === '/api/inscription')
      .flush({ succes: true, client: { id: 'u2', email: 'new@linkpulse.io', name: 'new' } });

    await tick();
    expect(localStorage.getItem('lp_user')).toContain('new@linkpulse.io');
  });

  it('surfaces API errors', async () => {
    const f = await setup();
    const form = f.nativeElement.querySelector('form');
    setValue(form.querySelector('#login-email'), 'ops@linkpulse.io');
    setValue(form.querySelector('#login-password'), 'LinkPulse1');
    form.dispatchEvent(new Event('submit'));

    TestBed.inject(HttpTestingController)
      .expectOne(req => req.method === 'POST' && req.url === '/api/connexion')
      .flush({ succes: false, message: 'Identifiants incorrects' });

    await tick();
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('Identifiants incorrects');
    expect(localStorage.getItem('lp_user')).toBeNull();
  });

  it('surfaces the backend message on HTTP 401', async () => {
    const f = await setup();
    const form = f.nativeElement.querySelector('form');
    setValue(form.querySelector('#login-email'), 'ops@linkpulse.io');
    setValue(form.querySelector('#login-password'), 'wrong-password');
    form.dispatchEvent(new Event('submit'));

    TestBed.inject(HttpTestingController)
      .expectOne(req => req.method === 'POST' && req.url === '/api/connexion')
      .flush(
        { succes: false, message: 'Email ou mot de passe incorrect.' },
        { status: 401, statusText: 'Unauthorized' },
      );

    await tick();
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('Email ou mot de passe incorrect.');
    expect(localStorage.getItem('lp_user')).toBeNull();
  });

  it('reports an unreachable backend', async () => {
    const f = await setup();
    const form = f.nativeElement.querySelector('form');
    setValue(form.querySelector('#login-email'), 'ops@linkpulse.io');
    setValue(form.querySelector('#login-password'), 'LinkPulse1');
    form.dispatchEvent(new Event('submit'));

    TestBed.inject(HttpTestingController)
      .expectOne(req => req.method === 'POST' && req.url === '/api/connexion')
      .error(new ProgressEvent('error'));

    await tick();
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('Serveur injoignable');
  });

  it('rejects duplicate registration with the server message', async () => {
    const f = await setup();
    f.nativeElement.querySelectorAll('[role="tab"]')[1].click();
    f.detectChanges();

    const form = f.nativeElement.querySelector('form');
    setValue(form.querySelector('#reg-email'), 'new@linkpulse.io');
    setValue(form.querySelector('#reg-password'), 'LinkPulse1');
    setValue(form.querySelector('#reg-confirm'), 'LinkPulse1');
    form.dispatchEvent(new Event('submit'));

    TestBed.inject(HttpTestingController)
      .expectOne(req => req.method === 'POST' && req.url === '/api/inscription')
      .flush(
        { succes: false, message: 'Cet email possède déjà un compte.' },
        { status: 409, statusText: 'Conflict' },
      );

    await tick();
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('Cet email possède déjà un compte.');
    expect(localStorage.getItem('lp_user')).toBeNull();
  });

  it('logs out and clears the session', async () => {
    const f = await setup();
    const form = f.nativeElement.querySelector('form');
    setValue(form.querySelector('#login-email'), 'ops@linkpulse.io');
    setValue(form.querySelector('#login-password'), 'LinkPulse1');
    form.dispatchEvent(new Event('submit'));

    TestBed.inject(HttpTestingController)
      .expectOne(req => req.method === 'POST' && req.url === '/api/connexion')
      .flush({ succes: true, client: { id: 'u1', email: 'ops@linkpulse.io', name: 'ops' } });

    await tick();
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);

    TestBed.inject(AuthService).logout();
    expect(localStorage.getItem('lp_user')).toBeNull();
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
  });

  it('restores the session from localStorage after a reload', async () => {
    localStorage.setItem('lp_user', JSON.stringify({ id: 'u1', email: 'ops@linkpulse.io', name: 'ops' }));
    await setup();

    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.currentUser()?.email).toBe('ops@linkpulse.io');
  });
});