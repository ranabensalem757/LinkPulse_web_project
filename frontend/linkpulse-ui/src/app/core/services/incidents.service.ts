import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DailyIncidentStats, Incident, IncidentDetail } from '../models/incident.model';

@Injectable({ providedIn: 'root' })
export class IncidentsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getStats(): Observable<DailyIncidentStats> {
    return this.http.get<DailyIncidentStats>(`${this.base}/incidents/stats`);
  }

  getIncidents(status?: string, q?: string): Observable<Incident[]> {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (q) params.set('q', q);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<Incident[]>(`${this.base}/incidents${qs}`);
  }

  getIncident(id: string): Observable<IncidentDetail> {
    return this.http.get<IncidentDetail>(`${this.base}/incidents/${id}`);
  }
}
