import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthComponent } from './auth';
import { AuthService } from '../../core/services/auth.service';

describe('AuthComponent', () => {
  async function setup() {
    TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        provideRouter([{ path: 'dashboard', children: [] }]),
        AuthService,
      ],
    });
    const fixture = TestBed.createComponent(AuthComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders both tabs', async () => {
    const f = await setup();
    const tabs = f.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent.trim()).toContain('Se connecter');
    expect(tabs[1].textContent.trim()).toContain('Créer un compte');
  });

  it('shows login form by default', async () => {
    const f = await setup();
    expect(f.nativeElement.querySelector('#login-email')).toBeTruthy();
    expect(f.nativeElement.querySelector('#reg-email')).toBeFalsy();
  });

  it('switches to register panel on tab click', async () => {
    const f = await setup();
    const tabs = f.nativeElement.querySelectorAll('[role="tab"]');
    tabs[1].click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('#reg-email')).toBeTruthy();
    expect(f.nativeElement.querySelector('#login-email')).toBeFalsy();
  });

  it('password toggle changes input type', async () => {
    const f = await setup();
    const passwordInput = f.nativeElement.querySelector('#login-password');
    expect(passwordInput.type).toBe('password');
    const toggleBtn = f.nativeElement.querySelector('.toggle-pwd');
    toggleBtn.click();
    f.detectChanges();
    expect(passwordInput.type).toBe('text');
  });

  it('shows the prototype email', async () => {
    const f = await setup();
    expect(f.nativeElement.querySelector('#login-email').value).toBe('nom@infrastructure.corp');
  });

  it('validates the login form before submitting', async () => {
    const f = await setup();
    const form = f.nativeElement.querySelector('form');
    form.querySelector('#login-email').value = '';
    form.querySelector('#login-email').dispatchEvent(new Event('input'));
    form.querySelector('#login-password').value = '';
    form.querySelector('#login-password').dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('adresse e-mail valide');
  });

  it('logs in and persists the session', async () => {
    localStorage.removeItem('lp_user');
    const f = await setup();
    const form = f.nativeElement.querySelector('form');
    form.querySelector('#login-email').value = 'ops@linkpulse.io';
    form.querySelector('#login-email').dispatchEvent(new Event('input'));
    form.querySelector('#login-password').value = 'LinkPulse1';
    form.querySelector('#login-password').dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    await new Promise(resolve => setTimeout(resolve, 900));
    expect(localStorage.getItem('lp_user')).toContain('ops@linkpulse.io');
  });
});