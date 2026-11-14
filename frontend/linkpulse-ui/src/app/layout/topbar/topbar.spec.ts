import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { filter, firstValueFrom } from 'rxjs';
import { TopbarComponent } from './topbar';

const USER_KEY = 'lp_user';

@Component({ template: '' })
class HomeRouteComponent {}

describe('TopbarComponent', () => {
  beforeEach(() => {
    localStorage.setItem(USER_KEY, JSON.stringify({
      id: 'user-1',
      email: 'user@linkpulse.io',
      name: 'User',
    }));
  });

  afterEach(() => {
    localStorage.removeItem(USER_KEY);
  });

  async function openProfileMenu() {
    TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: TopbarComponent },
          { path: '', component: HomeRouteComponent },
        ]),
        provideHttpClient(),
      ],
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard', TopbarComponent);
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.avatar')!.click();
    harness.detectChanges();

    return { harness, router: TestBed.inject(Router) };
  }

  it('logs out and returns home when the user chooses the home menu action', async () => {
    const { harness, router } = await openProfileMenu();
    const navigation = firstValueFrom(
      router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
    );
    const returnHome = Array.from(
      harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    ).find(item => item.textContent?.trim() === "Retour à l'accueil")!;

    returnHome.click();
    await navigation;

    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(router.url).toBe('/');
  });

  it('keeps the explicit disconnect action working', async () => {
    const { harness, router } = await openProfileMenu();
    const navigation = firstValueFrom(
      router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
    );
    const signOut = Array.from(
      harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    ).find(item => item.textContent?.trim() === 'Se déconnecter')!;

    signOut.click();
    await navigation;

    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(router.url).toBe('/');
  });
});
