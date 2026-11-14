import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PublicLayoutComponent } from './public-layout';

describe('PublicLayoutComponent', () => {
  it('links the footer home item to the hero section', () => {
    TestBed.configureTestingModule({
      imports: [PublicLayoutComponent],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(PublicLayoutComponent);
    fixture.detectChanges();

    const homeLink = fixture.nativeElement.querySelector('.pub-footer nav a[href="#hero"]');
    expect(homeLink?.textContent?.trim()).toBe('Accueil');
  });

  it('links the home and how-it-works navigation items to their sections', () => {
    TestBed.configureTestingModule({
      imports: [PublicLayoutComponent],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(PublicLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.pub-header nav a[href="#features"]')?.textContent?.trim())
      .toBe('Fonctionnalités');
    expect(fixture.nativeElement.querySelector('.pub-header nav a[href="#how-it-works"]')?.textContent?.trim())
      .toBe('Comment ça marche');
    expect(fixture.nativeElement.querySelector('.pub-footer nav a[href="#features"]')?.textContent?.trim())
      .toBe('Fonctionnalités');
    expect(fixture.nativeElement.querySelector('.pub-footer nav a[href="#architecture"]')?.textContent?.trim())
      .toBe('Architecture');
  });
});
