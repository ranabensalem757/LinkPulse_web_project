import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

type AuthTab = 'login' | 'register';
type SsoProvider = 'GitHub' | 'Google';

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

  protected readonly activeTab       = signal<AuthTab>('login');
  protected readonly showPassword    = signal(false);
  protected readonly isLoading       = signal(false);
  protected readonly errorMsg        = signal('');
  protected readonly ssoProvider     = signal<SsoProvider | null>(null);
  protected readonly recoveryMode    = signal(false);
  protected readonly codeSent        = signal(false);
  protected readonly recoverySuccess = signal('');

  protected readonly isLogin    = computed(() => this.activeTab() === 'login');
  protected readonly isRegister = computed(() => this.activeTab() === 'register');

  protected readonly loginForm = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly registerForm = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm:  ['', [Validators.required]],
  });

  protected readonly ssoForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly resetForm = this.fb.group({
    email:       ['', [Validators.required, Validators.email]],
    code:        ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('tab') === 'register') {
      this.activeTab.set('register');
    }
  }

  protected switchTab(tab: AuthTab): void {
    this.activeTab.set(tab);
    this.errorMsg.set('');
    this.recoverySuccess.set('');
    this.recoveryMode.set(false);
    this.codeSent.set(false);
    this.ssoProvider.set(null);
    this.loginForm.reset();
    this.registerForm.reset();
  }

  protected onSso(provider: SsoProvider): void {
    this.errorMsg.set('');
    this.recoverySuccess.set('');
    if (this.ssoProvider() === provider) {
      this.ssoProvider.set(null);
      return;
    }
    this.ssoProvider.set(provider);
    this.ssoForm.reset();
  }

  protected async onSsoSubmit(): Promise<void> {
    const provider = this.ssoProvider();
    if (!provider) return;

    if (this.ssoForm.invalid) {
      this.ssoForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      const { email } = this.ssoForm.value;
      await this.auth.loginWithOAuth(provider, email!);
      await this.navigateAfterAuth();
    } catch (err: any) {
      this.errorMsg.set(err?.message || `Erreur lors de la connexion ${provider}.`);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  protected toggleRecovery(): void {
    this.errorMsg.set('');
    this.recoverySuccess.set('');
    const nextState = !this.recoveryMode();
    this.recoveryMode.set(nextState);
    this.codeSent.set(false);

    if (nextState) {
      const currentEmail = this.loginForm.value.email || '';
      this.resetForm.reset({ email: currentEmail, code: '', newPassword: '' });
    }
  }

  protected async onSendCode(): Promise<void> {
    const emailCtrl = this.resetForm.controls.email;
    if (emailCtrl.invalid) {
      emailCtrl.markAsTouched();
      this.errorMsg.set('Veuillez entrer une adresse e-mail valide.');
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set('');
    this.recoverySuccess.set('');
    try {
      const msg = await this.auth.sendResetCode(emailCtrl.value!);
      this.codeSent.set(true);
      this.recoverySuccess.set(msg);
    } catch (err: any) {
      this.errorMsg.set(err?.message || "Erreur lors de l'envoi du code.");
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async onResetSubmit(): Promise<void> {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      this.errorMsg.set('Vérifiez le code à 6 chiffres et le nouveau mot de passe (8 caractères min.).');
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      const { email, code, newPassword } = this.resetForm.value;
      const msg = await this.auth.confirmResetPassword(email!, code!, newPassword!);
      this.recoverySuccess.set(msg);
      this.recoveryMode.set(false);
      this.codeSent.set(false);
      this.loginForm.patchValue({ email: email!, password: newPassword! });
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'Code invalide ou expiré.');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async onLoginSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.errorMsg.set('');
    this.recoverySuccess.set('');
    try {
      const { email, password } = this.loginForm.value;
      await this.auth.login(email!, password!);
      await this.navigateAfterAuth();
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'E-mail ou mot de passe incorrect. Veuillez réessayer.');
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
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'Une erreur est survenue lors de la création du compte.');
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