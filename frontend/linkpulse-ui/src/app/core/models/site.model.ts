export type StatusType = 'online' | 'offline' | 'paused' | 'unknown';

export interface Site {
  id: string;
  name: string;
  url: string;
  status: StatusType;
  responseTimeMs: number;
  availability30d: number;
  lastCheckedAt: string;
  checkIntervalSeconds: number;
  isEnabled: boolean;
  region: string;
}

export interface LatencyPoint {
  timestamp: string;
  valueMs: number;
}

export interface CheckResult {
  id: string;
  siteId: string;
  checkedAt: string;
  success: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  probe: string;
  result: 'ok' | 'timeout' | 'http_error' | 'dns_error' | 'tls_error';
  tlsExpiry: string | null;
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