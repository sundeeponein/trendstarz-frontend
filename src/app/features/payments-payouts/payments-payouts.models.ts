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
  /** Payment gateway. MVP = manual_upi. Future: razorpay. */
  gateway?: 'manual_upi' | 'razorpay';
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  gatewayVerifiedAt?: string;
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
  payoutGatewayProvider?: 'manual_upi' | 'razorpayx';
  payoutTransferId?: string;
  payoutTransferStatus?: string;
  payoutFailureReason?: string;
  payoutRetryCount?: number;
  payoutLastRetryAt?: string;
  payoutInitiatedAt?: string;
  payoutSettledAt?: string;
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
  inviteSnapshot?: {
    id?: string;
    status?: string;
    unlocked?: boolean;
    unlockType?: string;
    agreedAmount?: number;
    agreedAmountPaise?: number;
    counterOfferStatus?: string;
    counterOfferedAmount?: number;
    counterOfferedAmountPaise?: number;
    counterRequestedAmount?: number;
    counterRequestedAmountPaise?: number;
    counterResolvedAt?: string | null;
    acceptedAt?: string | null;
    completedAt?: string | null;
    updatedAt?: string | null;
  } | null;
}

export interface TransactionSummary {
  collected: number;
  fees: number;
  pendingPayouts: number;
  paidOut: number;
  /** Money actually transferred back (UTR recorded). */
  refunded?: number;
  /** Classified as owed — not yet transferred. */
  refundDue?: number;
  refundDueCount?: number;
  /** Under the 7-day review — not owed yet. */
  refundOnHold?: number;
  refundOnHoldCount?: number;
  /** Old "refund to host" rows whose real payment history is unconfirmed. */
  legacyUnconfirmed?: number;
  legacyUnconfirmedCount?: number;
  settlementPending?: number;
  settlementPendingCount?: number;
  netBalance: number;
}

export type RefundState = 'on_hold' | 'owed' | 'sent' | 'settlement' | 'legacy_unconfirmed';

export interface RefundHistoryEntry {
  at: string;
  action: string;
  by?: string | null;
  byRole: 'admin' | 'system' | 'host' | 'creator';
  note?: string;
  amount?: number;
  utr?: string;
  url?: string;
}

/** One row of the admin Refunds queue (GET campaign-transactions/admin/refunds). */
export interface RefundQueueItem {
  _id: string;
  state: RefundState;
  campaignId: string;
  campaignTitle: string;
  campaignNumber?: string | number | null;
  inviteId: string;
  inviteStatus: string | null;
  withdrawnAt?: string | null;
  withdrawnReason?: string | null;
  selectedPlatform?: string | null;
  hostName: string;
  hostRole: string;
  creatorName: string;
  creatorRole: string;
  creatorSocial: { platform: string; platformKey?: string; handle: string }[];
  agreedAmount: number;
  platformFee: number;
  payerTotal: number;
  refundAmount?: number | null;
  refundHoldUntil?: string | null;
  refundOwedAt?: string | null;
  refundUtr?: string | null;
  refundTransferDate?: string | null;
  refundSentAt?: string | null;
  latePost?: {
    url?: string;
    note?: string;
    submittedAt?: string;
    originalDeadline?: string;
    status?: 'pending' | 'approved' | 'rejected';
    reviewNote?: string;
  } | null;
  settlement?: {
    status?: 'awaiting_host_repayment' | 'repaid' | 'exception_approved';
    amount?: number;
    hostRepaymentUtr?: string;
    exceptionReason?: string;
  } | null;
  openReport: boolean;
  reportCategory?: string | null;
  reportReason?: string | null;
  termsAcceptance?: {
    host?: { acceptedAt?: string; version?: string };
    creator?: { acceptedAt?: string; version?: string };
  } | null;
  flags: (
    | 'repeat_pair'
    | 'host_repeat_refunds'
    | 'creator_repeat_no_post'
    | 'replaced_after_no_post'
    | 'host_no_post_rate'
  )[];
  /** "fee_credit" = terms v2: creator amount back by UPI, platform fee as credit. */
  refundPolicy?: 'full_refund' | 'fee_credit';
  cashRefundDue?: number;
  feeCredit?: { status?: 'needs_review' | 'issued' | 'withheld' | 'reversed'; amount?: number; note?: string } | null;
  feeCreditAmount?: number;
  creditApplied?: number;
  compensation?: { amount?: number; note?: string } | null;
  closureAnswers?: {
    creator?: { answer?: string; details?: string; link?: string; at?: string };
    host?: { answer?: string; details?: string; link?: string; at?: string };
  } | null;
  slotRestored?: { at?: string; reason?: string } | null;
  missExcused?: { at?: string; reason?: string } | null;
  paidSlot?: boolean;
  history: RefundHistoryEntry[];
}

export interface CancelRequestItem {
  inviteId: string;
  status: string;
  campaignTitle: string;
  campaignNumber?: number | string | null;
  hostName: string;
  creatorName: string;
  selectedPostDate?: string | null;
  agreedAmount: number;
  request: {
    type: 'cancel' | 'pause';
    requestedByRole: 'host' | 'creator';
    reason: string;
    at: string;
    status: string;
  };
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
  orderId?: string;
  paymentId?: string;
  amount: number;
  premiumDuration: '1m' | '3m' | '1y';
  paymentMethod: 'upi' | 'qr' | 'razorpay';
  gatewayProvider?: 'manual_upi' | 'razorpay';
  paymentStatus?: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
  refundStatus?: 'none' | 'requested' | 'processed' | 'failed';
  purpose?: 'subscription' | 'invite_unlock' | 'campaign_payment';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  approvalNotes?: string;
  refundedAt?: string;
  refundAmount?: number;
  refundReason?: string;
}

export interface PendingPremiumPaymentsResponse {
  success: boolean;
  payments: PremiumPayment[];
  total: number;
  page: number;
  pages: number;
}
