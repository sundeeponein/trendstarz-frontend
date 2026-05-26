export interface CampaignTransaction {
  _id: string;
  campaignId: string;
  inviteId?: string;
  transactionType: 'paid_collab' | 'pay_to_join';
  direction: 'brand_to_influencer' | 'influencer_to_brand';
  payerRole: 'brand' | 'influencer' | 'photographer';
  payerId?: string;
  recipientRole: 'brand' | 'influencer' | 'photographer';
  recipientId?: string;
  agreedAmount: number;
  platformFee: number;
  payerTotal: number;
  recipientPayout: number;
  /** Payment gateway. MVP = manual_upi. Future: razorpay, stripe. */
  gateway?: 'manual_upi' | 'razorpay' | 'stripe';
  collectionStatus: 'awaiting_payment' | 'proof_submitted' | 'verified' | 'failed';
  /** frozen = disputed, payout on hold until admin resolves. */
  payoutStatus: 'pending' | 'processing' | 'paid' | 'skipped' | 'frozen';
  workStatus?: 'pending' | 'submitted' | 'approved' | 'disputed';
  /** Payment-level dispute (separate from invite-level work dispute). */
  disputeStatus?: 'none' | 'open' | 'resolved';
  disputeReason?: string;
  disputedBy?: string;
  disputedByRole?: string;
  disputedAt?: string;
  resolveOutcome?: 'release_to_influencer' | 'refund_to_brand';
  resolvedBy?: string;
  resolvedAt?: string;
  adminNotes?: string;
  utrNumber?: string;
  paymentProofUrl?: string;
  payoutUpiId?: string;
  payoutUtr?: string;
  createdAt: string;
  updatedAt?: string;
  collectedAt?: string;
  paidOutAt?: string;
  /** Recipient profile snapshot enriched by listForAdmin (admin view only). */
  recipient?: {
    id?: string;
    role?: 'brand' | 'influencer' | 'photographer';
    name?: string;
    email?: string;
    mobile?: string;
    payoutUpiId?: string;
    payoutMobile?: string;
    payoutName?: string;
    lastConfirmedAt?: string;
  };
  /** Payer profile snapshot enriched by listForAdmin (admin view only). */
  payer?: {
    id?: string;
    role?: 'brand' | 'influencer' | 'photographer';
    name?: string;
    email?: string;
    mobile?: string;
  };
}

export interface TransactionSummary {
  collected: number;
  fees: number;
  pendingPayouts: number;
  paidOut: number;
  netBalance: number;
}

export interface PremiumPayment {
  _id: string;
  userId: any;
  userType: 'Influencer' | 'Brand' | 'Photographer';
  userSnapshot?: {
    name?: string;
    email?: string;
  };
  transactionId: string;
  amount: number;
  premiumDuration: '1m' | '3m' | '1y';
  paymentMethod: 'upi' | 'qr';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  approvalNotes?: string;
}

export interface PendingPremiumPaymentsResponse {
  success: boolean;
  payments: PremiumPayment[];
  total: number;
  page: number;
  pages: number;
}
