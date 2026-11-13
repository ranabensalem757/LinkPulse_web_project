import { Injectable, computed, signal } from '@angular/core';

export type SiteStatus = 'online' | 'offline' | 'paused';

export interface DemoSite {
  id: string;
  name: string;
  url: string;
  status: SiteStatus;
  responseMs: number | null;
  availability: number;
  availabilityNote: string;
  lastCheck: string;
  httpLabel: string;
  extraLabel: string;
  spark: number[];
  icon: 'globe' | 'campus' | 'api' | 'shop' | 'doc' | 'users';
}

const INITIAL_SITES: DemoSite[] = [
  {
    id: 'portfolio',
    name: 'Portfolio Développeur',
    url: 'https://julien-dev.fr',
    status: 'online',
    responseMs: 42,
    availability: 100,
    availabilityNote: '0 coupure',
    lastCheck: 'Il y a 6s',
    httpLabel: 'HTTP 200',
    extraLabel: 'TLS 1.3',
    spark: [0.35, 0.42, 0.38, 0.5, 0.46, 0.62, 0.7],
    icon: 'globe',
  },
  {
    id: 'portail-universite',
    name: 'Portail Université',
    url: 'https://cas.univ-digital.edu',
    status: 'online',
    responseMs: 114,
    availability: 99.94,
    availabilityNote: '1 incident',
    lastCheck: 'Il y a 12s',
    httpLabel: 'HTTP 200',
    extraLabel: 'TLS 1.3',
    spark: [0.4, 0.55, 0.48, 0.6, 0.52, 0.58, 0.64],
    icon: 'campus',
  },
  {
    id: 'api-publique',
    name: 'API Publique v1',
    url: 'https://api.systemhub.io/v1/health',
    status: 'online',
    responseMs: 68,
    availability: 99.98,
    availabilityNote: '0 coupure',
    lastCheck: 'Il y a 4s',
    httpLabel: 'HTTP 204',
    extraLabel: 'TLS 1.3',
    spark: [0.45, 0.4, 0.5, 0.47, 0.55, 0.6, 0.58],
    icon: 'api',
  },
  {
    id: 'boutique-mobile',
    name: 'Boutique Mobile',
    url: 'https://checkout.mobistore.app',
    status: 'offline',
    responseMs: null,
    availability: 98.15,
    availabilityNote: 'En alerte',
    lastCheck: 'Il y a 2s',
    httpLabel: 'HTTP 504',
    extraLabel: 'Timeout (504)',
    spark: [0.3, 0.34, 0.4, 0.55, 0.7, 0.82, 0.9],
    icon: 'shop',
  },
  {
    id: 'blog-tech',
    name: 'Blog Tech & Cloud',
    url: 'https://bytes.techpulse.io',
    status: 'online',
    responseMs: 51,
    availability: 99.99,
    availabilityNote: '0 coupure',
    lastCheck: 'Il y a 18s',
    httpLabel: 'HTTP 200',
    extraLabel: 'Edge Cache',
    spark: [0.5, 0.46, 0.42, 0.48, 0.4, 0.44, 0.38],
    icon: 'doc',
  },
  {
    id: 'club-etudiant',
    name: 'Club Étudiant Informatique',
    url: 'https://assos.campus-hub.net',
    status: 'online',
    responseMs: 92,
    availability: 99.88,
    availabilityNote: '0 coupure',
    lastCheck: 'Il y a 10s',
    httpLabel: 'HTTP 200',
    extraLabel: 'Direct',
    spark: [0.55, 0.6, 0.5, 0.58, 0.62, 0.54, 0.66],
    icon: 'users',
  },
];

@Injectable({ providedIn: 'root' })
export class DemoStore {
  readonly sites = signal<DemoSite[]>(INITIAL_SITES.map(site => ({ ...site, spark: [...site.spark] })));

  readonly onlineCount = computed(() => this.sites().filter(site => site.status === 'online').length);
  readonly offlineCount = computed(() => this.sites().filter(site => site.status === 'offline').length);

  siteById(id: string): DemoSite | undefined {
    return this.sites().find(site => site.id === id);
  }

  addSite(input: { name: string; url: string }): DemoSite {
    const site: DemoSite = {
      id: slugify(input.name),
      name: input.name.trim(),
      url: input.url.trim(),
      status: 'online',
      responseMs: 80,
      availability: 100,
      availabilityNote: '0 coupure',
      lastCheck: 'À l\'instant',
      httpLabel: 'HTTP 200',
      extraLabel: 'TLS 1.3',
      spark: [0.4, 0.45, 0.42, 0.5, 0.48, 0.46, 0.44],
      icon: 'globe',
    };
    this.sites.update(list => [...list, site]);
    return site;
  }

  removeSite(id: string): void {
    this.sites.update(list => list.filter(site => site.id !== id));
  }

  togglePause(id: string): void {
    this.sites.update(list => list.map(site => {
      if (site.id !== id || site.status === 'offline') return site;
      return { ...site, status: site.status === 'paused' ? 'online' : 'paused' };
    }));
  }
}

function slugify(value: string): string {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'site';
  return `${base}-${Date.now().toString(36)}`;
}
