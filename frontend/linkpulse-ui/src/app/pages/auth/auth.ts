import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

type AuthTab = 'login' | 'register';

@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
})
export class AuthComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  protected readonly activeTab    = signal<AuthTab>('login');
  protected readonly showPassword = signal(false);
  protected readonly isLoading    = signal(false);
  protected readonly errorMsg     = signal('');
  protected readonly recoveryNotice = signal(false);
  protected readonly ssoNotice = signal('');

  protected readonly isLogin    = computed(() => this.activeTab() === 'login');
  protected readonly isRegister = computed(() => this.activeTab() === 'register');

  protected readonly loginForm = this.fb.group({
    email:    ['nom@infrastructure.corp', [Validators.required, Validators.email]],
    password: ['LinkPulse1', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly registerForm = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm:  ['', [Validators.required]],
  });

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('tab') === 'register') {
      this.activeTab.set('register');
    }
  }

  protected switchTab(tab: AuthTab): void {
    this.activeTab.set(tab);
    this.errorMsg.set('');
    this.recoveryNotice.set(false);
    this.ssoNotice.set('');
    this.loginForm.reset({ email: 'nom@infrastructure.corp', password: 'LinkPulse1' });
    this.registerForm.reset();
  }

  protected onSso(provider: string): void {
    this.ssoNotice.set(`La connexion ${provider} n’est pas activée dans cette version. Utilisez l’e-mail et le mot de passe.`);
  }

  protected togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  protected showRecoveryNotice(): void {
    this.recoveryNotice.set(true);
  }

  protected async onLoginSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      const { email, password } = this.loginForm.value;
      await this.auth.login(email!, password!);
      await this.navigateAfterAuth();
    } catch {
      this.errorMsg.set('E-mail ou mot de passe incorrect. Veuillez réessayer.');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async onRegisterSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    const { password, confirm } = this.registerForm.value;
    if (password !== confirm) {
      this.errorMsg.set('Les mots de passe ne correspondent pas.');
      return;
    }
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      const { email } = this.registerForm.value;
      await this.auth.register(email!, password!);
      await this.navigateAfterAuth();
    } catch {
      this.errorMsg.set('Une erreur est survenue lors de la création du compte.');
    } finally {
      this.isLoading.set(false);
    }
  }

private async navigateAfterAuth(): Promise<void> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')
      ? returnUrl
      : '/dashboard';
    await this.router.navigateByUrl(destination);
  }
}
