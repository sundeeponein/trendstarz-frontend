import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CampaignTransaction } from './payments-payouts.models';

@Injectable({ providedIn: 'root' })
export class PaymentsPayoutsApiService {
  constructor(private http: HttpClient) {}

  listTransactions(headers: HttpHeaders): Observable<{ success: boolean; data: CampaignTransaction[] }> {
    return this.http.get<{ success: boolean; data: CampaignTransaction[] }>(
      `${environment.apiBaseUrl}/campaign-transactions`,
      { headers },
    );
  }

  getSummary(headers: HttpHeaders): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/campaign-transactions/summary`, {
      headers,
    });
  }

  verifyTransaction(id: string, headers: HttpHeaders, notes?: string): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-transactions/${id}/verify`,
      { notes },
      { headers },
    );
  }

  rejectTransaction(id: string, reason: string, headers: HttpHeaders): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-transactions/${id}/reject`,
      { reason },
      { headers },
    );
  }

  markPaid(
    id: string,
    payload: {
      payoutUtr: string;
      payoutProofUrl?: string;
      payoutUpiId?: string;
      notes?: string;
    },
    headers: HttpHeaders,
  ): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-transactions/${id}/mark-paid`,
      payload,
      { headers },
    );
  }

  runAutoApproveStale(headers: HttpHeaders): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-invites/admin/auto-approve-stale`,
      {},
      { headers },
    );
  }
}
