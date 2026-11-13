import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { IncidentsComponent } from './incidents';
import { emptyStats, makeIncident, makeIncidentDetail } from '../../testing/api-fixtures';

function configure() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [IncidentsComponent],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
}

describe('IncidentsComponent', () => {
  it('shows loading then an empty state', () => {
    configure();
    const fixture = TestBed.createComponent(IncidentsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loading-state')).toBeTruthy();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/incidents/stats').flush(emptyStats());
    http.expectOne('/api/incidents').flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Aucun incident enregistré');
  });

  it('renders the register and evidence for an incident', () => {
    configure();
    const fixture = TestBed.createComponent(IncidentsComponent);
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/incidents/stats').flush({ count: 1, avgResolutionMinutes: 0, availability24h: 99.9 });
    http.expectOne('/api/incidents').flush([makeIncident()]);
    http.expectOne('/api/incidents/test-incident').flush(makeIncidentDetail());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Registre des incidents');
    expect(text).toContain('Site de test');
    expect(text).toContain('HTTP_500');
    expect(text).toContain('Fiche de preuve technique');
  });

  it('filters by status and search', () => {
    configure();
    const fixture = TestBed.createComponent(IncidentsComponent);
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/incidents/stats').flush(emptyStats());
    http.expectOne('/api/incidents').flush([makeIncident()]);
    http.expectOne('/api/incidents/test-incident').flush(makeIncidentDetail());
    fixture.detectChanges();

    const tabs: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('[role="tab"]');
    tabs[2].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucun incident ne correspond à ce filtre');

    tabs[0].click();
    fixture.detectChanges();
    const search: HTMLInputElement = fixture.nativeElement.querySelector('.toolbar input[type="search"]');
    search.value = 'unknown-service';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucun incident ne correspond à ce filtre');
  });

  it('shows an error state when the API fails', () => {
    configure();
    const fixture = TestBed.createComponent(IncidentsComponent);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/incidents')
      .flush('', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('API indisponible');
  });
});