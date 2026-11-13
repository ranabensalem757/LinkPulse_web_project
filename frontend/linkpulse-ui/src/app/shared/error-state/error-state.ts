import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-error-state',
  template: `
    <div class="error-state" role="alert">
      <span class="error-state__icon" aria-hidden="true">!</span>
      <h3 class="error-state__title">{{ title() }}</h3>
      <p class="error-state__description">{{ description() }}</p>
      @if (retryLabel()) {
        <button class="error-state__action" type="button" (click)="retry.emit()">
          {{ retryLabel() }}
        </button>
      }
    </div>
  `,
  styles: [`
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--sp-3);
      padding: var(--sp-10) var(--sp-6);
      text-align: center;
      border: 1px solid var(--clr-offline);
      border-radius: var(--radius-lg);
      background: var(--clr-incident-bg);
      color: var(--clr-text);

      &__icon {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--clr-offline);
        color: var(--clr-incident-bg);
        font-weight: 800;
        font-size: 1.25rem;
      }

      &__title { margin: 0; font-size: 1.05rem; }
      &__description { margin: 0; max-width: 420px; color: var(--clr-text-muted); }

      &__action {
        margin-top: var(--sp-2);
        padding: 8px 16px;
        border: 1px solid var(--clr-border-strong);
        border-radius: var(--radius-sm);
        background: var(--clr-surface-2);
        color: var(--clr-text);
        font-weight: 600;
      }
    }
  `],
})
export class ErrorStateComponent {
  readonly title = input<string>('Une erreur est survenue');
  readonly description = input<string>(
    'Impossible de charger les données. Vérifiez votre connexion puis réessayez.',
  );
  readonly retryLabel = input<string>('Réessayer');
  readonly retry = output<void>();
}