import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CampaignTransaction, CancelRequestItem, RefundQueueItem } from './payments-payouts.models';

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

  // ── Refunds (admin) — on hold → owed → sent, settlement, late posts ──────

  listRefunds(state?: string): Observable<{ success: boolean; data: RefundQueueItem[] }> {
    const q = state ? `?state=${encodeURIComponent(state)}` : '';
    return this.http.get<{ success: boolean; data: RefundQueueItem[] }>(
      `${environment.apiBaseUrl}/campaign-transactions/admin/refunds${q}`,
    );
  }

  markRefundSent(
    id: string,
    payload: { refundUtr: string; refundAmount?: number; transferDate?: string; notes?: string },
  ): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-transactions/${id}/mark-refund-sent`,
      payload,
    );
  }

  recordHostRepayment(
    id: string,
    payload: { utr: string; amount?: number; repaidAt?: string; notes?: string },
  ): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-transactions/${id}/settlement/host-repaid`,
      payload,
    );
  }

  approveSettlementException(id: string, reason: string): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-transactions/${id}/settlement/exception`,
      { reason },
    );
  }

  approveFeeCredit(id: string): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/campaign-transactions/${id}/fee-credit/approve`, {});
  }

  withholdFeeCredit(id: string, reason: string): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/campaign-transactions/${id}/fee-credit/withhold`, { reason });
  }

  /** Admin: this no-post closure must not count against the creator. */
  excuseMiss(inviteId: string, reason: string): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/campaign-invites/admin/${inviteId}/excuse-miss`, { reason });
  }

  /** Admin gives back a paid invite's campaign slot (documented exception). */
  restoreSlot(inviteId: string, reason: string): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/campaign-invites/admin/${inviteId}/restore-slot`, { reason });
  }

  listCancelRequests(): Observable<{ success: boolean; data: CancelRequestItem[] }> {
    return this.http.get<{ success: boolean; data: CancelRequestItem[] }>(
      `${environment.apiBaseUrl}/campaign-invites/admin/cancel-requests`,
    );
  }

  decideCancelRequest(
    inviteId: string,
    payload: { decision: 'approve' | 'reject'; note: string; compensation?: number; pauseDays?: number },
  ): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-invites/admin/${inviteId}/cancel-request/decide`,
      payload,
    );
  }

  /** Admin verifies (approve) or rejects a late post on an invite. */
  reviewLatePost(
    inviteId: string,
    payload: { action: 'approve' | 'reject'; note: string; postUrl?: string },
  ): Observable<any> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/campaign-invites/admin/${inviteId}/late-post-review`,
      payload,
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
    acceptTerms = false,
  ): Observable<{
    success: boolean;
    order: { orderId: string; amount: number; currency: string; keyId: string };
  }> {
    return this.http.post<{
      success: boolean;
      order: { orderId: string; amount: number; currency: string; keyId: string };
    }>(
      `${environment.apiBaseUrl}/campaign-transactions/${campaignId}/razorpay/order`,
      { acceptTerms },
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
