import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DiagnosticResult } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DiagnosticsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getLatest(siteId: string): Observable<DiagnosticResult> {
    return this.http.get<DiagnosticResult>(`${this.base}/diagnostics/sites/${siteId}/latest`);
  }

  run(siteId: string): Observable<DiagnosticResult> {
    return this.http.post<DiagnosticResult>(`${this.base}/diagnostics/sites/${siteId}/run`, {});
  }
}
