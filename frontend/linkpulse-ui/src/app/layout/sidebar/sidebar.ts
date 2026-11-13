import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DEMO_MODE } from '../../core/demo/demo-mode';

interface NavItem {
  label: string;
  route: string;
  icon: 'grid' | 'sites' | 'alert' | 'search';
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  private readonly demoMode = inject(DEMO_MODE);
  protected readonly isMobileOpen = signal(false);

  protected readonly isDemo = this.demoMode;
  protected readonly navItems: NavItem[] = [
    { label: 'Tableau de bord', route: this.route('/dashboard'), icon: 'grid' },
    { label: 'Sites surveillés', route: this.route('/sites'), icon: 'sites' },
    { label: 'Incidents', route: this.route('/incidents'), icon: 'alert' },
    ...(!this.demoMode ? [{ label: 'Diagnostic', route: '/diagnostic', icon: 'search' as const }] : []),
  ];

  private route(path: string): string {
    return this.demoMode ? `/demo${path}` : path;
  }

  protected toggleMobile(): void {
    this.isMobileOpen.update(open => !open);
  }

  protected closeMobile(): void {
    this.isMobileOpen.set(false);
  }
}
