import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PendingPremiumPaymentsResponse,
  PremiumPayment,
} from './payments-payouts.models';

@Injectable({ providedIn: 'root' })
export class PremiumPaymentsAdminApiService {
  constructor(private http: HttpClient) {}

  listPending(
    page: number,
    limit: number,
    headers: HttpHeaders,
  ): Observable<PendingPremiumPaymentsResponse> {
    return this.http.get<PendingPremiumPaymentsResponse>(
      `${environment.apiBaseUrl}/payment/pending?page=${page}&limit=${limit}`,
      { headers },
    );
  }

  listByStatus(
    status: 'approved' | 'rejected',
    headers: HttpHeaders,
  ): Observable<{ payments: PremiumPayment[] }> {
    return this.http.get<{ payments: PremiumPayment[] }>(
      `${environment.apiBaseUrl}/payment/by-status?status=${status}`,
      { headers },
    );
  }

  approvePayment(paymentId: string, headers: HttpHeaders): Observable<{ message?: string }> {
    return this.http.patch<{ message?: string }>(
      `${environment.apiBaseUrl}/payment/${paymentId}/approve`,
      {},
      { headers },
    );
  }

  rejectPayment(
    paymentId: string,
    reason: string,
    headers: HttpHeaders,
  ): Observable<{ message?: string }> {
    return this.http.patch<{ message?: string }>(
      `${environment.apiBaseUrl}/payment/${paymentId}/reject`,
      { reason },
      { headers },
    );
  }
}
