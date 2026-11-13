import { Component, computed, input } from '@angular/core';
import { LatencyPoint } from '../../core/models/site.model';

@Component({
  selector: 'app-latency-chart',
  templateUrl: './latency-chart.html',
  styleUrl: './latency-chart.scss',
})
export class LatencyChartComponent {
  readonly points       = input<LatencyPoint[]>([]);
  readonly thresholdMs  = input<number | null>(2000);
  readonly valueUnit    = input('ms');
  readonly height       = input<number>(120);
  readonly label        = input<string>('Latence RTT');

  protected readonly W = 600;

  protected readonly maxVal = computed(() =>
    Math.max(...this.points().map(p => p.valueMs), this.thresholdMs() ?? 0, 1),
  );

  protected readonly linePath = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return '';
    const H  = this.height();
    const W  = this.W;
    const mx = this.maxVal();
    const toX = (i: number) => (i / (pts.length - 1)) * W;
    const toY = (v: number) => H - (v / mx) * (H - 10);
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.valueMs).toFixed(1)}`).join(' ');
  });

  protected readonly areaPath = computed(() => {
    const line = this.linePath();
    if (!line) return '';
    const H = this.height();
    return `${line} L${this.W},${H} L0,${H} Z`;
  });

  protected readonly thresholdY = computed(() => {
    const H  = this.height();
    const mx = this.maxVal();
    const threshold = this.thresholdMs();
    return threshold === null ? null : (H - (threshold / mx) * (H - 10)).toFixed(1);
  });

  protected readonly firstLabel = computed(() => {
    const pts = this.points();
    return pts.length ? formatTime(pts[0].timestamp) : '';
  });

  protected readonly lastLabel = computed(() => {
    const pts = this.points();
    return pts.length ? formatTime(pts[pts.length - 1].timestamp) : '';
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
