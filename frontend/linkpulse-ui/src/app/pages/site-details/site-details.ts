import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SitesService } from '../../core/services/sites.service';
import { IncidentsService } from '../../core/services/incidents.service';
import { CheckResult, LatencySeries, Site } from '../../core/models/site.model';
import { Incident } from '../../core/models/incident.model';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state';

interface CheckRow {
  id: string;
  time: string;
  code: string;
  ok: boolean;
  ms: string;
  probe: string;
  result: string;
}

@Component({
  selector: 'app-site-details',
  imports: [RouterLink, DecimalPipe, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './site-details.html',
  styleUrl: './site-details.scss',
})
export class SiteDetailsComponent {
  private readonly api = inject(SitesService);
  private readonly incidentsApi = inject(IncidentsService);
  readonly id = input('');

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly testing = signal(false);
  protected readonly notice = signal('');

  protected readonly site = signal<Site | null>(null);
  protected readonly checks = signal<CheckResult[]>([]);
  protected readonly latency = signal<LatencySeries | null>(null);
  protected readonly relatedIncidents = signal<Incident[]>([]);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) {
        this.load(id);
      } else {
        this.loading.set(false);
        this.error.set('Identifiant de site manquant.');
      }
    });
  }

  protected readonly avgResponse = computed(() => {
    const values = this.checks()
      .map(check => check.responseTimeMs)
      .filter((value): value is number => value !== null);
    if (values.length) return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    return this.site()?.responseTimeMs ?? 0;
  });

  protected readonly tlsExpiry = computed(() => {
    const values = this.checks()
      .map(check => check.tlsExpiry)
      .filter((value): value is string => value !== null);
    if (!values.length) return null;
    return values.sort().at(-1) ?? null;
  });

  protected readonly tlsDays = computed(() => {
    const expiry = this.tlsExpiry();
    if (!expiry) return null;
    return Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000));
  });

  protected readonly healthyProbes = computed(() => {
    const rows = this.checks().slice(0, 3);
    if (!rows.length) return '—';
    return `${rows.filter(row => row.success).length}/${rows.length}`;
  });

  protected readonly rows = computed<CheckRow[]>(() =>
    this.checks().map(check => ({
      id: check.id,
      time: this.formatTime(check.checkedAt),
      code: check.httpStatus ? `${check.httpStatus}` : '—',
      ok: check.success,
      ms: check.responseTimeMs !== null ? `${check.responseTimeMs} ms` : 'TIMEOUT',
      probe: check.probe,
      result: this.resultLabel(check),
    })),
  );

  protected readonly chart = computed(() => {
    const series = this.latency();
    const points = series?.points ?? [];
    const threshold = series?.thresholdMs ?? 300;
    if (points.length < 2) return { line: '', area: '', thresholdY: 0, lastX: 0, lastY: 0 };

    const max = Math.max(threshold, ...points.map(point => point.valueMs)) * 1.1;
    const x = (index: number) => 24 + (index / (points.length - 1)) * 796;
    const y = (value: number) => 210 - (value / max) * 180;
    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(point.valueMs).toFixed(1)}`)
      .join(' ');
    return {
      line,
      area: `${line} L820 210 L24 210 Z`,
      thresholdY: y(threshold),
      lastX: x(points.length - 1),
      lastY: y(points[points.length - 1].valueMs),
    };
  });

  protected load(id = this.id()): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      site: this.api.getSite(id),
      checks: this.api.getChecks(id),
      latency: this.api.getLatency(id, '24h'),
      incidents: this.incidentsApi.getIncidents(),
    }).subscribe({
      next: ({ site, checks, latency, incidents }) => {
        if (!site || !('id' in site)) {
          this.error.set('Site introuvable.');
          this.loading.set(false);
          return;
        }
        this.site.set(site);
        this.checks.set(checks);
        this.latency.set(latency);
        this.relatedIncidents.set(incidents.filter(incident => incident.siteId === id));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger le détail du site.');
        this.loading.set(false);
      },
    });
  }

  protected async runTest(): Promise<void> {
    const id = this.id();
    if (!id || this.testing()) return;
    this.testing.set(true);
    this.notice.set('');
    this.api.runCheck(id).subscribe({
      next: check => {
        this.checks.update(list => [check, ...list]);
        this.site.update(current => current
          ? {
            ...current,
            responseTimeMs: check.responseTimeMs ?? current.responseTimeMs,
            lastCheckedAt: check.checkedAt,
            status: check.success ? 'online' : 'offline',
          }
          : current,
        );
        this.notice.set(check.success
          ? `Test terminé · HTTP ${check.httpStatus ?? 200} · ${check.responseTimeMs ?? 0} ms · ${check.probe}`
          : `Test terminé · HTTP ${check.httpStatus ?? 'erreur'} · ${check.probe}`);
        this.testing.set(false);
      },
      error: () => {
        this.notice.set('Le test immédiat a échoué.');
        this.testing.set(false);
      },
    });
  }

  protected formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour12: false });
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  private resultLabel(check: CheckResult): string {
    const labels: Record<CheckResult['result'], string> = {
      ok: 'Succès',
      timeout: "Délai d'attente dépassé",
      http_error: 'Erreur HTTP',
      dns_error: 'Erreur DNS',
      tls_error: 'Erreur TLS',
    };
    return labels[check.result];
  }
}