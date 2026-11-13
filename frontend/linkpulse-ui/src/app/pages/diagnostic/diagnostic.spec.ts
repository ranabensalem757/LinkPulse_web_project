import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DiagnosticComponent } from './diagnostic';
import { makeDiagnosticResult, makeSite } from '../../testing/api-fixtures';

function configure() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DiagnosticComponent],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
}

describe('DiagnosticComponent', () => {
  it('shows loading then an empty state when no site exists', () => {
    configure();
    const fixture = TestBed.createComponent(DiagnosticComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loading-state')).toBeTruthy();

    TestBed.inject(HttpTestingController).expectOne('/api/sites').flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Aucun site configuré');
  });

  it('runs a diagnostic for the first site', () => {
    configure();
    const fixture = TestBed.createComponent(DiagnosticComponent);
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/sites').flush([makeSite()]);
    http
      .expectOne(req => req.method === 'POST' && req.url === '/api/diagnostics/sites/test-site/run')
      .flush(makeDiagnosticResult());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('DNS');
    expect(fixture.nativeElement.textContent).toContain('HTTP');
  });

  it('shows an error state when loading sites fails', () => {
    configure();
    const fixture = TestBed.createComponent(DiagnosticComponent);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/sites')
      .flush('', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('API indisponible');
  });

  it('reports a failed diagnostic without hiding the launcher', () => {
    configure();
    const fixture = TestBed.createComponent(DiagnosticComponent);
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/sites').flush([makeSite()]);
    http
      .expectOne(req => req.method === 'POST' && req.url === '/api/diagnostics/sites/test-site/run')
      .flush('', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form.launcher')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Le diagnostic a échoué");
  });
});