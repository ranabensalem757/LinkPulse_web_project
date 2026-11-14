import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-topbar',
  imports: [RouterLink],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
  host: {
    '(document:click)': 'onDocumentClick()',
  },
})
export class TopbarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly profileOpen = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly currentUser = this.auth.currentUser;
  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly userLabel = computed(() => this.currentUser()?.email ?? 'Invité');

  protected toggleProfile(event: Event): void {
    event.stopPropagation();
    this.profileOpen.update(open => !open);
  }

  protected onDocumentClick(): void {
    this.profileOpen.set(false);
  }

  protected searchSites(): void {
    const query = this.searchQuery().trim();
    this.router.navigate(['/sites'], {
      queryParams: query ? { q: query } : {},
    });
  }

  protected logout(): void {
    this.auth.logout();
    this.profileOpen.set(false);
    this.router.navigate(['/']);
  }

  protected returnHome(): void {
    this.logout();
  }
}
