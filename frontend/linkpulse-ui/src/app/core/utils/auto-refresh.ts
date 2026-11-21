import { DestroyRef, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, interval } from 'rxjs';

/** Intervalle de rafraîchissement automatique (le backend sonde toutes les 15 s). */
export const AUTO_REFRESH_MS = 15_000;

/**
 * Appelle `callback` à intervalle régulier tant que le composant est vivant.
 * - À appeler dans un contexte d'injection (constructeur ou initialiseur de champ).
 * - Ne fait rien côté serveur (SSR) ni quand l'onglet est caché.
 */
export function autoRefresh(callback: () => void, periodMs = AUTO_REFRESH_MS): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  interval(periodMs)
    .pipe(
      filter(() => !document.hidden),
      takeUntilDestroyed(inject(DestroyRef)),
    )
    .subscribe(callback);
}

/** Message d'erreur lisible : celui du serveur s'il existe, sinon `parDefaut`. */
export function messageServeur(err: unknown, parDefaut: string): string {
  const corps = (err as { error?: { message?: unknown } } | null)?.error;
  return typeof corps?.message === 'string' && corps.message ? corps.message : parDefaut;
}
