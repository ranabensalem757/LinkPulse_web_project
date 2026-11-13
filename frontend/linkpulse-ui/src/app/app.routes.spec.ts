import { routes } from './app.routes';

describe('LinkPulse routes', () => {
  const consoleRoute = routes.find(route =>
    route.path === '' && route.children?.some(child => child.path === 'dashboard'),
  );

  it('declares the login route', () => {
    expect(routes.some(route => route.path === 'login')).toBe(true);
  });

  it('guards the console routes', () => {
    expect(consoleRoute?.canActivate?.length).toBeGreaterThan(0);
  });

  it('declares the required console pages', () => {
    const paths = consoleRoute?.children?.map(child => child.path) ?? [];
    expect(paths).toContain('dashboard');
    expect(paths).toContain('sites');
    expect(paths).toContain('sites/:id');
    expect(paths).toContain('incidents');
  });

  it('lazy-loads each feature page', () => {
    const pages = (consoleRoute?.children ?? [])
      .filter(child => !child.redirectTo && child.path !== '**');
    expect(pages.length).toBe(5);
    expect(pages.every(child => child.loadComponent !== undefined)).toBe(true);
  });
});