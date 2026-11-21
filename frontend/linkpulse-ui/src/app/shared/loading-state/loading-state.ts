import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  template: `
    @if (variant() === 'skeleton') {
      <div class="loading-state loading-state--skeleton" role="status" aria-live="polite" [attr.aria-label]="message()" aria-busy="true">
        <div class="skeleton skeleton--head"></div>
        <div class="skeleton-grid" aria-hidden="true">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
        <p class="loading-state__text">{{ message() }}</p>
      </div>
    } @else {
      <div class="loading-state" role="status" aria-live="polite" [attr.aria-label]="message()" aria-busy="true">
        <div class="loading-state__spinner" aria-hidden="true">
          <svg viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="25" cy="25" r="20" stroke="var(--clr-border-strong)" stroke-width="4"/>
            <path d="M25 5 A20 20 0 0 1 45 25" stroke="var(--clr-action)" stroke-width="4" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="loading-state__text">{{ message() }}</p>
      </div>
    }
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

    .loading-state--skeleton { align-items: stretch; }
    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--sp-3);
    }
    .skeleton {
      height: 72px;
      border-radius: var(--radius-md);
      background: linear-gradient(90deg, var(--clr-surface-2) 25%, var(--clr-surface) 50%, var(--clr-surface-2) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.2s linear infinite;
    }
    .skeleton--head { width: 38%; height: 24px; margin-bottom: var(--sp-1); }

    @keyframes shimmer {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }

    @media (max-width: 700px) {
      .skeleton-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class LoadingStateComponent {
  readonly message = input<string>('Chargement…');
  readonly variant = input<'spinner' | 'skeleton'>('spinner');
}
