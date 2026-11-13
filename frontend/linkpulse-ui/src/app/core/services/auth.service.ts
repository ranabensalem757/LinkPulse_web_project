import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '../models/user.model';

const USER_KEY = 'lp_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private readonly _user = signal<User | null>(this.loadUser());

  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  async login(email: string, password: string): Promise<User> {
    const response = await this.postAuth<AuthResponse>(
      `${this.base}/connexion`,
      { email, password } satisfies LoginRequest,
      'Identifiants incorrects',
    );
    return this.applyAuth(response, 'Identifiants incorrects');
  }

  async register(email: string, password: string): Promise<User> {
    const response = await this.postAuth<AuthResponse>(
      `${this.base}/inscription`,
      { email, password } satisfies RegisterRequest,
      'Erreur lors de la création du compte',
    );
    return this.applyAuth(response, 'Erreur lors de la création du compte');
  }

  logout(): void {
    this._user.set(null);
    this.persist(null);
  }

  private async postAuth<T>(url: string, body: unknown, fallback: string): Promise<T> {
    try {
      return await firstValueFrom(this.http.post<T>(url, body));
    } catch (err) {
      throw new Error(this.errorMessage(err, fallback));
    }
  }

  private errorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string') {
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

  private applyAuth(response: AuthResponse, fallbackMessage: string): User {
    if (!response?.succes || !response.client) {
      throw new Error(response?.message || fallbackMessage);
    }
    this._user.set(response.client);
    this.persist(response.client);
    return response.client;
  }

  private loadUser(): User | null {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  private persist(user: User | null): void {
    if (typeof localStorage === 'undefined') return;
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }
}