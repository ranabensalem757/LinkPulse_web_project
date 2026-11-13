import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DEMO_MODE } from '../../core/demo/demo-mode';
import { DashboardService } from '../../core/services/dashboard.service';
import { SitesService } from '../../core/services/sites.service';
import { DashboardSummary, LatencySeries, RecentEvent } from '../../core/models/dashboard.model';
import { Site } from '../../core/models/site.model';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state';
import { ErrorStateComponent } from '../../shared/error-state/error-state';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state';

type Range = '1H' | '24H' | '7J';
type ApiRange = '1h' | '24h' | '7d';

interface ServiceRow {
  name: string;
  meta: string;
  state: 'ok' | 'down' | 'idle';
  label: string;
  link: string;
}

interface JournalRow {
  id: string;
  name: string;
  status: string;
  tone: 'bad' | 'ok' | 'info' | 'idle';
  type: string;
  when: string;
  action: string;
  link: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DecimalPipe, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  private readonly dashboard = inject(DashboardService);
  private readonly sitesApi = inject(SitesService);
  private readonly router = inject(Router);
  protected readonly isDemo = inject(DEMO_MODE);
  protected readonly routePrefix = this.isDemo ? '/demo' : '';

  protected readonly range = signal<Range>('24H');
  protected readonly ranges: Range[] = ['1H', '24H', '7J'];
  protected readonly notice = signal('');

  protected readonly loading = signal(true);
  protected readonly latencyLoading = signal(false);
  protected readonly error = signal('');
  protected readonly updatedAt = signal('');

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly latency = signal<LatencySeries | null>(null);
  protected readonly events = signal<RecentEvent[]>([]);
  protected readonly sites = signal<Site[]>([]);

  constructor() {
    this.loadAll();
  }

  protected readonly services = computed<ServiceRow[]>(() =>
    this.sites().map(site => {
      const state: ServiceRow['state'] =
        site.status === 'offline' ? 'down' : site.status === 'online' ? 'ok' : 'idle';
      const label =
        site.status === 'offline' ? 'Hors ligne'
          : site.status === 'online' ? 'Opérationnel'
            : site.status === 'paused' ? 'En veille' : 'Inconnu';
      const meta = site.status === 'offline'
        ? `Aucune réponse · ${site.region}`
        : `HTTP 200 · ${site.responseTimeMs} ms`;
      return { name: site.name, meta, state, label, link: `${this.routePrefix}/sites/${site.id}` };
    }),
  );

  protected readonly journal = computed<JournalRow[]>(() =>
    this.events().map(event => {
      const tone: JournalRow['tone'] =
        event.severity === 'critical' ? 'bad'
          : event.severity === 'success' ? 'ok'
            : event.severity === 'warning' ? 'info' : 'idle';
      const site = this.sites().find(s => s.name === event.siteName);
      const link = event.type === 'incident_opened' || event.type === 'incident_closed'
        ? `${this.routePrefix}/incidents`
        : site ? `${this.routePrefix}/sites/${site.id}` : `${this.routePrefix}/sites`;
      return {
        id: event.id,
        name: event.siteName,
        status: event.severity === 'critical' ? 'Critique' : event.severity === 'success' ? 'Résolu' : 'Info',
        tone,
        type: this.eventTypeLabel(event.type),
        when: this.timeAgo(event.timestamp),
        action: event.type === 'incident_opened' ? 'Analyser' : 'Détails',
        link,
      };
    }),
  );

  protected readonly chart = computed(() => {
    const series = this.latency();
    const points = series?.points ?? [];
    const threshold = series?.thresholdMs ?? 300;
    if (points.length < 2) return { line: '', area: '', thresholdY: 0, lastX: 0, lastY: 0, max: threshold };

    const values = points.map(point => point.valueMs);
    const max = Math.max(threshold, ...values) * 1.1;
    const x = (index: number) => (index / (points.length - 1)) * 720;
    const y = (value: number) => 210 - (value / max) * 180;

    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(point.valueMs).toFixed(1)}`)
      .join(' ');
    return {
      line,
      area: `${line} L720 210 L0 210 Z`,
      thresholdY: y(threshold),
      lastX: x(points.length - 1),
      lastY: y(points[points.length - 1].valueMs),
      max,
    };
  });

  protected readonly chartStats = computed(() => {
    const values = (this.latency()?.points ?? []).map(point => point.valueMs);
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return {
      min: Math.min(...values),
      median,
      max: Math.max(...values),
    };
  });

  protected readonly currentLatency = computed(() => {
    const points = this.latency()?.points ?? [];
    return points.length ? points[points.length - 1].valueMs : null;
  });

  protected readonly axisLabels = computed(() => {
    switch (this.range()) {
      case '1H':
        return ['Il y a 1h', '45 min', '30 min', '15 min', '5 min', 'Maintenant'];
      case '7J':
        return ['Il y a 7j', '5j', '3j', '2j', '1j', 'Maintenant'];
      default:
        return ['Il y a 24h', '18h', '12h', '6h', '1h', 'Maintenant'];
    }
  });

  protected setRange(range: Range): void {
    if (this.range() === range) return;
    this.range.set(range);
    this.loadLatency(this.toApiRange(range));
  }

  protected refresh(): void {
    this.loadAll();
  }

  protected goToSites(): void {
    void this.router.navigateByUrl(`${this.routePrefix}/sites`);
  }

  protected retry(): void {
    this.loadAll();
  }

  protected showDemoUnavailable(): void {
    this.notice.set('Les diagnostics réels ne sont pas disponibles en mode démo.');
  }

  protected exportCsv(): void {
    this.dashboard.exportCsv().subscribe({
      next: csv => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'linkpulse-evenements.csv';
        link.click();
        URL.revokeObjectURL(url);
        this.notice.set('Export CSV téléchargé.');
      },
      error: () => this.notice.set("L'export a échoué. Réessayez."),
    });
  }

  private loadAll(): void {
    this.loading.set(true);
    this.error.set('');
    const range = this.toApiRange(this.range());
    forkJoin({
      summary: this.dashboard.getSummary(),
      latency: this.dashboard.getLatency(range),
      events: this.dashboard.getEvents(),
      sites: this.sitesApi.getSites(),
    }).subscribe({
      next: ({ summary, latency, events, sites }) => {
        this.summary.set(summary);
        this.latency.set(latency);
        this.events.set(events);
        this.sites.set(sites);
        this.updatedAt.set(new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('API indisponible. Vérifiez que le backend FastAPI est démarré et que apiBaseUrl est correct.');
        this.loading.set(false);
      },
    });
  }

  private loadLatency(range: ApiRange): void {
    this.latencyLoading.set(true);
    this.dashboard.getLatency(range).subscribe({
      next: series => {
        this.latency.set(series);
        this.latencyLoading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger la courbe de latence.');
        this.latencyLoading.set(false);
      },
    });
  }

  private toApiRange(range: Range): ApiRange {
    return range === '1H' ? '1h' : range === '7J' ? '7d' : '24h';
  }

  private eventTypeLabel(type: RecentEvent['type']): string {
    const labels: Record<RecentEvent['type'], string> = {
      incident_opened: 'Incident ouvert',
      incident_closed: 'Incident résolu',
      check_ok: 'Vérification réussie',
      check_fail: 'Échec de vérification',
      site_added: 'Site ajouté',
      site_paused: 'Site en pause',
    };
    return labels[type];
  }

  private timeAgo(iso: string): string {
    const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (diffMinutes < 1) return "À l'instant";
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    const hours = Math.round(diffMinutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    return `Il y a ${Math.round(hours / 24)} j`;
  }
}