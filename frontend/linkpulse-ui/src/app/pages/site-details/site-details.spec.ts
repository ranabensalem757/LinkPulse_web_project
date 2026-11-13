import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { SiteDetailsComponent } from './site-details';
import { mockApiInterceptor } from '../../core/interceptors/mock-api.interceptor';

describe('SiteDetailsComponent', () => {
  async function setup(id: string) {
    TestBed.configureTestingModule({
      imports: [SiteDetailsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
      ],
    });
    const fixture = TestBed.createComponent(SiteDetailsComponent);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 500));
    fixture.detectChanges();
    return fixture;
  }

  it('renders the latency profile and recent checks', async () => {
    const fixture = await setup('site-1');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Portfolio personnel');
    expect(text).toContain('Dernières vérifications');
    expect(text).toContain('200');
  });

  it('shows an offline site state', async () => {
    const fixture = await setup('site-2');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('API projet Sup');
    expect(text).toContain('Échec');
  });
});