import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.removeItem('lp_user');
    localStorage.removeItem('lp_token');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    localStorage.removeItem('lp_user');
    localStorage.removeItem('lp_token');
  });

  it('allows access when user is authenticated', () => {
    localStorage.setItem(
      'lp_user',
      JSON.stringify({ id: 'u1', email: 'test@lp.io', name: 'test' }),
    );
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(true);

    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState: RouterStateSnapshot = {
      url: '/dashboard',
      root: {} as RouterStateSnapshot['root'],
    };

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    expect(result).toBe(true);
  });

  it('redirects to /login preserving state.url in returnUrl when unauthenticated', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(false);

    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState: RouterStateSnapshot = {
      url: '/dashboard',
      root: {} as RouterStateSnapshot['root'],
    };

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    expect(result instanceof UrlTree).toBe(true);

    const tree = result as UrlTree;
    const router = TestBed.inject(Router);
    const serialized = router.serializeUrl(tree);
    expect(serialized).toContain('/login');
    expect(tree.queryParams['returnUrl']).toBe('/dashboard');
  });

  it('preserves target route with nested path in returnUrl', () => {
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState: RouterStateSnapshot = {
      url: '/sites/site-123',
      root: {} as RouterStateSnapshot['root'],
    };

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    expect(result instanceof UrlTree).toBe(true);

    const tree = result as UrlTree;
    expect(tree.queryParams['returnUrl']).toBe('/sites/site-123');
  });
});
