import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar';
import { TopbarComponent } from '../topbar/topbar';

@Component({
  selector: 'app-console-layout',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './console-layout.html',
  styleUrl: './console-layout.scss',
})
export class ConsoleLayoutComponent {}
