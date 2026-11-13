import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  template: `
    <div class="loading-state" role="status" [attr.aria-label]="message()">
      <div class="loading-state__spinner" aria-hidden="true">
        <svg viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="25" cy="25" r="20" stroke="var(--clr-border-strong)" stroke-width="4"/>
          <path d="M25 5 A20 20 0 0 1 45 25" stroke="var(--clr-action)" stroke-width="4" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="loading-state__text">{{ message() }}</p>
    </div>
  `,
  styles: [`
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--sp-4);
      padding: var(--sp-12);
      color: var(--clr-text-muted);

      &__spinner svg {
        width: 40px;
        height: 40px;
        animation: spin 0.9s linear infinite;
      }

      &__text {
        font-size: 0.9375rem;
        color: var(--clr-text-muted);
        margin: 0;
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `],
})
export class LoadingStateComponent {
  readonly message = input<string>('Chargement…');
}
