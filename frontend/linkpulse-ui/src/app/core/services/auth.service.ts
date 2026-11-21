import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, CurrentUser, LoginRequest, RegisterRequest } from '../models/user.model';

const TOKEN_KEY = 'lp_token';
const USER_KEY = 'lp_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private readonly _user = signal<CurrentUser | null>(this.loadUser());

  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  // ── Persistence helpers ─────────────────────────────────────────────────────

  private loadUser(): CurrentUser | null {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
      return raw ? (JSON.parse(raw) as CurrentUser) : null;
    } catch {
      return null;
    }
  }

  private saveSession(user: CurrentUser, token?: string): void {
    if (typeof localStorage === 'undefined') return;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  private clearSession(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /** Returns the stored Bearer token, or null if not logged in. */
  getToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  // ── Auth methods ────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<CurrentUser> {
    const response = await this.postAuth<AuthResponse>(
      `${this.base}/connexion`,
      { email, password } satisfies LoginRequest,
      'Identifiants incorrects',
    );
    return this.applyAuth(response, 'Identifiants incorrects');
  }

  async register(email: string, password: string): Promise<CurrentUser> {
    const response = await this.postAuth<AuthResponse>(
      `${this.base}/inscription`,
      { email, password } satisfies RegisterRequest,
      'Erreur lors de la création du compte',
    );
    return this.applyAuth(response, 'Erreur lors de la création du compte');
  }

  async sendResetCode(email: string): Promise<string> {
    const response = await this.postAuth<{ succes: boolean; message?: string }>(
      `${this.base}/send-reset-code`,
      { email },
      "Impossible d'envoyer le code",
    );
    if (!response?.succes) {
      throw new Error(response?.message || "Impossible d'envoyer le code");
    }
    return response.message || 'Code envoyé.';
  }

  async confirmResetPassword(email: string, code: string, newPassword: string): Promise<string> {
    const response = await this.postAuth<{ succes: boolean; message?: string }>(
      `${this.base}/verify-reset-code`,
      { email, code, newPassword },
      'Code invalide ou expiré',
    );
    if (!response?.succes) {
      throw new Error(response?.message || 'Code invalide ou expiré');
    }
    return response.message || 'Mot de passe modifié.';
  }

  /** Ferme la session localement (sans appel réseau) : jeton expiré ou révoqué côté serveur. */
  expireSession(): void {
    this._user.set(null);
    this.clearSession();
  }

  /**
   * Au démarrage : vérifie auprès du serveur que la session stockée est encore valide.
   * Si le serveur répond 401, on se déconnecte proprement ; s'il est injoignable,
   * on garde la session locale (les appels suivants réessaieront).
   */
  async validateSession(): Promise<void> {
    if (typeof localStorage === 'undefined' || !this._user()) return;
    if (!this.getToken()) {
      this.expireSession();
      return;
    }
    try {
      const reponse = await firstValueFrom(
        this.http.get<{ succes: boolean; client?: CurrentUser }>(`${this.base}/me`),
      );
      if (reponse?.client) {
        this._user.set(reponse.client);
        this.saveSession(reponse.client);
      }
    } catch (err) {
      if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 404)) {
        this.expireSession();
      }
    }
  }

  async logout(): Promise<void> {
    const token = this.getToken();
    if (token) {
      try {
        await firstValueFrom(this.http.post(`${this.base}/logout`, {}));
      } catch {
        // fire-and-forget – always clear local session
      }
    }
    this._user.set(null);
    this.clearSession();
  }

  // ── HTTP & Error Helpers ────────────────────────────────────────────────────

  private async postAuth<T>(url: string, body: unknown, fallback: string): Promise<T> {
    try {
      return await firstValueFrom(this.http.post<T>(url, body));
    } catch (err) {
      throw new Error(this.errorMessage(err, fallback), { cause: err });
    }
  }

  private applyAuth(response: AuthResponse, fallbackMessage: string): CurrentUser {
    if (!response?.succes || !response.client) {
      throw new Error(response?.message || fallbackMessage);
    }
    this._user.set(response.client);
    this.saveSession(response.client, response.token);
    return response.client;
  }

  private errorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (typeof body === 'string' && body.trim()) return body;
      if (
        body &&
        typeof body === 'object' &&
        typeof (body as { message?: unknown }).message === 'string'
      ) {
        return (body as { message: string }).message;
      }
      if (err.status === 0) {
        return 'Serveur injoignable. Vérifiez que le backend LinkPulse est démarré.';
      }
      return fallback;
    }
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  }
}
