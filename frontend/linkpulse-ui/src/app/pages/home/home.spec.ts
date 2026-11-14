import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home';

describe('HomeComponent', () => {
  async function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: HomeComponent }]),
      ],
    });
    const harness = await RouterTestingHarness.create('/');
    const instance = await harness.navigateByUrl('/', HomeComponent);
    return { harness, instance };
  }

  it('renders the hero heading', async () => {
    const { harness } = await setup();
    const h1 = harness.routeNativeElement!.querySelector('h1');
    expect(h1?.textContent).toContain('Surveillez vos sites web');
  }, 15_000);

  it('provides the hero target for the footer home link', async () => {
    const { harness } = await setup();
    expect(harness.routeNativeElement!.querySelector('#hero')).toBeTruthy();
  });

  it('provides targets for the feature, how-it-works, and architecture links', async () => {
    const { harness } = await setup();
    const root = harness.routeNativeElement!;

    expect(root.querySelector('#features')).toBeTruthy();
    expect(root.querySelector('#how-it-works')).toBeTruthy();
    expect(root.querySelector('#architecture')?.getAttribute('aria-label')).toBe('Aperçu de la console');
  });

  it('renders two CTA buttons in the hero', async () => {
    const { harness } = await setup();
    const heroActions = harness.routeNativeElement!.querySelector('.hero__actions');
    const links = heroActions?.querySelectorAll('a');
    expect(links?.length).toBe(2);
  });

  it('opens the independent demo route from the demo CTA', async () => {
    const { harness } = await setup();
    const demoLink = Array.from(
      harness.routeNativeElement!.querySelectorAll('.hero__actions a'),
    ).find(link => link.textContent?.includes('Voir la démo'));
    expect(demoLink?.getAttribute('href')).toBe('/demo/dashboard');
  });

  it('renders 3 key figures', async () => {
    const { harness } = await setup();
    const figs = harness.routeNativeElement!.querySelectorAll('.key-figure');
    expect(figs.length).toBe(3);
  });

  it('shows the console preview placeholder instead of fake figures', async () => {
    const { harness } = await setup();
    expect(harness.routeNativeElement!.textContent).toContain('Aperçu du graphique');
  });

  it('renders 4 feature cards', async () => {
    const { harness } = await setup();
    const cards = harness.routeNativeElement!.querySelectorAll('.feature-card');
    expect(cards.length).toBe(4);
  });

  it('renders 3 onboarding steps', async () => {
    const { harness } = await setup();
    const steps = harness.routeNativeElement!.querySelectorAll('.step');
    expect(steps.length).toBe(3);
  });

  it('has a final CTA "Créer mon compte" linking to /login', async () => {
    const { harness } = await setup();
    const ctaBtn = harness.routeNativeElement!.querySelector('.cta-section__btn');
    expect(ctaBtn?.textContent?.trim()).toContain('Créer mon compte');
  });

  it('features section has an accessible heading', async () => {
    const { harness } = await setup();
    const heading = harness.routeNativeElement!.querySelector('#features-title');
    expect(heading).toBeTruthy();
  });
});
