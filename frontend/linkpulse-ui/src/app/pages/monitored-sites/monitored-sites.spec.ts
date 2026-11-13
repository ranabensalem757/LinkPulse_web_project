import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MonitoredSitesComponent } from './monitored-sites';
import { makeSite } from '../../testing/api-fixtures';

function configure() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [MonitoredSitesComponent],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
}

describe('MonitoredSitesComponent', () => {
  it('shows loading then an empty state', () => {
    configure();
    const fixture = TestBed.createComponent(MonitoredSitesComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loading-state')).toBeTruthy();

    TestBed.inject(HttpTestingController).expectOne('/api/sites').flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Aucun site surveillé');
  });

  it('renders sites and filters offline entries', () => {
    configure();
    const fixture = TestBed.createComponent(MonitoredSitesComponent);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/sites').flush([
      makeSite({ id: 'a', name: 'Site A', status: 'online' }),
      makeSite({ id: 'b', name: 'Site B', status: 'offline', responseTimeMs: 0 }),
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);

    const tabs: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('[role="tab"]');
    tabs[2].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('TIMEOUT');
  });

  it('adds a site through the modal form', () => {
    configure();
    const fixture = TestBed.createComponent(MonitoredSitesComponent);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/sites').flush([makeSite()]);
    fixture.detectChanges();

    const addButton: HTMLButtonElement = fixture.nativeElement.querySelector('.page-head__actions .btn--primary');
    addButton.click();
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#site-name');
    const urlInput: HTMLInputElement = fixture.nativeElement.querySelector('#site-url');
    nameInput.value = 'Nouveau service';
    nameInput.dispatchEvent(new Event('input'));
    urlInput.value = 'https://nouveau.example';
    urlInput.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form.modal').dispatchEvent(new Event('submit'));

    TestBed.inject(HttpTestingController)
      .expectOne(req => req.method === 'POST' && req.url === '/api/sites')
      .flush(makeSite({ id: 'new-site', name: 'Nouveau service', url: 'https://nouveau.example' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Nouveau service');
  });

  it('shows an error state when the API fails', () => {
    configure();
    const fixture = TestBed.createComponent(MonitoredSitesComponent);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/sites')
      .flush('', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('API indisponible');
  });
});