import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

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
  protected readonly isMobileOpen = signal(false);

  protected readonly navItems: NavItem[] = [
    { label: 'Tableau de bord', route: '/dashboard', icon: 'grid' },
    { label: 'Sites surveillés', route: '/sites', icon: 'sites' },
    { label: 'Incidents', route: '/incidents', icon: 'alert' },
    { label: 'Diagnostic', route: '/diagnostic', icon: 'search' },
  ];

  protected toggleMobile(): void {
    this.isMobileOpen.update(open => !open);
  }

  protected closeMobile(): void {
    this.isMobileOpen.set(false);
  }
}
