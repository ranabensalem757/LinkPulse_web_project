import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IncidentsComponent } from './incidents';
import { mockApiInterceptor } from '../../core/interceptors/mock-api.interceptor';

describe('IncidentsComponent', () => {
  it('shows the incident register and evidence sheet', async () => {
    TestBed.configureTestingModule({
      imports: [IncidentsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
      ],
    });
    const fixture = TestBed.createComponent(IncidentsComponent);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 800));
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Registre des incidents');
    expect(text).toContain('inc-1');
    expect(text).toContain('HTTP_503');
  });
});