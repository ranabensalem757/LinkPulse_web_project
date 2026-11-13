import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.scss',
})
export class PublicLayoutComponent {
  protected readonly mobileMenuOpen = signal(false);

  protected toggleMenu(): void {
    this.mobileMenuOpen.update(open => !open);
  }

  protected closeMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
