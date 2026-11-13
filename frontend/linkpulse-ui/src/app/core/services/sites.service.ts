import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AddSitePayload, CheckResult, LatencySeries, Site } from '../models/site.model';

@Injectable({ providedIn: 'root' })
export class SitesService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getSites(status?: string, q?: string): Observable<Site[]> {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (q) params.set('q', q);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<Site[]>(`${this.base}/sites${qs}`);
  }

  getSite(id: string): Observable<Site> {
    return this.http.get<Site>(`${this.base}/sites/${id}`);
  }

  addSite(payload: AddSitePayload): Observable<Site> {
    return this.http.post<Site>(`${this.base}/sites`, payload);
  }

  updateSite(id: string, patch: Partial<Site>): Observable<Site> {
    return this.http.patch<Site>(`${this.base}/sites/${id}`, patch);
  }

  deleteSite(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/sites/${id}`);
  }

  pauseSite(id: string, pause: boolean): Observable<Site> {
    return this.updateSite(id, { isEnabled: !pause, status: pause ? 'paused' : 'unknown' });
  }

  runCheck(id: string): Observable<CheckResult> {
    return this.http.post<CheckResult>(`${this.base}/sites/${id}/checks/run`, {});
  }

  getChecks(id: string): Observable<CheckResult[]> {
    return this.http.get<CheckResult[]>(`${this.base}/sites/${id}/checks`);
  }

  getLatency(id: string, range: '1h' | '24h' | '7d'): Observable<LatencySeries> {
    return this.http.get<LatencySeries>(`${this.base}/sites/${id}/latency?range=${range}`);
  }
}
