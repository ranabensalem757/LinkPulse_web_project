import { Component, input } from '@angular/core';

export type TrendDirection = 'up' | 'down' | 'neutral';

@Component({
  selector: 'app-metric-card',
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.scss',
})
export class MetricCardComponent {
  readonly title      = input.required<string>();
  readonly value      = input.required<string>();
  readonly unit       = input<string>('');
  readonly trend      = input<TrendDirection>('neutral');
  readonly trendLabel = input<string>('');
  readonly icon       = input<string>('');
  readonly highlight  = input<boolean>(false);
  readonly loading    = input<boolean>(false);
}
