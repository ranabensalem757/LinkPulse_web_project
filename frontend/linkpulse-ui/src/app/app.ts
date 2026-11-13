import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: `
    <a href="#main-content" class="skip-link">Aller au contenu principal</a>
    <router-outlet />
  `,
  styles: [`
    :host { display: block; min-height: 100vh; min-height: 100dvh; }
  `],
})
export class App {}
