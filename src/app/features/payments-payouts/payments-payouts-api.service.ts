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

  runAutoPayoutSweep(headers: HttpHeaders): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-transactions/admin/auto-payout/run`,
      {},
      { headers },
    );
  }

  // ── Campaign-level payment status (brand polls after UTR submission) ──────

  /** Get all transaction records for a campaign (brand uses this to check status). */
  getCampaignTransactionStatus(campaignId: string, headers: HttpHeaders): Observable<{ success: boolean; data: CampaignTransaction[] }> {
    return this.http.get<{ success: boolean; data: CampaignTransaction[] }>(
      `${environment.apiBaseUrl}/campaign-transactions/campaign/${campaignId}/status`,
      { headers },
    );
  }

  createCampaignRazorpayOrder(
    campaignId: string,
    headers: HttpHeaders,
  ): Observable<{
    success: boolean;
    order: { orderId: string; amount: number; currency: string; keyId: string };
  }> {
    return this.http.post<{
      success: boolean;
      order: { orderId: string; amount: number; currency: string; keyId: string };
    }>(
      `${environment.apiBaseUrl}/campaign-transactions/${campaignId}/razorpay/order`,
      {},
      { headers },
    );
  }

  verifyCampaignRazorpayPayment(
    campaignId: string,
    payload: { orderId: string; paymentId: string; signature: string },
    headers: HttpHeaders,
  ): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-transactions/${campaignId}/razorpay/verify`,
      payload,
      { headers },
    );
  }

  // ── Dispute endpoints ─────────────────────────────────────────────────────

  /** Brand or influencer raises a payment dispute (freezes payout). */
  raiseDispute(id: string, reason: string, headers: HttpHeaders): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-transactions/${id}/raise-dispute`,
      { reason },
      { headers },
    );
  }

  /** Admin resolves a frozen dispute, releasing payment to the correct party. */
  resolveDispute(
    id: string,
    outcome: 'release_to_influencer' | 'refund_to_brand',
    notes: string,
    headers: HttpHeaders,
  ): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-transactions/${id}/resolve-dispute`,
      { outcome, notes },
      { headers },
    );
  }

  /** Admin — fetch all open (frozen) disputes. */
  listOpenDisputes(headers: HttpHeaders): Observable<{ success: boolean; data: CampaignTransaction[]; total: number }> {
    return this.http.get<{ success: boolean; data: CampaignTransaction[]; total: number }>(
      `${environment.apiBaseUrl}/campaign-transactions/disputes/open`,
      { headers },
    );
  }
}
