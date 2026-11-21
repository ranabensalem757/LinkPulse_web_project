import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Routes où un 401 est normal (identifiants faux, vérification de session…) : pas de redirection. */
const ROUTES_SANS_REDIRECTION = ['/connexion', '/inscription', '/send-reset-code', '/verify-reset-code', '/logout', '/me'];

/**
 * 1. Ajoute le jeton Bearer aux appels /api/.
 * 2. Si le serveur répond 401 (jeton expiré, serveur redémarré, mot de passe réinitialisé…),
 *    ferme la session locale et renvoie vers /login au lieu de laisser des écrans en erreur.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();
  const estApi = req.url.includes('/api/');

  const requete = token && estApi
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(requete).pipe(
    catchError((err: unknown) => {
      const sessionExpiree =
        estApi && Boolean(token) &&
        err instanceof HttpErrorResponse && err.status === 401 &&
        !ROUTES_SANS_REDIRECTION.some(route => req.url.includes(route));

      if (sessionExpiree) {
        auth.expireSession();
        if (!router.url.startsWith('/login')) {
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        }
      }
      return throwError(() => err);
    }),
  );
};
