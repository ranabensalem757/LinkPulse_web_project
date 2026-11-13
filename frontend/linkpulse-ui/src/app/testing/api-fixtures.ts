/**
 * Test-only fixtures. Never imported by application code.
 * These objects exist solely to exercise UI states and do not represent real data.
 */
import { DashboardSummary, DiagnosticResult } from '../core/models/dashboard.model';
import { DailyIncidentStats, Incident, IncidentDetail } from '../core/models/incident.model';
import { CheckResult, LatencyPoint, LatencySeries, Site } from '../core/models/site.model';

const ISO = '2026-01-01T00:00:00.000Z';

export function makeSite(overrides: Partial<Site> = {}): Site {
  return {
    id: 'test-site',
    name: 'Site de test',
    url: 'https://test.example',
    status: 'online',
    responseTimeMs: 100,
    availability30d: 99.9,
    lastCheckedAt: ISO,
    checkIntervalSeconds: 60,
    isEnabled: true,
    region: 'EU-West',
    ...overrides,
  };
}

export function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'check-1',
    siteId: 'test-site',
    checkedAt: ISO,
    success: true,
    httpStatus: 200,
    responseTimeMs: 100,
    probe: 'probe-eu-west',
    result: 'ok',
    tlsExpiry: '2026-12-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeLatency(points: LatencyPoint[] = []): LatencySeries {
  return { range: '24h', points, thresholdMs: 300 };
}

export function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'test-incident',
    siteId: 'test-site',
    siteName: 'Site de test',
    siteUrl: 'https://test.example',
    type: 'unavailable',
    severity: 'critical',
    status: 'ongoing',
    errorCode: 'HTTP_500',
    region: 'EU-West',
    startedAt: ISO,
    lastSeenAt: ISO,
    endedAt: null,
    durationMinutes: null,
    summary: 'Test incident',
    ...overrides,
  };
}

export function makeIncidentDetail(overrides: Partial<IncidentDetail> = {}): IncidentDetail {
  return {
    ...makeIncident(),
    evidence: [
      {
        id: 'evidence-1',
        eventTime: ISO,
        evidenceType: 'check_failure',
        summary: 'Test evidence',
        httpStatus: 500,
        responseTimeMs: null,
        probe: 'probe-eu-west',
      },
    ],
    ...overrides,
  };
}

export function emptyStats(): DailyIncidentStats {
  return { count: 0, avgResolutionMinutes: 0, availability24h: 0 };
}

export function makeDiagnosticResult(overrides: Partial<DiagnosticResult> = {}): DiagnosticResult {
  return {
    siteId: 'test-site',
    siteName: 'Site de test',
    siteUrl: 'https://test.example',
    ranAt: ISO,
    dnsResolved: true,
    dnsLatencyMs: 12,
    httpStatus: 200,
    httpResponseTimeMs: 100,
    tlsValid: true,
    tlsExpiry: '2026-12-01T00:00:00.000Z',
    probe: 'probe-eu-west',
    errorCategory: null,
    summary: 'Diagnostic nominal',
    ...overrides,
  };
}

export function emptySummary(): DashboardSummary {
  return {
    globalAvailability: 0,
    avgResponseTimeMs: 0,
    monitoredSitesCount: 0,
    openIncidentsCount: 0,
    hasActiveIncident: false,
    activeIncidentSiteName: null,
    activeIncidentId: null,
  };
}