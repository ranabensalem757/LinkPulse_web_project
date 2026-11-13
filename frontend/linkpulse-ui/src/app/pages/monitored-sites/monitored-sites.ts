import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SitesService } from '../../core/services/sites.service';
import { Site } from '../../core/models/site.model';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state';
import { ErrorStateComponent } from '../../shared/error-state/error-state';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state';

type Filter = 'all' | 'online' | 'offline';

@Component({
  selector: 'app-monitored-sites',
  imports: [RouterLink, ReactiveFormsModule, DecimalPipe, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './monitored-sites.html',
  styleUrl: './monitored-sites.scss',
})
export class MonitoredSitesComponent implements OnInit {
  private readonly api = inject(SitesService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly filter = signal<Filter>('all');
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly composerOpen = signal(false);
  protected readonly menuId = signal<string | null>(null);
  protected readonly formError = signal('');
  protected readonly sites = signal<Site[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
  });

  protected readonly onlineCount = computed(() => this.sites().filter(s => s.status === 'online').length);
  protected readonly offlineCount = computed(() => this.sites().filter(s => s.status === 'offline').length);
  protected readonly pausedCount = computed(() => this.sites().filter(s => s.status === 'paused').length);

  protected readonly avgAvailability = computed(() => {
    const sites = this.sites();
    if (!sites.length) return 0;
    return sites.reduce((sum, site) => sum + site.availability30d, 0) / sites.length;
  });

  protected readonly avgResponse = computed(() => {
    const values = this.sites().filter(s => s.responseTimeMs > 0).map(s => s.responseTimeMs);
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  });

  protected readonly visibleSites = computed(() => {
    const needle = this.query().trim().toLowerCase();
    return this.sites().filter(site => {
      const matchesFilter = this.filter() === 'all'
        || (this.filter() === 'online' && site.status === 'online')
        || (this.filter() === 'offline' && site.status === 'offline');
      const matchesQuery = !needle
        || site.name.toLowerCase().includes(needle)
        || site.url.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  });

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) this.query.set(q);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getSites().subscribe({
      next: sites => {
        this.sites.set(sites);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les sites surveillés.');
        this.loading.set(false);
      },
    });
  }

  protected refresh(): void {
    this.load();
  }

  protected setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  protected onQuery(value: string): void {
    this.query.set(value);
  }

  protected resetFilters(): void {
    this.filter.set('all');
    this.query.set('');
  }

  protected openComposer(): void {
    this.formError.set('');
    this.composerOpen.set(true);
  }

  protected closeComposer(): void {
    this.composerOpen.set(false);
    this.form.reset();
  }

  protected saveSite(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Indiquez un nom et une URL commençant par http:// ou https://.');
      return;
    }
    const { name, url } = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set('');
    this.api.addSite({ name, url, checkIntervalSeconds: 60 }).subscribe({
      next: site => {
        this.sites.update(list => [site, ...list]);
        this.saving.set(false);
        this.closeComposer();
        this.filter.set('all');
        this.notice.set(`${site.name} a été ajouté à la surveillance.`);
      },
      error: () => {
        this.saving.set(false);
        this.formError.set("L'ajout a échoué. Vérifiez l'URL puis réessayez.");
      },
    });
  }

  protected toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.menuId.update(current => current === id ? null : id);
  }

  protected pause(site: Site, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const shouldPause = site.status !== 'paused';
    this.api.pauseSite(site.id, shouldPause).subscribe({
      next: updated => this.replace(updated),
      error: () => this.notice.set('La mise à jour du site a échoué.'),
    });
  }

  protected remove(site: Site): void {
    if (!window.confirm(`Retirer ${site.name} de la surveillance ?`)) return;
    this.api.deleteSite(site.id).subscribe({
      next: () => {
        this.sites.update(list => list.filter(item => item.id !== site.id));
        this.notice.set(`${site.name} a été retiré.`);
      },
      error: () => this.notice.set('La suppression a échoué.'),
    });
    this.menuId.set(null);
  }

  protected statusLabel(site: Site): string {
    if (site.status === 'online') return 'En ligne';
    if (site.status === 'offline') return 'Hors ligne';
    if (site.status === 'paused') return 'En pause';
    return 'Inconnu';
  }

  protected lastCheck(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  protected spark(site: Site): string {
    if (site.status === 'offline' || site.responseTimeMs <= 0) {
      return '0,18 12,18 24,18 36,18 48,18 60,18 72,18';
    }
    const seed = [...site.id].reduce((total, char) => total + char.charCodeAt(0), 0);
    const values = Array.from({ length: 12 }, (_, index) =>
      0.5 + Math.sin((seed + index * 3) / 4) * 0.28,
    );
    return values
      .map((value, index) => `${(index / (values.length - 1)) * 72},${22 - value * 16}`)
      .join(' ');
  }

  private replace(updated: Site): void {
    this.sites.update(list => list.map(site => site.id === updated.id ? updated : site));
  }
}