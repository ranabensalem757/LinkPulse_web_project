import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';
import { AppTitleStrategy } from './app-title.strategy';

@Component({ template: '' })
class TestPage {}

describe('AppTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'accueil', component: TestPage, title: 'Accueil' },
          { path: 'connexion', component: TestPage, title: 'Connexion' },
          { path: 'sites/:id', component: TestPage, title: 'Détails du site' },
          { path: '**', component: TestPage },
        ]),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    });
  });

  it('updates titles on navigation, including parameterized routes', async () => {
    const harness = await RouterTestingHarness.create();
    const title = TestBed.inject(Title);

    await harness.navigateByUrl('/accueil');
    expect(title.getTitle()).toBe('LinkPulse | Accueil');

    await harness.navigateByUrl('/sites/site-123');
    expect(title.getTitle()).toBe('LinkPulse | Détails du site');

    await TestBed.inject(Router).navigateByUrl('/connexion');
    expect(title.getTitle()).toBe('LinkPulse | Connexion');
  });

  it('uses the default title when a route has no title', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/unknown');

    expect(TestBed.inject(Title).getTitle()).toBe('LinkPulse');
  });
});
