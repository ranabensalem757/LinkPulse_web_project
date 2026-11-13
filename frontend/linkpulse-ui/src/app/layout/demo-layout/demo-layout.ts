import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar';

@Component({
  selector: 'app-demo-layout',
  imports: [RouterLink, RouterOutlet, SidebarComponent],
  templateUrl: './demo-layout.html',
  styleUrl: './demo-layout.scss',
})
export class DemoLayoutComponent {}
