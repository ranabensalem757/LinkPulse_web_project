import { Component, computed, input } from '@angular/core';

export type StatusType = 'online' | 'offline' | 'paused' | 'critical' | 'resolved' | 'unknown';

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.scss',
})
export class StatusBadgeComponent {
  readonly status = input.required<StatusType>();

  protected readonly label = computed(() => {
    const map: Record<StatusType, string> = {
      online:   'En ligne',
      offline:  'Hors ligne',
      paused:   'En veille',
      critical: 'Critique',
      resolved: 'Résolu',
      unknown:  'Inconnu',
    };
    return map[this.status()];
  });
}
