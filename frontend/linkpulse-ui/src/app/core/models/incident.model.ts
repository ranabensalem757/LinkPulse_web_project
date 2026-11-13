export type IncidentStatus   = 'ongoing' | 'resolved';
export type IncidentSeverity = 'critical' | 'warning' | 'info';

export interface Incident {
  id: string;
  siteId: string;
  siteName: string;
  siteUrl: string;
  type: 'unavailable' | 'slow_response' | 'tls_error' | 'dns_error';
  severity: IncidentSeverity;
  status: IncidentStatus;
  errorCode: string;
  region: string;
  startedAt: string;      // ISO
  lastSeenAt: string;     // ISO
  endedAt: string | null; // ISO or null
  durationMinutes: number | null;
  summary: string;
}

export interface IncidentEvidenceEvent {
  id: string;
  eventTime: string;      // ISO
  evidenceType: 'check_failure' | 'check_recovery' | 'incident_opened' | 'incident_closed' | 'confirmation';
  summary: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  probe: string;
}

export interface IncidentDetail extends Incident {
  evidence: IncidentEvidenceEvent[];
}

export interface DailyIncidentStats {
  count: number;
  avgResolutionMinutes: number;
  availability24h: number;  // percentage
}
