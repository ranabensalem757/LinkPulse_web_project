import { Injectable, signal, computed } from '@angular/core';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<CurrentUser | null>(this.loadUser());

  readonly currentUser      = this._user.asReadonly();
  readonly isAuthenticated  = computed(() => this._user() !== null);

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
    else       localStorage.removeItem('lp_user');
  }

  async login(email: string, _password: string): Promise<CurrentUser> {
    // Simulate network delay — replace with a real HTTP call when the backend exists.
    await delay(600);
    const user: CurrentUser = {
      id:    randomId(),
      email,
      name:  email.split('@')[0],
    };
    this._user.set(user);
    this.persist(user);
    return user;
  }

  async register(email: string, _password: string): Promise<CurrentUser> {
    await delay(800);
    const user: CurrentUser = {
      id:    randomId(),
      email,
      name:  email.split('@')[0],
    };
    this._user.set(user);
    this.persist(user);
    return user;
  }

  logout(): void {
    this._user.set(null);
    this.persist(null);
  }
}

function randomId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `user-${Date.now()}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
