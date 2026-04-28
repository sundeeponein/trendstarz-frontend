import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConfigService } from '../../shared/config.service';

@Component({
  selector: 'app-campaign-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campaign-payment.component.html',
  styleUrls: ['./campaign-payment.component.scss']
})
export class CampaignPaymentComponent implements OnInit {
  @Input() campaignId?: string | null = null;
  @Input() visible = false; // show/hide from parent
  @Output() visibleChange = new EventEmitter<boolean>();

  loading = false;
  error = '';
  calculated: any = null;

  utrNumber = '';
  paymentProofFile: File | null = null;
  paymentProofUrl = '';

  // allow admin-configurable commission/GST but default values are here
  commissionPercent = 10; // platform fee percent
  gstPercent = 18; // GST percent

  constructor(private http: HttpClient, private config: ConfigService, private cd: ChangeDetectorRef) {}
  
  ngOnInit(): void {
    // load admin-configured commission/GST if available
    this.config.getAppSettings().subscribe({
      next: (s: any) => {
        if (s?.platformFeeEnabled !== undefined) this.commissionPercent = s.platformFeePercent ?? this.commissionPercent;
        if (s?.gstPercent !== undefined) this.gstPercent = s.gstPercent ?? this.gstPercent;
        this.cd.markForCheck();
      },
      error: () => {}
    });
  }

  close() { this.visible = false; this.visibleChange.emit(false); }

  onFileSelected(ev: Event) {
    const el = ev.target as HTMLInputElement;
    if (el.files && el.files.length) this.paymentProofFile = el.files[0];
  }

  async uploadProof(): Promise<string> {
    if (!this.paymentProofFile) return '';
    const file = this.paymentProofFile;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res: any = await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/campaign-invites/${this.campaignId}/upload-image`, fd));
      return res.data?.url || res.url || '';
    } catch (e) {
      return '';
    }
  }

  async calculate() {
    if (!this.campaignId) return;
    this.loading = true; this.error = '';
    try {
      const res: any = await firstValueFrom(this.config.calculateCampaignPayment(this.campaignId));
      // Apply commission and GST if response doesn't include them
      res.platformFeePercent = res.platformFeePercent ?? this.commissionPercent;
      res.gstPercent = res.gstPercent ?? this.gstPercent;
      // compute gst on platform fee
      res.platformFee = res.agreedAmount * (res.platformFeePercent / 100);
      res.gst = res.platformFee * (res.gstPercent / 100);
      res.payerTotal = (res.agreedAmount + res.platformFee + res.gst) || res.payerTotal;
      this.calculated = res;
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'Failed to calculate payment';
    } finally { this.loading = false; this.cd.markForCheck(); }
  }

  async submitProof() {
    if (!this.campaignId) return;
    this.loading = true; this.error = '';
    try {
      if (this.paymentProofFile) {
        this.paymentProofUrl = await this.uploadProof();
      }
      const payload: any = { utrNumber: this.utrNumber };
      if (this.paymentProofUrl) payload.paymentProofUrl = this.paymentProofUrl;
      const res: any = await firstValueFrom(this.config.submitCampaignPaymentProof(this.campaignId, payload));
      this.calculated = res?.data || res;
      this.visible = false;
      this.visibleChange.emit(false);
      alert('Payment proof submitted. Our team will verify and update the status.');
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'Failed to submit proof';
    } finally { this.loading = false; this.cd.markForCheck(); }
  }
}
