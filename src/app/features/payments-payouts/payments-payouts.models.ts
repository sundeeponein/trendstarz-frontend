export interface CampaignTransaction {
  _id: string;
  campaignId: string;
  transactionType: 'paid_collab' | 'pay_to_join';
  direction: 'brand_to_influencer' | 'influencer_to_brand';
  payerRole: 'brand' | 'influencer';
  recipientRole: 'brand' | 'influencer';
  agreedAmount: number;
  platformFee: number;
  payerTotal: number;
  recipientPayout: number;
  collectionStatus: 'awaiting_payment' | 'proof_submitted' | 'verified' | 'failed';
  payoutStatus: 'pending' | 'processing' | 'paid' | 'skipped';
  utrNumber?: string;
  paymentProofUrl?: string;
  createdAt: string;
  updatedAt?: string;
  collectedAt?: string;
  paidOutAt?: string;
  /** Recipient profile snapshot enriched by listForAdmin (admin view only). */
  recipient?: {
    id?: string;
    role?: 'brand' | 'influencer';
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
    role?: 'brand' | 'influencer';
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
  userType: 'Influencer' | 'Brand';
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
