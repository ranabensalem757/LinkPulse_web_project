import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { DashboardSummary, LatencySeries, RecentEvent } from '../core/models/dashboard.model';
import { Incident, IncidentDetail, DailyIncidentStats } from '../core/models/incident.model';
import { AddSitePayload, CheckResult, Site } from '../core/models/site.model';

const demoNow = Date.now();
const minutesAgo = (minutes: number): string => new Date(demoNow - minutes * 60_000).toISOString();
const hoursAgo = (hours: number): string => new Date(demoNow - hours * 3_600_000).toISOString();

export const DEMO_SITES: Site[] = [
  {
    id: 'edge-api',
    name: 'Edge API',
    url: 'https://api.northstar.example',
    status: 'online',
    responseTimeMs: 142,
    availability30d: 99.98,
    lastCheckedAt: minutesAgo(1),
    checkIntervalSeconds: 60,
    isEnabled: true,
    region: 'eu-west-1',
  },
  {
    id: 'checkout-web',
    name: 'Checkout Web',
    url: 'https://checkout.northstar.example',
    status: 'offline',
    responseTimeMs: 0,
    availability30d: 99.72,
    lastCheckedAt: minutesAgo(3),
    checkIntervalSeconds: 60,
    isEnabled: true,
    region: 'eu-central-1',
  },
  {
    id: 'status-page',
    name: 'Status Page',
    url: 'https://status.northstar.example',
    status: 'online',
    responseTimeMs: 218,
    availability30d: 99.95,
    lastCheckedAt: minutesAgo(2),
    checkIntervalSeconds: 120,
    isEnabled: true,
    region: 'us-east-1',
  },
  {
    id: 'event-stream',
    name: 'Event Stream',
    url: 'https://events.northstar.example',
    status: 'paused',
    responseTimeMs: 96,
    availability30d: 99.84,
    lastCheckedAt: minutesAgo(48),
    checkIntervalSeconds: 300,
    isEnabled: false,
    region: 'eu-west-1',
  },
];

const DEMO_LATENCY_VALUES = [146, 151, 148, 157, 162, 155, 171, 168, 179, 166, 188, 193, 184, 176, 412, 142];

function latencySeries(range: LatencySeries['range']): LatencySeries {
  const spanMinutes = range === '1h' ? 60 : range === '7d' ? 7 * 24 * 60 : 24 * 60;
  return {
    range,
    thresholdMs: 300,
    points: DEMO_LATENCY_VALUES.map((valueMs, index) => ({
      timestamp: new Date(
        demoNow - spanMinutes * 60_000 * (DEMO_LATENCY_VALUES.length - index - 1) / (DEMO_LATENCY_VALUES.length - 1),
      ).toISOString(),
      valueMs,
    })),
  };
}

const DEMO_SUMMARY: DashboardSummary = {
  globalAvailability: 99.91,
  avgResponseTimeMs: 184,
  monitoredSitesCount: 3,
  openIncidentsCount: 1,
  hasActiveIncident: true,
  activeIncidentSiteName: 'Checkout Web',
  activeIncidentId: 'INC-2026-0412',
};

const DEMO_EVENTS: RecentEvent[] = [
  {
    id: 'evt-0412',
    timestamp: minutesAgo(4),
    type: 'incident_opened',
    message: 'Échecs HTTP 503 confirmés sur Checkout Web.',
    siteName: 'Checkout Web',
    severity: 'critical',
  },
  {
    id: 'evt-0411',
    timestamp: minutesAgo(7),
    type: 'check_ok',
    message: 'Réponse nominale depuis la sonde européenne.',
    siteName: 'Edge API',
    severity: 'success',
  },
  {
    id: 'evt-0410',
    timestamp: minutesAgo(18),
    type: 'check_fail',
    message: 'Trois contrôles consécutifs ont dépassé le seuil.',
    siteName: 'Checkout Web',
    severity: 'warning',
  },
  {
    id: 'evt-0409',
    timestamp: hoursAgo(2),
    type: 'incident_closed',
    message: 'Latence revenue sous le seuil nominal.',
    siteName: 'Status Page',
    severity: 'info',
  },
];

export const DEMO_INCIDENTS: Incident[] = [
  {
    id: 'INC-2026-0412',
    siteId: 'checkout-web',
    siteName: 'Checkout Web',
    siteUrl: 'https://checkout.northstar.example',
    type: 'unavailable',
    severity: 'critical',
    status: 'ongoing',
    errorCode: 'HTTP_503',
    region: 'eu-central-1',
    startedAt: minutesAgo(27),
    lastSeenAt: minutesAgo(3),
    endedAt: null,
    durationMinutes: null,
    summary: 'Le point de terminaison de paiement renvoie des erreurs de disponibilité.',
  },
  {
    id: 'INC-2026-0408',
    siteId: 'status-page',
    siteName: 'Status Page',
    siteUrl: 'https://status.northstar.example',
    type: 'slow_response',
    severity: 'warning',
    status: 'resolved',
    errorCode: 'RESPONSE_TIME_HIGH',
    region: 'us-east-1',
    startedAt: hoursAgo(6),
    lastSeenAt: hoursAgo(5.75),
    endedAt: hoursAgo(5.75),
    durationMinutes: 15,
    summary: 'Une hausse temporaire de latence a été détectée puis résolue.',
  },
];

const DEMO_INCIDENT_DETAILS: IncidentDetail[] = DEMO_INCIDENTS.map((incident, index) => ({
  ...incident,
  evidence: index === 0
    ? [
      {
        id: 'proof-0412-1',
        eventTime: minutesAgo(27),
        evidenceType: 'check_failure',
        summary: 'La sonde a reçu une réponse HTTP 503.',
        httpStatus: 503,
        responseTimeMs: 386,
        probe: 'Frankfurt · EU',
      },
      {
        id: 'proof-0412-2',
        eventTime: minutesAgo(26),
        evidenceType: 'confirmation',
        summary: 'Un second contrôle confirme l’indisponibilité.',
        httpStatus: 503,
        responseTimeMs: 401,
        probe: 'Amsterdam · EU',
      },
      {
        id: 'proof-0412-3',
        eventTime: minutesAgo(25),
        evidenceType: 'incident_opened',
        summary: 'Incident ouvert après confirmation multi-sonde.',
        httpStatus: null,
        responseTimeMs: null,
        probe: 'LinkPulse · Correlation',
      },
    ]
    : [
      {
        id: 'proof-0408-1',
        eventTime: hoursAgo(6),
        evidenceType: 'check_failure',
        summary: 'Le temps de réponse a dépassé le seuil de 300 ms.',
        httpStatus: 200,
        responseTimeMs: 428,
        probe: 'Virginia · US',
      },
      {
        id: 'proof-0408-2',
        eventTime: hoursAgo(5.75),
        evidenceType: 'check_recovery',
        summary: 'Les contrôles suivants sont revenus sous le seuil.',
        httpStatus: 200,
        responseTimeMs: 218,
        probe: 'Virginia · US',
      },
      {
        id: 'proof-0408-3',
        eventTime: hoursAgo(5.75),
        evidenceType: 'incident_closed',
        summary: 'Incident clôturé après reprise confirmée.',
        httpStatus: null,
        responseTimeMs: null,
        probe: 'LinkPulse · Correlation',
      },
    ],
}));

const DEMO_CHECKS: Record<string, CheckResult[]> = {
  'edge-api': [1, 2, 3, 4].map((item, index) => ({
    id: `check-edge-${item}`,
    siteId: 'edge-api',
    checkedAt: minutesAgo(index * 5 + 1),
    success: true,
    httpStatus: 200,
    responseTimeMs: 136 + index * 4,
    probe: index % 2 ? 'Amsterdam · EU' : 'Frankfurt · EU',
    result: 'ok',
    tlsExpiry: new Date(demoNow + 60 * 86_400_000).toISOString(),
  })),
  'checkout-web': [
    {
      id: 'check-checkout-1',
      siteId: 'checkout-web',
      checkedAt: minutesAgo(3),
      success: false,
      httpStatus: 503,
      responseTimeMs: 386,
      probe: 'Frankfurt · EU',
      result: 'http_error',
      tlsExpiry: new Date(demoNow + 42 * 86_400_000).toISOString(),
    },
    {
      id: 'check-checkout-2',
      siteId: 'checkout-web',
      checkedAt: minutesAgo(8),
      success: false,
      httpStatus: 503,
      responseTimeMs: 401,
      probe: 'Amsterdam · EU',
      result: 'http_error',
      tlsExpiry: new Date(demoNow + 42 * 86_400_000).toISOString(),
    },
  ],
  'status-page': [1, 2, 3].map((item, index) => ({
    id: `check-status-${item}`,
    siteId: 'status-page',
    checkedAt: minutesAgo(index * 8 + 2),
    success: true,
    httpStatus: 200,
    responseTimeMs: 210 + index * 8,
    probe: 'Virginia · US',
    result: 'ok',
    tlsExpiry: new Date(demoNow + 84 * 86_400_000).toISOString(),
  })),
};

@Injectable()
export class DemoDashboardService {
  getSummary(): Observable<DashboardSummary> {
    return of({ ...DEMO_SUMMARY });
  }

  getLatency(range: LatencySeries['range']): Observable<LatencySeries> {
    return of(latencySeries(range));
  }

  getEvents(): Observable<RecentEvent[]> {
    return of(DEMO_EVENTS.map(event => ({ ...event })));
  }

  exportCsv(): Observable<string> {
    const quote = (value: string): string => `"${value.replace(/"/g, '""')}"`;
    const rows = DEMO_EVENTS.map(event =>
      [event.id, event.timestamp, event.type, event.siteName, event.severity]
        .map(quote)
        .join(','),
    );
    return of(['id,timestamp,type,siteName,severity', ...rows].join('\n'));
  }
}

@Injectable()
export class DemoSitesService {
  getSites(status?: string, query?: string): Observable<Site[]> {
    const needle = query?.trim().toLowerCase() ?? '';
    const sites = DEMO_SITES.filter(site =>
      (!status || status === 'all' || site.status === status)
      && (!needle || `${site.name} ${site.url}`.toLowerCase().includes(needle)),
    );
    return of(sites.map(site => ({ ...site })));
  }

  getSite(id: string): Observable<Site> {
    const site = DEMO_SITES.find(item => item.id === id);
    return site
      ? of({ ...site })
      : throwError(() => new Error('Demo site not found.'));
  }

  addSite(_payload: AddSitePayload): Observable<Site> {
    return this.unavailable();
  }

  updateSite(_id: string, _patch: Partial<Site>): Observable<Site> {
    return this.unavailable();
  }

  pauseSite(_id: string, _pause: boolean): Observable<Site> {
    return this.unavailable();
  }

  deleteSite(_id: string): Observable<{ success: boolean }> {
    return this.unavailable();
  }

  runCheck(_id: string): Observable<CheckResult> {
    return this.unavailable();
  }

  getChecks(id: string): Observable<CheckResult[]> {
    return of((DEMO_CHECKS[id] ?? []).map(check => ({ ...check })));
  }

  getLatency(_id: string, range: LatencySeries['range']): Observable<LatencySeries> {
    return of(latencySeries(range));
  }

  private unavailable<T>(): Observable<T> {
    return throwError(() => new Error('This operation is unavailable in demo mode.'));
  }
}

@Injectable()
export class DemoIncidentsService {
  getStats(): Observable<DailyIncidentStats> {
    return of({ count: 2, avgResolutionMinutes: 15, availability24h: 99.91 });
  }

  getIncidents(status?: string, query?: string): Observable<Incident[]> {
    const needle = query?.trim().toLowerCase() ?? '';
    return of(DEMO_INCIDENTS
      .filter(incident =>
        (!status || status === 'all' || incident.status === status)
        && (!needle || `${incident.siteName} ${incident.id} ${incident.errorCode} ${incident.region}`
          .toLowerCase()
          .includes(needle)),
      )
      .map(incident => ({ ...incident })),
    );
  }

  getIncident(id: string): Observable<IncidentDetail> {
    const incident = DEMO_INCIDENT_DETAILS.find(item => item.id === id);
    return incident
      ? of({ ...incident, evidence: incident.evidence.map(event => ({ ...event })) })
      : throwError(() => new Error('Demo incident not found.'));
  }
}
