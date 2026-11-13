import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MonitoredSitesComponent } from './monitored-sites';
import { mockApiInterceptor } from '../../core/interceptors/mock-api.interceptor';

describe('MonitoredSitesComponent', () => {
  async function setup() {
    TestBed.configureTestingModule({
      imports: [MonitoredSitesComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
      ],
    });
    const fixture = TestBed.createComponent(MonitoredSitesComponent);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 500));
    fixture.detectChanges();
    return fixture;
  }

  it('lists the monitored sites', async () => {
    const fixture = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Portfolio personnel');
    expect(text).toContain('Sites surveillés');
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(6);
  });

  it('filters offline sites', async () => {
    const fixture = await setup();
    const tabs: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('[role="tab"]');
    tabs[2].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('TIMEOUT');
  });

  it('adds a site through the modal form', async () => {
    const fixture = await setup();
    const addButton: HTMLButtonElement = fixture.nativeElement.querySelector('.page-head__actions .btn--primary');
    addButton.click();
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#site-name');
    const urlInput: HTMLInputElement = fixture.nativeElement.querySelector('#site-url');
    nameInput.value = 'Nouveau service';
    nameInput.dispatchEvent(new Event('input'));
    urlInput.value = 'https://nouveau.example.com';
    urlInput.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form.modal').dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 500));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nouveau service');
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(7);
  });
});