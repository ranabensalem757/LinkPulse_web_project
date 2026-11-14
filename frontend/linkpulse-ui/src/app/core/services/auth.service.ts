import { Injectable, signal, computed } from '@angular/core';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = 'http://localhost:3000/api';
  private readonly _user = signal<CurrentUser | null>(this.loadUser());

  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  private loadUser(): CurrentUser | null {
    try {
      const raw = typeof localStorage !== 'undefined'
        ? localStorage.getItem('lp_user')
        : null;
      return raw ? (JSON.parse(raw) as CurrentUser) : null;
    } catch {
      return null;
    }
  }

  private persist(user: CurrentUser | null): void {
    if (typeof localStorage === 'undefined') return;
    if (user) localStorage.setItem('lp_user', JSON.stringify(user));
    else      localStorage.removeItem('lp_user');
  }

  async login(email: string, password: string): Promise<CurrentUser> {
    const reponse = await fetch(`${this.apiUrl}/connexion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.succes) {
      throw new Error(resultat.message || 'Identifiants incorrects');
    }
    const user: CurrentUser = resultat.client;
    this._user.set(user);
    this.persist(user);
    return user;
  }

  async register(email: string, password: string): Promise<CurrentUser> {
    const reponse = await fetch(`${this.apiUrl}/inscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.succes) {
      throw new Error(resultat.message || 'Erreur lors de la création du compte');
    }
    const user: CurrentUser = resultat.client;
    this._user.set(user);
    this.persist(user);
    return user;
  }

  async loginWithOAuth(provider: 'GitHub' | 'Google', email: string): Promise<CurrentUser> {
    const reponse = await fetch(`${this.apiUrl}/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, email }),
    });
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.succes) {
      throw new Error(resultat.message || 'Erreur de connexion SSO');
    }
    const user: CurrentUser = resultat.client;
    this._user.set(user);
    this.persist(user);
    return user;
  }

  async sendResetCode(email: string): Promise<string> {
    const reponse = await fetch(`${this.apiUrl}/send-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.succes) {
      throw new Error(resultat.message || "Impossible d'envoyer le code");
    }
    return resultat.message;
  }

  async confirmResetPassword(email: string, code: string, newPassword: string): Promise<string> {
    const reponse = await fetch(`${this.apiUrl}/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword }),
    });
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.succes) {
      throw new Error(resultat.message || 'Code invalide ou expiré');
    }
    return resultat.message;
  }

  logout(): void {
    this._user.set(null);
    this.persist(null);
  }
}