import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { DiagnosticComponent } from './diagnostic';
import { mockApiInterceptor } from '../../core/interceptors/mock-api.interceptor';

describe('DiagnosticComponent', () => {
  it('runs a diagnostic for the selected site', async () => {
    TestBed.configureTestingModule({
      imports: [DiagnosticComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
      ],
    });
    const fixture = TestBed.createComponent(DiagnosticComponent);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 700));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Diagnostic');
    expect(fixture.nativeElement.textContent).toContain('DNS');
  });
});