import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardSummary, LatencySeries, RecentEvent } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.base}/dashboard/summary`);
  }

  getLatency(range: '1h' | '24h' | '7d'): Observable<LatencySeries> {
    return this.http.get<LatencySeries>(`${this.base}/dashboard/latency?range=${range}`);
  }

  getEvents(): Observable<RecentEvent[]> {
    return this.http.get<RecentEvent[]>(`${this.base}/dashboard/events`);
  }

  exportCsv(): Observable<string> {
    return this.http.get(`${this.base}/dashboard/export.csv`, { responseType: 'text' });
  }
}
