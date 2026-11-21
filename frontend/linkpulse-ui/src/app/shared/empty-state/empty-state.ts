import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty-state" role="status">
      <div class="empty-state__icon" aria-hidden="true">
        @if (icon() === '✓') {
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16.5 9"/></svg>
        } @else {
          {{ icon() }}
        }
      </div>
      <h3 class="empty-state__title">{{ title() }}</h3>
      <p class="empty-state__description">{{ description() }}</p>
      @if (actionLabel()) {
        <button class="empty-state__action" (click)="action.emit()" type="button">
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--sp-3);
      padding: var(--sp-10) var(--sp-6);
      text-align: center;

      &__icon { font-size: 2.5rem; opacity: 0.8; }
      &__icon svg {
        width: 54px;
        height: 54px;
        fill: rgba(78, 222, 163, 0.08);
        stroke: var(--clr-online);
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      &__title { margin: 0; font-size: 1.125rem; color: var(--clr-text); }
      &__description { margin: 0; max-width: 380px; color: var(--clr-text-muted); }

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
export class EmptyStateComponent {
  readonly icon        = input<string>('◌');
  readonly title       = input<string>('Aucune donnée');
  readonly description = input<string>('Il n\'y a rien à afficher pour le moment.');
  readonly actionLabel = input<string>('');
  readonly action      = output<void>();
}