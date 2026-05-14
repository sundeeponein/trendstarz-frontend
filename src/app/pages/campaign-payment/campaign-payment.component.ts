import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConfigService } from '../../shared/config.service';
import { PaymentsPayoutsApiService } from '../../features/payments-payouts/payments-payouts-api.service';
import { CampaignTransaction } from '../../features/payments-payouts/payments-payouts.models';

type Tab = 'summary' | 'pay' | 'status';

@Component({
  selector: 'app-campaign-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campaign-payment.component.html',
  styleUrls: ['./campaign-payment.component.scss']
})
export class CampaignPaymentComponent implements OnInit, OnChanges {
  @Input() campaignId?: string | null = null;
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  loading = false;
  submitting = false;
  error = '';
  successMessage = '';
  calculated: any = null;
  activeTab: Tab = 'summary';

  utrNumber = '';
  paymentProofFile: File | null = null;
  paymentProofUrl = '';
  paymentProofPreview: string | null = null;

  // admin-configurable defaults
  commissionPercent: number = 0;
  gstPercent: number = 0;
  paymentUpiId = 'trendstarzin@kotak';

  // current transaction status (polled after modal opens)
  statusTransactions: CampaignTransaction[] = [];
  copied = false;

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private txApi: PaymentsPayoutsApiService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.config.getAppSettings().subscribe({
      next: (s: any) => {
        if (s?.platformFeePercent !== undefined) this.commissionPercent = s.platformFeePercent;
        if (s?.gstPercent !== undefined) this.gstPercent = s.gstPercent;
        if (s?.paymentUpiId) this.paymentUpiId = s.paymentUpiId;
        this.cd.markForCheck();
      },
      error: () => {}
    });
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['visible'] && this.visible && this.campaignId) {
      this.resetState();
      this.calculate();
      this.fetchStatus();
    }
  }

  private resetState() {
    this.error = '';
    this.successMessage = '';
    this.utrNumber = '';
    this.paymentProofFile = null;
    this.paymentProofUrl = '';
    this.paymentProofPreview = null;
    this.statusTransactions = [];
    this.activeTab = 'summary';
  }

  setTab(t: Tab) { this.activeTab = t; }

  // ── Status helpers ──────────────────────────────────
  get primaryTx(): CampaignTransaction | null {
    return this.statusTransactions[0] || null;
  }

  get hasSubmittedProof(): boolean {
    return this.statusTransactions.some(
      tx => tx.collectionStatus !== 'awaiting_payment',
    );
  }

  collectionLabel(status: string): string {
    const m: Record<string, string> = {
      awaiting_payment:  'Awaiting payment',
      proof_submitted:   'Verification pending',
      verified:          'Payment confirmed',
      failed:            'Rejected — please resubmit',
    };
    return m[status] || status;
  }

  payoutLabel(status: string): string {
    const m: Record<string, string> = {
      pending:    'Pending',
      processing: 'Being processed',
      paid:       'Released to influencer',
      skipped:    'Skipped',
      frozen:     'Frozen — dispute open',
    };
    return m[status] || status;
  }

  collectionStatusClass(status: string): string {
    if (status === 'verified') return 'cp-status--ok';
    if (status === 'failed') return 'cp-status--err';
    if (status === 'proof_submitted') return 'cp-status--warn';
    return 'cp-status--muted';
  }

  openPayInNewTab() {
    if (!this.campaignId) return;
    const url = `/campaign-pay/${this.campaignId}`;
    window.open(url, '_blank', 'noopener');
    this.setTab('pay');
  }

  copyUpi() {
    navigator.clipboard.writeText(this.paymentUpiId).then(() => {
      this.copied = true;
      setTimeout(() => { this.copied = false; this.cd.markForCheck(); }, 2000);
      this.cd.markForCheck();
    }).catch(() => {});
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  // ── Helpers / display ──────────────────────────────────
  get campaignTypeLabel(): string {
    const m: Record<string, string> = {
      paid_collab: 'Paid Collaboration',
      product: 'Product Collaboration',
      invite_location: 'Invite to Location',
      pay_to_join: 'Pay to Join',
    };
    return m[(this.calculated?.campaignType || '').toLowerCase()] || 'Campaign';
  }

  formatINR(v: number | undefined | null): string {
    const rupees = Number(v || 0) / 100;
    return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  get gstAmount(): number {
    if (!this.calculated) return 0;
    const fee = Number(this.calculated.platformFee || 0);
    return Math.round(fee * (this.gstPercent / 100));
  }

  get totalToPay(): number {
    if (!this.calculated) return 0;
    return Number(this.calculated.payerTotal || 0) + this.gstAmount;
  }

  get canSubmit(): boolean {
    return !!this.utrNumber.trim() && !this.submitting;
  }

  // ── File handling ────────────────────────────────────
  onFileSelected(ev: Event) {
    const el = ev.target as HTMLInputElement;
    if (!el.files?.length) return;
    const file = el.files[0];
    this.paymentProofFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      this.paymentProofPreview = (e.target?.result as string) || null;
      this.cd.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  clearFile() {
    this.paymentProofFile = null;
    this.paymentProofPreview = null;
  }

  async uploadProof(): Promise<string> {
    if (!this.paymentProofFile || !this.campaignId) return '';
    try {
      const fd = new FormData();
      fd.append('file', this.paymentProofFile);
      const res: any = await firstValueFrom(
        this.http.post(`${environment.apiBaseUrl}/campaign-invites/${this.campaignId}/upload-image`, fd)
      );
      return res?.data?.url || res?.url || '';
    } catch {
      return '';
    }
  }

  // ── API actions ──────────────────────────────────────
  async calculate() {
    if (!this.campaignId) return;
    this.loading = true;
    this.error = '';
    try {
      const res: any = await firstValueFrom(this.config.calculateCampaignPayment(this.campaignId));
      this.calculated = res?.data || res;
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'Failed to calculate payment';
    } finally {
      this.loading = false;
      this.cd.markForCheck();
    }
  }

  async fetchStatus() {
    if (!this.campaignId) return;
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const res = await firstValueFrom(
        this.txApi.getCampaignTransactionStatus(this.campaignId, headers)
      );
      this.statusTransactions = res?.data || [];
    } catch {
      this.statusTransactions = [];
    } finally {
      this.cd.markForCheck();
    }
  }

  async submitProof() {
    if (!this.campaignId) return;
    if (!this.utrNumber.trim()) {
      this.error = 'Please enter the UTR / transaction id.';
      return;
    }
    this.submitting = true;
    this.error = '';
    try {
      if (this.paymentProofFile) {
        this.paymentProofUrl = await this.uploadProof();
        if (!this.paymentProofUrl) {
          this.error = 'Failed to upload payment proof. Please try again.';
          return;
        }
      }
      const payload = { utrNumber: this.utrNumber.trim(), paymentProofUrl: this.paymentProofUrl };
      await firstValueFrom(this.config.submitCampaignPaymentProof(this.campaignId, payload));
      this.successMessage = 'Payment proof submitted! Verification usually takes 6–10 hours. We\'ll notify you once confirmed.';
      await this.fetchStatus();
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'Failed to submit proof';
    } finally {
      this.submitting = false;
      this.cd.markForCheck();
    }
  }
}

