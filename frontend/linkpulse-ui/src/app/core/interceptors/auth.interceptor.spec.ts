import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

const USER = { id: 'u1', email: 'test@lp.io', name: 'test' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.setItem('lp_user', JSON.stringify(USER));
    localStorage.setItem('lp_token', 'jeton-123');
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { url: '/sites', navigate } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    backend.verify();
    localStorage.removeItem('lp_user');
    localStorage.removeItem('lp_token');
  });

  it('adds the Bearer token to /api calls', () => {
    http.get('/api/sites').subscribe();
    const req = backend.expectOne('/api/sites');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jeton-123');
    req.flush([]);
  });

  it('logs out and redirects to /login with returnUrl on a 401', () => {
    http.get('/api/sites').subscribe({ error: () => undefined });
    backend.expectOne('/api/sites').flush({ message: 'Non authentifié' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('lp_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/sites' } });
  });

  it('does not redirect when the login itself answers 401 (wrong password)', () => {
    http.post('/api/connexion', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/connexion').flush({ message: 'x' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('does not log out on a server error (500)', () => {
    http.get('/api/sites').subscribe({ error: () => undefined });
    backend.expectOne('/api/sites').flush({}, { status: 500, statusText: 'Server Error' });
    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('AuthService.validateSession', () => {
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.setItem('lp_user', JSON.stringify(USER));
    localStorage.setItem('lp_token', 'jeton-123');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { url: '/', navigate: vi.fn() } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.removeItem('lp_user');
    localStorage.removeItem('lp_token');
  });

  it('keeps the session when the server confirms it', async () => {
    const pending = auth.validateSession();
    backend.expectOne('/api/me').flush({ succes: true, client: USER });
    await pending;
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('clears a stale session when the server answers 401', async () => {
    const pending = auth.validateSession();
    backend.expectOne('/api/me').flush({ succes: false }, { status: 401, statusText: 'Unauthorized' });
    await pending;
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('lp_token')).toBeNull();
  });

  it('keeps the local session when the server is unreachable', async () => {
    const pending = auth.validateSession();
    backend.expectOne('/api/me').error(new ProgressEvent('error'), { status: 0 });
    await pending;
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('drops a user without token without calling the server', async () => {
    localStorage.removeItem('lp_token');
    await auth.validateSession();
    backend.expectNone('/api/me');
    expect(auth.isAuthenticated()).toBe(false);
  });
});
