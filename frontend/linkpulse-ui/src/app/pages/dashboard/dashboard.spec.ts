import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardComponent } from './dashboard';
import { emptySummary, makeLatency, makeSite } from '../../testing/api-fixtures';

function configure() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DashboardComponent],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
}

function flushDashboard(http: HttpTestingController, sites = [makeSite()]): void {
  http.expectOne('/api/dashboard/summary').flush(emptySummary());
  http.expectOne(req => req.url.startsWith('/api/dashboard/latency')).flush(makeLatency());
  http.expectOne('/api/dashboard/events').flush([]);
  http.expectOne('/api/sites').flush(sites);
}

describe('DashboardComponent', () => {
  it('shows loading, then an empty state', () => {
    configure();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loading-state')).toBeTruthy();

    flushDashboard(TestBed.inject(HttpTestingController), []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.metric').length).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('Aucun site configuré');
    expect(fixture.nativeElement.textContent).toContain('Aucun événement');
  });

  it('renders service rows returned by the API', () => {
    configure();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    flushDashboard(
      TestBed.inject(HttpTestingController),
      [makeSite({ id: 'a', name: 'Site A' }), makeSite({ id: 'b', name: 'Site B', status: 'offline' })],
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.service-row').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Site A');
  });

  it('shows an error state when the API fails', () => {
    configure();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/dashboard/summary')
      .error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('API indisponible');
  });

  it('renders three range tabs', () => {
    configure();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    flushDashboard(TestBed.inject(HttpTestingController));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[role="tab"]').length).toBe(3);
  });
});