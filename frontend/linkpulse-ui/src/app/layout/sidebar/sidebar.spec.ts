import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SidebarComponent } from './sidebar';

describe('SidebarComponent', () => {
  async function setup() {
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: SidebarComponent },
          { path: 'sites', component: SidebarComponent },
          { path: 'incidents', component: SidebarComponent },
          { path: 'diagnostic', component: SidebarComponent },
        ]),
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