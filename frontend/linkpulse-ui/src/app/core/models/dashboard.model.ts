import { LatencyPoint } from './site.model';

export interface DashboardSummary {
  globalAvailability: number;    // percentage
  avgResponseTimeMs: number;
  monitoredSitesCount: number;
  openIncidentsCount: number;
  hasActiveIncident: boolean;
  activeIncidentSiteName: string | null;
  activeIncidentId: string | null;
}

export interface LatencySeries {
  range: '1h' | '24h' | '7d';
  points: LatencyPoint[];
  thresholdMs: number;
}

export interface RecentEvent {
  id: string;
  timestamp: string;   // ISO
  type: 'incident_opened' | 'incident_closed' | 'check_ok' | 'check_fail' | 'site_added' | 'site_paused';
  message: string;
  siteName: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
}

export interface DiagnosticResult {
  siteId: string;
  siteName: string;
  siteUrl: string;
  ranAt: string;         // ISO
  dnsResolved: boolean;
  dnsLatencyMs: number | null;
  httpStatus: number | null;
  httpResponseTimeMs: number | null;
  tlsValid: boolean | null;
  tlsExpiry: string | null;
  probe: string;
  errorCategory: string | null;
  summary: string;
}
