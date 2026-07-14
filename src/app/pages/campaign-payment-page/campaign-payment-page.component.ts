import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../shared/config.service';
import { PaymentsPayoutsApiService } from '../../features/payments-payouts/payments-payouts-api.service';
import { CampaignTransaction } from '../../features/payments-payouts/payments-payouts.models';

type Tab = 'summary' | 'pay' | 'status';

type RazorpayOrder = { orderId: string; amount: number; currency: string; keyId: string };

@Component({
  selector: 'app-campaign-payment-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './campaign-payment-page.component.html',
  styleUrls: ['./campaign-payment-page.component.scss'],
})
export class CampaignPaymentPageComponent implements OnInit {
  campaignId = '';
  loading = true;
  error = '';
  campaign: any = null;
  activeTab: Tab = 'summary';

  paymentUpiId = 'trendstarzin@kotak';
  payeeName = 'TrendstarZ';
  platformFeeEnabled = false;
  platformFeePercent = 0;
  gstPercent = 0;

  calculatedPayment: any = null;
  utrNumber = '';
  submitting = false;
  processingRazorpay = false;
  successMessage = '';
  submitError = '';
  copied = false;
  payoutMessageVisible = false;
  payoutMessageCopied = false;

  statusTransactions: CampaignTransaction[] = [];

  constructor(
    private route: ActivatedRoute,
    private config: ConfigService,
    private txApi: PaymentsPayoutsApiService,
    private cd: ChangeDetectorRef,
  ) {}

  private getToken(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  async ngOnInit() {
    this.campaignId = this.route.snapshot.paramMap.get('campaignId') || '';
    if (!this.campaignId) {
      this.error = 'Missing campaign id.';
      this.loading = false;
      return;
    }

    try {
      const [campaignRes, settingsRes] = await Promise.all([
        firstValueFrom(this.config.getCampaignById(this.campaignId)),
        firstValueFrom(this.config.getAppSettings() as any).catch(() => null),
      ]);
      this.campaign = campaignRes;
      if (settingsRes) {
        const s = settingsRes as any;
        if (s.paymentUpiId) this.paymentUpiId = s.paymentUpiId;
        if (s.payeeName) this.payeeName = s.payeeName;
        if (s.platformFeeEnabled !== undefined) this.platformFeeEnabled = s.platformFeeEnabled;
        if (s.platformFeePercent !== undefined) this.platformFeePercent = s.platformFeePercent;
        if (s.gstPercent !== undefined) this.gstPercent = s.gstPercent;
      }
      if (!this.campaign) this.error = 'Campaign not found.';
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'Failed to load campaign.';
    } finally {
      this.loading = false;
      this.cd.markForCheck();
    }

    await this.fetchStatus();
  }

  async fetchStatus() {
    try {
      const token = this.getToken();
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const res = await firstValueFrom(this.txApi.getCampaignTransactionStatus(this.campaignId, headers));
      this.statusTransactions = res?.data || [];
    } catch {
      this.statusTransactions = [];
    } finally {
      this.cd.markForCheck();
    }
  }

  get hasSubmittedProof(): boolean {
    return this.statusTransactions.some(tx => tx.collectionStatus !== 'awaiting_payment');
  }

  get primaryTx(): CampaignTransaction | null {
    return this.statusTransactions[0] || null;
  }

  setTab(t: Tab) {
    this.activeTab = t;
    this.cd.detectChanges();
  }

  copyUpi() {
    navigator.clipboard.writeText(this.paymentUpiId).then(() => {
      this.copied = true;
      setTimeout(() => { this.copied = false; this.cd.markForCheck(); }, 2000);
      this.cd.markForCheck();
    }).catch(() => {});
  }

  togglePayoutMessage() {
    this.payoutMessageVisible = !this.payoutMessageVisible;
    this.cd.markForCheck();
  }

  copyPayoutWhatsAppMessage() {
    const text = this.payoutWhatsAppMessage;
    if (!text) return;
    const done = () => {
      this.payoutMessageCopied = true;
      setTimeout(() => { this.payoutMessageCopied = false; this.cd.markForCheck(); }, 2000);
      this.cd.markForCheck();
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this.fallbackCopy(text, done));
      return;
    }
    this.fallbackCopy(text, done);
  }

  private fallbackCopy(text: string, done: () => void) {
    if (typeof document === 'undefined') return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  }

  get canSubmit(): boolean {
    return !!this.utrNumber.trim() && !this.submitting;
  }

  async submitProof() {
    if (!this.utrNumber.trim()) {
      this.submitError = 'Please enter the UTR / transaction reference.';
      this.cd.markForCheck();
      return;
    }
    this.submitting = true;
    this.submitError = '';
    try {
      const res: any = await firstValueFrom(
        this.config.submitCampaignPaymentProof(this.campaignId, { utrNumber: this.utrNumber.trim() })
      );
      const tx = res?.data || res;
      if (tx) this.statusTransactions = [tx, ...this.statusTransactions];
      this.successMessage = 'Payment proof submitted! Our team will verify within 6–10 hours.';
      this.utrNumber = '';
      this.setTab('status');
    } catch (e: any) {
      this.submitError = e?.error?.message || 'Failed to submit proof. Please try again.';
    } finally {
      this.submitting = false;
      this.cd.markForCheck();
    }
  }

  private async ensureRazorpayLoaded(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if ((window as any).Razorpay) return true;

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
      document.body.appendChild(script);
    });

    return !!(window as any).Razorpay;
  }

  async payWithRazorpay() {
    if (!this.campaignId) return;
    this.processingRazorpay = true;
    this.submitError = '';
    try {
      const token = this.getToken();
      if (!token) {
        this.submitError = 'Not authenticated';
        return;
      }
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const orderRes = await firstValueFrom(
        this.txApi.createCampaignRazorpayOrder(this.campaignId, headers),
      );
      const order: RazorpayOrder | undefined = orderRes?.order;
      if (!order?.orderId || !order?.keyId) {
        this.submitError = 'Failed to initialize Razorpay order.';
        return;
      }

      const loaded = await this.ensureRazorpayLoaded();
      if (!loaded) {
        this.submitError = 'Failed to load Razorpay checkout.';
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const rz = new (window as any).Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'TrendstarZ',
          description: 'Campaign payment',
          order_id: order.orderId,
          handler: async (resp: any) => {
            try {
              await firstValueFrom(
                this.txApi.verifyCampaignRazorpayPayment(
                  this.campaignId,
                  {
                    orderId: resp?.razorpay_order_id,
                    paymentId: resp?.razorpay_payment_id,
                    signature: resp?.razorpay_signature,
                  },
                  headers,
                ),
              );
              this.successMessage = 'Razorpay payment verified. Influencers can now start work.';
              await this.fetchStatus();
              this.setTab('status');
              resolve();
            } catch (e: any) {
              reject(new Error(e?.error?.message || 'Payment verification failed'));
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled.')),
          },
          theme: { color: '#f59e0b' },
        });
        rz.open();
      });
    } catch (e: any) {
      this.submitError = e?.message || e?.error?.message || 'Razorpay payment failed. Please try manual UTR.';
    } finally {
      this.processingRazorpay = false;
      this.cd.markForCheck();
    }
  }

  resubmit() {
    this.successMessage = '';
    this.submitError = '';
    this.setTab('pay');
    this.cd.markForCheck();
  }

  collectionLabel(status: string): string {
    const m: Record<string, string> = {
      awaiting_payment: 'Awaiting payment',
      'proof_submitted': 'Verification in progress',
      verified: 'Payment confirmed',
      failed: 'Rejected — please resubmit',
    };
    return m[status] || status;
  }

  payoutLabel(status: string): string {
    const m: Record<string, string> = {
      pending: 'Pending',
      processing: 'Being processed',
      paid: 'Released to influencer',
      skipped: 'Skipped',
      frozen: 'Payout on hold',
    };
    return m[status] || status;
  }

  transactionReference(tx: CampaignTransaction | null): string {
    if (!tx) return '-';
    if (String(tx.gateway || '').toLowerCase() === 'razorpay') {
      return String(tx.gatewayPaymentId || tx.gatewayOrderId || '-');
    }
    return String(tx.utrNumber || '-');
  }

  transactionReferenceLabel(tx: CampaignTransaction | null): string {
    return String(tx?.gateway || '').toLowerCase() === 'razorpay'
      ? 'Host paid Razorpay ref'
      : 'Host paid UTR';
  }

  payoutReference(tx: CampaignTransaction | null): string {
    if (!tx) return '-';
    const payoutGateway = String(tx.payoutGatewayProvider || 'manual_upi').toLowerCase();
    if (payoutGateway === 'razorpayx') {
      return String(tx.payoutTransferId || tx.payoutUtr || '-');
    }
    return String(tx.payoutUtr || tx.payoutTransferId || '-');
  }

  payoutReferenceLabel(tx: CampaignTransaction | null): string {
    return String(tx?.payoutGatewayProvider || 'manual_upi').toLowerCase() === 'razorpayx'
      ? 'Admin to user Razorpay ref'
      : 'Admin to user payout UTR';
  }

  get payoutWhatsAppMessage(): string {
    const tx = this.primaryTx;
    if (!tx || tx.payoutStatus !== 'paid') return '';
    const campaignTitle = String(this.campaign?.title || this.campaign?.campaignName || 'your campaign').trim();
    const amount = this.formatINR(tx.recipientPayout || tx.agreedAmount || 0);
    const paidAt = tx.payoutSettledAt || tx.paidOutAt || tx.updatedAt;
    const dateLine = paidAt ? `\nPaid on: ${new Date(paidAt).toLocaleString('en-IN')}` : '';
    return [
      `Hi, your TrendStarZ payout for "${campaignTitle}" has been released.`,
      `Amount: ${amount}`,
      `${this.payoutReferenceLabel(tx)}: ${this.payoutReference(tx)}${dateLine}`,
      'Thank you for completing the campaign.',
    ].join('\n');
  }

  formatINR(paise: number | undefined | null): string {
    return '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  get upiQrUrl(): string {
    const tx = this.primaryTx;
    if (!tx || !tx.agreedAmount) return '';
    const amount = Number(tx.agreedAmount || 0) / 100;
    const upiString = `upi://pay?pa=${this.paymentUpiId}&pn=${encodeURIComponent(this.payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('TrendstarZ Campaign')}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiString)}`;
  }
}
