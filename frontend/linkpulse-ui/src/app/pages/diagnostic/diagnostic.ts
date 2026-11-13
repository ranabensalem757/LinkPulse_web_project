import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SitesService } from '../../core/services/sites.service';
import { DiagnosticsService } from '../../core/services/diagnostics.service';
import { DiagnosticResult } from '../../core/models/dashboard.model';
import { Site } from '../../core/models/site.model';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state';
import { ErrorStateComponent } from '../../shared/error-state/error-state';

interface DiagnosticView {
  dns: string;
  http: string;
  tls: string;
  probe: string;
  summary: string;
  ok: boolean;
}

@Component({
  selector: 'app-diagnostic',
  imports: [FormsModule, RouterLink, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './diagnostic.html',
  styleUrl: './diagnostic.scss',
})
export class DiagnosticComponent implements OnInit {
  private readonly sitesApi = inject(SitesService);
  private readonly diagnostics = inject(DiagnosticsService);
  private readonly route = inject(ActivatedRoute);

  protected readonly sites = signal<Site[]>([]);
  protected readonly selectedId = signal('');
  protected readonly running = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly result = signal<DiagnosticView | null>(null);

  protected readonly selected = computed(() =>
    this.sites().find(site => site.id === this.selectedId()) ?? null,
  );

  ngOnInit(): void {
    this.sitesApi.getSites().subscribe({
      next: sites => {
        this.sites.set(sites);
        const requested = this.route.snapshot.queryParamMap.get('site');
        const initial = sites.find(site => site.id === requested)?.id ?? sites[0]?.id ?? '';
        this.selectedId.set(initial);
        this.loading.set(false);
        if (initial) this.run();
      },
      error: () => {
        this.error.set('Impossible de charger la liste des sites.');
        this.loading.set(false);
      },
    });
  }

  protected run(): void {
    const id = this.selectedId();
    if (!id || this.running()) return;
    this.running.set(true);
    this.result.set(null);
    this.diagnostics.run(id).subscribe({
      next: result => {
        this.result.set(this.toView(result));
        this.running.set(false);
      },
      error: () => {
        this.error.set('Le diagnostic a échoué.');
        this.running.set(false);
      },
    });
  }

  protected onSiteChange(id: string): void {
    this.selectedId.set(id);
    this.run();
  }

  private toView(result: DiagnosticResult): DiagnosticView {
    const dns = result.dnsResolved
      ? `Résolu${result.dnsLatencyMs !== null ? ` · ${result.dnsLatencyMs} ms` : ''}`
      : 'Non résolu';
    const http = result.httpStatus !== null
      ? `HTTP ${result.httpStatus}${result.httpResponseTimeMs !== null ? ` · ${result.httpResponseTimeMs} ms` : ''}`
      : 'Aucune réponse HTTP';
    const tls = result.tlsValid === null
      ? 'Non vérifié'
      : result.tlsValid
        ? `Certificat valide${result.tlsExpiry ? ` · expire le ${new Date(result.tlsExpiry).toLocaleDateString('fr-FR')}` : ''}`
        : 'Certificat invalide';
    return {
      dns,
      http,
      tls,
      probe: result.probe,
      summary: result.summary,
      ok: result.dnsResolved && !result.errorCategory,
    };
  }
}