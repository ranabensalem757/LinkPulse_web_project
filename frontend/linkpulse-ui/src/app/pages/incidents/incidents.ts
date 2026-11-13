import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IncidentsService } from '../../core/services/incidents.service';
import { DailyIncidentStats, Incident, IncidentDetail } from '../../core/models/incident.model';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state';
import { ErrorStateComponent } from '../../shared/error-state/error-state';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state';

type IncidentStatus = 'ongoing' | 'resolved';

interface EvidenceItem {
  time: string;
  title: string;
  tone: 'bad' | 'info' | 'now';
  text: string;
  extra?: string;
}

@Component({
  selector: 'app-incidents',
  imports: [LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './incidents.html',
  styleUrl: './incidents.scss',
})
export class IncidentsComponent implements OnInit {
  private readonly api = inject(IncidentsService);

  protected readonly incidents = signal<Incident[]>([]);
  protected readonly stats = signal<DailyIncidentStats | null>(null);
  protected readonly detail = signal<IncidentDetail | null>(null);

  protected readonly loading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  protected readonly filter = signal<'all' | IncidentStatus>('all');
  protected readonly query = signal('');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly traceOpen = signal(false);

  protected readonly counts = computed(() => ({
    all: this.incidents().length,
    ongoing: this.incidents().filter(item => item.status === 'ongoing').length,
    resolved: this.incidents().filter(item => item.status === 'resolved').length,
  }));

  protected readonly resolvedPercent = computed(() => {
    const { resolved, all } = this.counts();
    return all ? Math.round((resolved / all) * 100) : 0;
  });

  protected readonly availabilityLabel = computed(() =>
    this.stats() ? `${this.stats()!.availability24h.toFixed(2)}%` : '—',
  );

  protected readonly visible = computed(() => {
    const needle = this.query().trim().toLowerCase();
    return this.incidents().filter(item => {
      const statusOk = this.filter() === 'all' || item.status === this.filter();
      const text = `${item.siteName} ${item.id} ${item.errorCode} ${item.region}`.toLowerCase();
      return statusOk && (!needle || text.includes(needle));
    });
  });

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return this.incidents().find(item => item.id === id) ?? this.visible()[0] ?? null;
  });

  protected readonly proof = computed<IncidentDetail | null>(() => {
    const current = this.detail();
    return current && current.id === this.selected()?.id ? current : null;
  });

  protected readonly evidence = computed<EvidenceItem[]>(() => {
    const current = this.proof();
    if (!current) return [];
    return current.evidence.map(event => ({
      time: this.formatTime(event.eventTime),
      title: this.evidenceTitle(event.evidenceType),
      tone: event.evidenceType === 'check_failure' ? 'bad'
        : event.evidenceType === 'incident_opened' ? 'now' : 'info',
      text: event.summary,
      extra: event.httpStatus !== null ? `HTTP ${event.httpStatus}${event.responseTimeMs !== null ? ` · ${event.responseTimeMs} ms` : ''} · ${event.probe}` : event.probe,
    }));
  });

  protected readonly probe = computed(() =>
    this.proof()?.evidence.find(event => event.probe)?.probe ?? '—',
  );

  protected readonly errorBuckets = computed(() => {
    const counts = new Array<number>(24).fill(0);
    const now = Date.now();
    for (const incident of this.incidents()) {
      const hour = Math.floor((now - new Date(incident.startedAt).getTime()) / 3_600_000);
      if (hour >= 0 && hour < 24) counts[23 - hour] += 1;
    }
    const max = Math.max(1, ...counts);
    return counts.map(count => ({ count, height: Math.round((count / max) * 110) }));
  });

  protected readonly errorLine = computed(() => {
    const buckets = this.errorBuckets();
    return buckets
      .map((bucket, index) => `${index === 0 ? 'M' : 'L'}${(20 + index * (940 / 23)).toFixed(1)} ${(150 - bucket.height).toFixed(1)}`)
      .join(' ');
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getStats().subscribe({
      next: stats => this.stats.set(stats),
      error: () => this.stats.set(null),
    });
    this.api.getIncidents().subscribe({
      next: incidents => {
        this.incidents.set(incidents);
        this.loading.set(false);
        if (!this.selectedId() && incidents.length) {
          this.select(incidents[0].id);
        }
      },
      error: () => {
        this.error.set('API indisponible. Vérifiez que le backend FastAPI est démarré.');
        this.loading.set(false);
      },
    });
  }

  protected select(id: string): void {
    this.selectedId.set(id);
    this.traceOpen.set(false);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.api.getIncident(id).subscribe({
      next: incident => {
        this.detail.set(incident);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.notice.set('Les preuves détaillées sont indisponibles.');
      },
    });
  }

  protected setFilter(filter: 'all' | IncidentStatus): void {
    this.filter.set(filter);
  }

  protected refresh(): void {
    this.load();
  }

  protected downloadPdf(): void {
    const item = this.selected();
    if (!item) return;
    const current = this.proof();
    const lines = [
      'LinkPulse — Rapport d\'incident',
      `${item.id}  ${item.siteName}`,
      item.summary,
      `Erreur: ${item.errorCode}`,
      `Region: ${item.region}`,
      `Debut: ${this.formatDate(item.startedAt)}`,
      current?.endedAt ? `Fin: ${this.formatDate(current.endedAt)}` : 'Statut: en cours',
      `Cible: ${item.siteUrl}`,
    ];
    downloadPdf(`${item.id}.pdf`, lines);
    this.notice.set('Rapport PDF généré.');
  }

  protected severityLabel(item: Incident): string {
    const severity = item.severity === 'critical' ? 'Critique' : item.severity === 'warning' ? 'Alerte' : 'Info';
    return `${severity} · ${item.status === 'ongoing' ? 'en cours' : 'résolu'}`;
  }

  protected duration(item: Incident): string {
    if (item.durationMinutes === null) return 'En cours';
    if (item.durationMinutes < 60) return `${item.durationMinutes} min`;
    const hours = Math.floor(item.durationMinutes / 60);
    const minutes = item.durationMinutes % 60;
    return minutes ? `${hours} h ${minutes}` : `${hours} h`;
  }

  protected formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  private evidenceTitle(type: IncidentDetail['evidence'][number]['evidenceType']): string {
    const labels: Record<IncidentDetail['evidence'][number]['evidenceType'], string> = {
      check_failure: 'Contrôle échoué',
      check_recovery: 'Reprise confirmée',
      incident_opened: 'Incident ouvert',
      incident_closed: 'Incident clôturé',
      confirmation: 'Confirmation',
    };
    return labels[type];
  }
}

function downloadPdf(filename: string, lines: string[]): void {
  const commands = lines.map((line, index) => {
    const safe = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const y = 780 - index * 22;
    return `BT /F1 12 Tf 48 ${y} Td (${safe}) Tj ET`;
  }).join('\n');
  const stream = `${commands}\n`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}endstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object + '\n';
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    body += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob = new Blob([body], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}