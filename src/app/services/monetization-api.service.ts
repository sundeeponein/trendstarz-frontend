import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";

export interface FeeSettings {
  platformFeePercent: number;
  platformCommissionPercent: number;
  inviteUnlockFee: number;
  minimumCampaignFee: number;
  gstPercent: number;
}

export interface UsageSummary {
  day: string;
  search: { used: number; limit: number; remaining: number };
  profileViews: { used: number; limit: number; remaining: number };
}

@Injectable({ providedIn: "root" })
export class MonetizationApiService {
  private readonly apiUrl = environment.apiBaseUrl || "/api";

  constructor(private readonly http: HttpClient) {}

  getFeeSettings(): Observable<{ success: boolean; feeSettings: FeeSettings }> {
    return this.http.get<{ success: boolean; feeSettings: FeeSettings }>(
      `${this.apiUrl}/monetization/admin/fee-settings`,
    );
  }

  updateFeeSettings(payload: Partial<FeeSettings>) {
    return this.http.patch<{ success: boolean; feeSettings: FeeSettings }>(
      `${this.apiUrl}/monetization/admin/fee-settings`,
      payload,
    );
  }

  createSubscriptionOrder(planId: string, billingCycle: "monthly" | "quarterly" | "yearly", finalAmount?: number) {
    return this.http.post<{
      success: boolean;
      order: { orderId: string; amount: number; currency: string; keyId: string };
      paymentId: string;
    }>(`${this.apiUrl}/monetization/subscriptions/order`, {
      planId,
      billingCycle,
      ...(typeof finalAmount === "number" ? { finalAmount } : {}),
    });
  }

  createInviteUnlockOrder(inviteId: string) {
    return this.http.post<{
      success: boolean;
      order: { orderId: string; amount: number; currency: string; keyId: string };
      unlock: { inviteId: string; amount: number; commissionAmount: number; gstAmount: number };
    }>(`${this.apiUrl}/monetization/invite-unlock/order`, {
      inviteId,
    });
  }

  verifyRazorpayPayment(payload: {
    orderId: string;
    paymentId: string;
    signature: string;
    paymentType: "subscription" | "invite_unlock";
  }) {
    return this.http.post<{ success: boolean; paymentId: string }>(
      `${this.apiUrl}/monetization/razorpay/verify`,
      payload,
    );
  }

  trackSocialClick(payload: {
    targetUserId: string;
    targetRole: "brand" | "influencer" | "photographer";
    platform: string;
    url: string;
    source?: string;
  }) {
    return this.http.post<{ success: boolean; clickId: string }>(
      `${this.apiUrl}/monetization/social-clicks`,
      payload,
    );
  }

  getMyUsage() {
    return this.http.get<{ success: boolean; usage: UsageSummary }>(
      `${this.apiUrl}/monetization/usage/my`,
    );
  }

  getAdminRevenueSummary(days = 30) {
    return this.http.get<{
      success: boolean;
      summary: {
        from: string;
        to: string;
        totalRevenue: number;
        totalCommission: number;
        totalGst: number;
        premiumUsers: number;
        activeUnlocks: number;
        revenueByType: Array<{ _id: string; amount: number; count: number }>;
      };
    }>(`${this.apiUrl}/monetization/admin/revenue-summary?days=${encodeURIComponent(String(days))}`);
  }
}
