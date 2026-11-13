import { HttpRequest } from '@angular/common/http';
import { Site, CheckResult, LatencyPoint } from '../models/site.model';
import { Incident, IncidentDetail, DailyIncidentStats } from '../models/incident.model';
import { DashboardSummary, LatencySeries, RecentEvent, DiagnosticResult } from '../models/dashboard.model';

export interface MockHandler {
  method: string;
  pattern: string;
  respond: (params: Record<string, string>, req: HttpRequest<unknown>) => unknown;
}

/* ══════════════════════════════════════════════════════
   SEED DATA
══════════════════════════════════════════════════════ */

const SITES: Site[] = [
  {
    id: 'site-1', name: 'Portfolio personnel', url: 'https://mon-portfolio.dev',
    status: 'online', responseTimeMs: 98, availability30d: 99.98, lastCheckedAt: ago(2),
    checkIntervalSeconds: 60, isEnabled: true, region: 'EU-West',
  },
  {
    id: 'site-2', name: 'API projet Sup\'Com', url: 'https://api.supcom-project.io',
    status: 'offline', responseTimeMs: 0, availability30d: 94.3, lastCheckedAt: ago(1),
    checkIntervalSeconds: 60, isEnabled: true, region: 'EU-West',
  },
  {
    id: 'site-3', name: 'Blog technique', url: 'https://blog.example.com',
    status: 'online', responseTimeMs: 210, availability30d: 99.5, lastCheckedAt: ago(2),
    checkIntervalSeconds: 300, isEnabled: true, region: 'EU-West',
  },
  {
    id: 'site-4', name: 'Dashboard interne', url: 'https://internal.dashboard.io',
    status: 'paused', responseTimeMs: 0, availability30d: 100, lastCheckedAt: ago(120),
    checkIntervalSeconds: 60, isEnabled: false, region: 'EU-West',
  },
  {
    id: 'site-5', name: 'E-commerce test', url: 'https://shop.test-domain.tn',
    status: 'online', responseTimeMs: 340, availability30d: 97.8, lastCheckedAt: ago(3),
    checkIntervalSeconds: 60, isEnabled: true, region: 'EU-South',
  },
  {
    id: 'site-6', name: 'Webhook service', url: 'https://hooks.integration.io',
    status: 'online', responseTimeMs: 55, availability30d: 99.9, lastCheckedAt: ago(1),
    checkIntervalSeconds: 60, isEnabled: true, region: 'EU-West',
  },
];

const INCIDENTS: IncidentDetail[] = [
  {
    id: 'inc-1', siteId: 'site-2', siteName: 'API projet Sup\'Com',
    siteUrl: 'https://api.supcom-project.io',
    type: 'unavailable', severity: 'critical', status: 'ongoing',
    errorCode: 'HTTP_503', region: 'EU-West',
    startedAt: ago(45), lastSeenAt: ago(1), endedAt: null, durationMinutes: null,
    summary: 'Le serveur retourne HTTP 503 depuis 45 minutes. Trois sondes ont confirmé l\'indisponibilité.',
    evidence: [
      { id: 'ev-1', eventTime: ago(47), evidenceType: 'check_failure',
        summary: 'Vérification HTTP échouée — statut 503', httpStatus: 503, responseTimeMs: 2100, probe: 'EU-West-1' },
      { id: 'ev-2', eventTime: ago(46), evidenceType: 'check_failure',
        summary: 'Vérification HTTP échouée — statut 503', httpStatus: 503, responseTimeMs: 2300, probe: 'EU-West-1' },
      { id: 'ev-3', eventTime: ago(45), evidenceType: 'incident_opened',
        summary: 'Incident ouvert après 3 échecs consécutifs', httpStatus: null, responseTimeMs: null, probe: 'EU-West-1' },
      { id: 'ev-4', eventTime: ago(44), evidenceType: 'confirmation',
        summary: 'Sonde de confirmation EU-South confirme l\'indisponibilité', httpStatus: 503, responseTimeMs: null, probe: 'EU-South-1' },
      { id: 'ev-5', eventTime: ago(1), evidenceType: 'check_failure',
        summary: 'Dernière vérification — toujours hors ligne', httpStatus: 503, responseTimeMs: 1900, probe: 'EU-West-1' },
    ],
  },
  {
    id: 'inc-2', siteId: 'site-5', siteName: 'E-commerce test',
    siteUrl: 'https://shop.test-domain.tn',
    type: 'slow_response', severity: 'warning', status: 'resolved',
    errorCode: 'SLOW_RESPONSE', region: 'EU-South',
    startedAt: ago(1440), lastSeenAt: ago(1380), endedAt: ago(1380), durationMinutes: 60,
    summary: 'Temps de réponse moyen supérieur à 2 000 ms pendant 1 heure. Résolu après redémarrage du serveur.',
    evidence: [
      { id: 'ev-6', eventTime: ago(1442), evidenceType: 'check_failure',
        summary: 'Temps de réponse 2 350 ms — seuil dépassé', httpStatus: 200, responseTimeMs: 2350, probe: 'EU-South-1' },
      { id: 'ev-7', eventTime: ago(1441), evidenceType: 'incident_opened',
        summary: 'Incident lenteur ouvert', httpStatus: null, responseTimeMs: null, probe: 'EU-South-1' },
      { id: 'ev-8', eventTime: ago(1380), evidenceType: 'check_recovery',
        summary: 'Temps de réponse revenu à 340 ms', httpStatus: 200, responseTimeMs: 340, probe: 'EU-South-1' },
      { id: 'ev-9', eventTime: ago(1380), evidenceType: 'incident_closed',
        summary: 'Incident fermé automatiquement à la reprise', httpStatus: null, responseTimeMs: null, probe: 'EU-South-1' },
    ],
  },
  {
    id: 'inc-3', siteId: 'site-3', siteName: 'Blog technique',
    siteUrl: 'https://blog.example.com',
    type: 'unavailable', severity: 'critical', status: 'resolved',
    errorCode: 'HTTP_502', region: 'EU-West',
    startedAt: ago(4320), lastSeenAt: ago(4260), endedAt: ago(4260), durationMinutes: 60,
    summary: 'Passerelle inversée retourne HTTP 502 pendant 1 heure.',
    evidence: [
      { id: 'ev-10', eventTime: ago(4322), evidenceType: 'check_failure',
        summary: 'HTTP 502 Bad Gateway', httpStatus: 502, responseTimeMs: null, probe: 'EU-West-1' },
      { id: 'ev-11', eventTime: ago(4320), evidenceType: 'incident_opened',
        summary: 'Incident ouvert', httpStatus: null, responseTimeMs: null, probe: 'EU-West-1' },
      { id: 'ev-12', eventTime: ago(4260), evidenceType: 'incident_closed',
        summary: 'Service rétabli', httpStatus: 200, responseTimeMs: 220, probe: 'EU-West-1' },
    ],
  },
];

const CHECKS: Record<string, CheckResult[]> = {
  'site-1': genChecks('site-1', 'online'),
  'site-2': genChecks('site-2', 'offline'),
  'site-3': genChecks('site-3', 'online'),
  'site-4': [],
  'site-5': genChecks('site-5', 'online'),
  'site-6': genChecks('site-6', 'online'),
};

const EVENTS: RecentEvent[] = [
  { id: 'e1', timestamp: ago(1), type: 'incident_opened',
    message: 'Incident ouvert — API projet Sup\'Com retourne HTTP 503', siteName: 'API projet Sup\'Com', severity: 'critical' },
  { id: 'e2', timestamp: ago(5), type: 'check_fail',
    message: 'Échec de vérification — API projet Sup\'Com', siteName: 'API projet Sup\'Com', severity: 'warning' },
  { id: 'e3', timestamp: ago(30), type: 'check_ok',
    message: 'Vérification réussie — Portfolio personnel (98 ms)', siteName: 'Portfolio personnel', severity: 'success' },
  { id: 'e4', timestamp: ago(60), type: 'check_ok',
    message: 'Vérification réussie — Webhook service (55 ms)', siteName: 'Webhook service', severity: 'success' },
  { id: 'e5', timestamp: ago(1440), type: 'incident_closed',
    message: 'Incident résolu — E-commerce test (durée : 1 h)', siteName: 'E-commerce test', severity: 'info' },
  { id: 'e6', timestamp: ago(2880), type: 'site_added',
    message: 'Nouveau site ajouté — Blog technique', siteName: 'Blog technique', severity: 'info' },
];

/* ══════════════════════════════════════════════════════
   HANDLERS
══════════════════════════════════════════════════════ */

export const MOCK_HANDLERS: MockHandler[] = [

  /* ── Dashboard ── */
  {
    method: 'GET', pattern: '/api/dashboard/summary',
    respond: (): DashboardSummary => ({
      globalAvailability: 97.4,
      avgResponseTimeMs: 185,
      monitoredSitesCount: SITES.length,
      openIncidentsCount: INCIDENTS.filter(i => i.status === 'ongoing').length,
      hasActiveIncident: true,
      activeIncidentSiteName: 'API projet Sup\'Com',
      activeIncidentId: 'inc-1',
    }),
  },

  {
    method: 'GET', pattern: '/api/dashboard/latency',
    respond: (_, req): LatencySeries => {
      const range = (new URL(req.url, 'http://x').searchParams.get('range') ?? '24h') as '1h' | '24h' | '7d';
      return { range, points: genLatencySeries(range), thresholdMs: 2000 };
    },
  },

  {
    method: 'GET', pattern: '/api/dashboard/events',
    respond: (): RecentEvent[] => EVENTS,
  },

  {
    method: 'GET', pattern: '/api/dashboard/export.csv',
    respond: (): string => buildCsv(),
  },

  /* ── Sites ── */
  {
    method: 'GET', pattern: '/api/sites',
    respond: (_, req): Site[] => {
      const url = new URL(req.url, 'http://x');
      const status = url.searchParams.get('status');
      const q      = (url.searchParams.get('q') ?? '').toLowerCase();
      return SITES
        .filter(s => !status || status === 'all' || s.status === status)
        .filter(s => !q || s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
    },
  },

  {
    method: 'POST', pattern: '/api/sites',
    respond: (_, req): Site => {
      const body = req.body as { name: string; url: string; checkIntervalSeconds: number };
      const site: Site = {
        id: 'site-' + Date.now(),
        name: body.name, url: body.url,
        status: 'unknown', responseTimeMs: 0, availability30d: 100,
        lastCheckedAt: new Date().toISOString(),
        checkIntervalSeconds: body.checkIntervalSeconds ?? 60,
        isEnabled: true, region: 'EU-West',
      };
      SITES.push(site);
      return site;
    },
  },

  {
    method: 'GET', pattern: '/api/sites/:id',
    respond: (p): Site | { error: string } => {
      const site = SITES.find(s => s.id === p['id']);
      return site ?? { error: 'Site introuvable' };
    },
  },

  {
    method: 'PATCH', pattern: '/api/sites/:id',
    respond: (p, req): Site | { error: string } => {
      const idx = SITES.findIndex(s => s.id === p['id']);
      if (idx === -1) return { error: 'Site introuvable' };
      const patch = req.body as Partial<Site>;
      SITES[idx] = { ...SITES[idx], ...patch };
      return SITES[idx];
    },
  },

  {
    method: 'DELETE', pattern: '/api/sites/:id',
    respond: (p): { success: boolean } => {
      const idx = SITES.findIndex(s => s.id === p['id']);
      if (idx !== -1) SITES.splice(idx, 1);
      return { success: true };
    },
  },

  {
    method: 'POST', pattern: '/api/sites/:id/checks/run',
    respond: (p): CheckResult => ({
      id: 'chk-' + Date.now(), siteId: p['id'],
      checkedAt: new Date().toISOString(), success: true,
      httpStatus: 200, responseTimeMs: 112 + Math.round(Math.random() * 80),
      probe: 'EU-West-1', result: 'ok', tlsExpiry: futureIso(90),
    }),
  },

  {
    method: 'GET', pattern: '/api/sites/:id/checks',
    respond: (p): CheckResult[] => CHECKS[p['id']] ?? [],
  },

  {
    method: 'GET', pattern: '/api/sites/:id/latency',
    respond: (_, req): LatencySeries => {
      const range = (new URL(req.url, 'http://x').searchParams.get('range') ?? '24h') as '1h' | '24h' | '7d';
      return { range, points: genLatencySeries(range), thresholdMs: 2000 };
    },
  },

  /* ── Incidents ── */
  {
    method: 'GET', pattern: '/api/incidents',
    respond: (_, req): Incident[] => {
      const url    = new URL(req.url, 'http://x');
      const status = url.searchParams.get('status') ?? 'all';
      const q      = (url.searchParams.get('q') ?? '').toLowerCase();
      return INCIDENTS
        .filter(i => status === 'all' || i.status === status)
        .filter(i => !q || i.siteName.toLowerCase().includes(q) || i.errorCode.toLowerCase().includes(q))
        .map(({ evidence: _, ...rest }) => rest as Incident);
    },
  },

  {
    method: 'GET', pattern: '/api/incidents/stats',
    respond: (): DailyIncidentStats => ({
      count: INCIDENTS.filter(i => i.status === 'ongoing').length + 1,
      avgResolutionMinutes: 60,
      availability24h: 97.4,
    }),
  },

  {
    method: 'GET', pattern: '/api/incidents/:id',
    respond: (p): IncidentDetail | { error: string } => {
      const inc = INCIDENTS.find(i => i.id === p['id']);
      return inc ?? { error: 'Incident introuvable' };
    },
  },

  /* ── Diagnostics ── */
  {
    method: 'GET', pattern: '/api/diagnostics/sites/:id/latest',
    respond: (p): DiagnosticResult => {
      const site = SITES.find(s => s.id === p['id']);
      return {
        siteId:  p['id'],
        siteName: site?.name ?? 'Inconnu',
        siteUrl:  site?.url  ?? '',
        ranAt: ago(5),
        dnsResolved: site?.status !== 'offline',
        dnsLatencyMs: site?.status !== 'offline' ? 12 : null,
        httpStatus:   site?.status === 'offline' ? 503 : 200,
        httpResponseTimeMs: site?.status === 'offline' ? null : site?.responseTimeMs ?? null,
        tlsValid: site?.status !== 'offline',
        tlsExpiry: site?.status !== 'offline' ? futureIso(85) : null,
        probe: 'EU-West-1',
        errorCategory: site?.status === 'offline' ? 'HTTP_503' : null,
        summary: site?.status === 'offline'
          ? 'Le contrôle a observé HTTP 503. DNS résolu ; le certificat TLS n’a pas été vérifié. Ces résultats décrivent les symptômes et ne suffisent pas à établir la cause.'
          : 'Toutes les vérifications ont réussi. DNS résolu, connexion HTTPS établie, certificat TLS valide.',
      };
    },
  },

  {
    method: 'POST', pattern: '/api/diagnostics/sites/:id/run',
    respond: (p): DiagnosticResult => {
      const site = SITES.find(s => s.id === p['id']);
      return {
        siteId: p['id'],
        siteName: site?.name ?? 'Inconnu',
        siteUrl:  site?.url  ?? '',
        ranAt: new Date().toISOString(),
        dnsResolved: true, dnsLatencyMs: 14,
        httpStatus: 200, httpResponseTimeMs: 118,
        tlsValid: true, tlsExpiry: futureIso(85),
        probe: 'EU-West-1',
        errorCategory: null,
        summary: 'Diagnostic immédiat réussi. Aucune anomalie détectée.',
      };
    },
  },
];

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */

/** Returns an ISO timestamp X minutes in the past */
function ago(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

/** Returns an ISO timestamp X days in the future */
function futureIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function genChecks(siteId: string, mode: 'online' | 'offline'): CheckResult[] {
  return Array.from({ length: 15 }, (_, i) => {
    const fail = mode === 'offline' || (mode === 'online' && i < 2 && i === 0);
    return {
      id: `chk-${siteId}-${i}`,
      siteId,
      checkedAt: ago(i * 5),
      success: !fail,
      httpStatus: fail ? 503 : 200,
      responseTimeMs: fail ? null : 80 + Math.round(Math.random() * 300),
      probe: 'EU-West-1',
      result: fail ? 'http_error' as const : 'ok' as const,
      tlsExpiry: fail ? null : futureIso(85),
    };
  });
}

function genLatencySeries(range: '1h' | '24h' | '7d'): LatencyPoint[] {
  const pointCount = range === '1h' ? 60 : range === '24h' ? 48 : 84;
  const intervalMs = range === '1h' ? 60_000 : range === '24h' ? 1_800_000 : 7_200_000;
  const now = Date.now();
  return Array.from({ length: pointCount }, (_, i) => ({
    timestamp: new Date(now - (pointCount - i) * intervalMs).toISOString(),
    valueMs: Math.max(50, Math.round(
      150 + Math.sin(i / 6) * 60 + Math.random() * 80 +
      (i > pointCount * 0.6 && i < pointCount * 0.65 ? 1800 : 0), // simulate spike
    )),
  }));
}

function buildCsv(): string {
  const header = 'site,status,responseTimeMs,availability30d,lastCheckedAt';
  const rows   = SITES.map(
    s => `"${s.name}",${s.status},${s.responseTimeMs},${s.availability30d}%,${s.lastCheckedAt}`,
  );
  return [header, ...rows].join('\n');
}
