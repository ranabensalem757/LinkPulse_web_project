import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { DashboardComponent } from './dashboard';
import { mockApiInterceptor } from '../../core/interceptors/mock-api.interceptor';

describe('DashboardComponent', () => {
  async function setup() {
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
      ],
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 500));
    fixture.detectChanges();
    return fixture;
  }

  it('shows the active incident banner', async () => {
    const fixture = await setup();
    const banner = fixture.nativeElement.querySelector('.banner');
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toContain("API projet Sup");
  });

  it('renders 4 metric cards', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.querySelectorAll('.metric').length).toBe(4);
  });

  it('renders range selector tabs', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.querySelectorAll('[role="tab"]').length).toBe(3);
  });

  it('renders the service list and journal', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.querySelectorAll('.service-row').length).toBe(6);
    expect(fixture.nativeElement.querySelector('.journal tbody tr')).toBeTruthy();
  });

  it('exposes CSV export', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.querySelector('[aria-label="Exporter les données en CSV"]')).toBeTruthy();
  });
});