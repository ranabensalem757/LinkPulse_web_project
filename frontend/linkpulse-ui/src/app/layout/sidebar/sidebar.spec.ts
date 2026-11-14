import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DEMO_MODE } from '../../core/demo/demo-mode';
import { SidebarComponent } from './sidebar';

describe('SidebarComponent', () => {
  async function setup(isDemo = false) {
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: SidebarComponent },
          { path: 'sites', component: SidebarComponent },
          { path: 'incidents', component: SidebarComponent },
          { path: 'diagnostic', component: SidebarComponent },
        ]),
        { provide: DEMO_MODE, useValue: isDemo },
      ],
    });
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders all 4 navigation items', async () => {
    const f = await setup();
    const links = f.nativeElement.querySelectorAll('.sidebar__link');
    expect(links.length).toBe(4);
  });

  it('contains a link to the dashboard', async () => {
    const f = await setup();
    const links: NodeListOf<HTMLAnchorElement> = f.nativeElement.querySelectorAll('.sidebar__link');
    const hrefs = Array.from(links).map(l => l.getAttribute('href') ?? l.getAttribute('ng-reflect-router-link'));
    expect(hrefs.some(h => h?.includes('dashboard'))).toBe(true);
  });

  it('links the brand to the authenticated dashboard', async () => {
    const f = await setup();
    const brand: HTMLAnchorElement = f.nativeElement.querySelector('.sidebar__brand');

    expect(brand.getAttribute('href')).toBe('/dashboard');
  });

  it('keeps the brand inside the demo dashboard in demo mode', async () => {
    const f = await setup(true);
    const brand: HTMLAnchorElement = f.nativeElement.querySelector('.sidebar__brand');

    expect(brand.getAttribute('href')).toBe('/demo/dashboard');
  });

  it('contains a link to monitored sites', async () => {
    const f = await setup();
    expect(f.nativeElement.textContent).toContain('Sites surveillés');
  });

  it('contains a link to incidents', async () => {
    const f = await setup();
    expect(f.nativeElement.textContent).toContain('Incidents');
  });

  it('contains a link to diagnostic', async () => {
    const f = await setup();
    expect(f.nativeElement.textContent).toContain('Diagnostic');
  });

  it('shows the local probe placeholder', async () => {
    const f = await setup();
    expect(f.nativeElement.textContent).toContain('Non configurée');
  });

  it('mobile toggle button has aria-expanded', async () => {
    const f = await setup();
    const toggle: HTMLButtonElement = f.nativeElement.querySelector('.sidebar-mobile-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBeDefined();
  });
});