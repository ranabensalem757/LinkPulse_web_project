import { StatusType } from '../../shared/status-badge/status-badge';

export interface Site {
  id: string;
  name: string;
  url: string;
  status: StatusType;
  responseTimeMs: number;
  availability30d: number;    // percentage 0-100
  lastCheckedAt: string;      // ISO
  checkIntervalSeconds: number;
  isEnabled: boolean;
  region: string;
}

export interface LatencyPoint {
  timestamp: string;          // ISO
  valueMs: number;
}

export interface CheckResult {
  id: string;
  siteId: string;
  checkedAt: string;          // ISO
  success: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  probe: string;
  result: 'ok' | 'timeout' | 'http_error' | 'dns_error' | 'tls_error';
  tlsExpiry: string | null;   // ISO or null
}

export interface LatencySeries {
  range: '1h' | '24h' | '7d';
  points: LatencyPoint[];
  thresholdMs: number;
}

export interface AddSitePayload {
  name: string;
  url: string;
  checkIntervalSeconds: number;
}
