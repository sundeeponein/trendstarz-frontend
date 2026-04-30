import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConfigService } from '../../shared/config.service';

type Tab = 'summary' | 'pay';

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
  commissionPercent = 10;
  gstPercent = 18;

  constructor(private http: HttpClient, private config: ConfigService, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.config.getAppSettings().subscribe({
      next: (s: any) => {
        if (s?.platformFeePercent !== undefined) this.commissionPercent = s.platformFeePercent;
        if (s?.gstPercent !== undefined) this.gstPercent = s.gstPercent;
        this.cd.markForCheck();
      },
      error: () => {}
    });
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['visible'] && this.visible && this.campaignId) {
      this.resetState();
      this.calculate();
    }
  }

  private resetState() {
    this.error = '';
    this.successMessage = '';
    this.utrNumber = '';
    this.paymentProofFile = null;
    this.paymentProofUrl = '';
    this.paymentProofPreview = null;
    this.activeTab = 'summary';
  }

  setTab(t: Tab) { this.activeTab = t; }

  openPayInNewTab() {
    if (!this.campaignId) return;
    const url = `/campaign-pay/${this.campaignId}`;
    window.open(url, '_blank', 'noopener');
    // Move user to the proof-submission tab so they can enter UTR after paying.
    this.setTab('pay');
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
    // Backend stores money in paise; convert to rupees for display.
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
    return !!this.utrNumber.trim() && !!this.paymentProofFile && !this.submitting;
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

  async submitProof() {
    if (!this.campaignId) return;
    if (!this.utrNumber.trim()) {
      this.error = 'Please enter the UTR / transaction id.';
      return;
    }
    if (!this.paymentProofFile) {
      this.error = 'Please attach the payment proof screenshot.';
      return;
    }
    this.submitting = true;
    this.error = '';
    try {
      this.paymentProofUrl = await this.uploadProof();
      if (!this.paymentProofUrl) {
        this.error = 'Failed to upload payment proof. Please try again.';
        return;
      }
      const payload = { utrNumber: this.utrNumber.trim(), paymentProofUrl: this.paymentProofUrl };
      await firstValueFrom(this.config.submitCampaignPaymentProof(this.campaignId, payload));
      this.successMessage = 'Payment proof submitted. Our team will verify and update the status shortly.';
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'Failed to submit proof';
    } finally {
      this.submitting = false;
      this.cd.markForCheck();
    }
  }
}
