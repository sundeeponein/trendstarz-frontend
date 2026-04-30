import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../shared/config.service';
import { PaymentCheckoutComponent, BreakdownRow } from '../../shared/payment-checkout/payment-checkout.component';

@Component({
  selector: 'app-campaign-pay',
  standalone: true,
  imports: [CommonModule, RouterModule, PaymentCheckoutComponent],
  templateUrl: './campaign-pay.component.html',
  styleUrls: ['./campaign-pay.component.scss']
})
export class CampaignPayComponent implements OnInit {
  campaignId = '';
  loading = true;
  error = '';
  calculated: any = null;

  gstPercent = 18;

  totalRupees = 0;
  breakdown: BreakdownRow[] = [];
  trustLabels: string[] = [];
  chip = '';
  subtitle = '';

  constructor(
    private route: ActivatedRoute,
    private config: ConfigService,
    private cd: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    this.campaignId = this.route.snapshot.paramMap.get('campaignId') || '';
    if (!this.campaignId) {
      this.error = 'Missing campaign id.';
      this.loading = false;
      return;
    }

    this.config.getAppSettings().subscribe({
      next: (s: any) => {
        if (s?.gstPercent !== undefined) this.gstPercent = s.gstPercent;
        this.recompute();
        this.cd.markForCheck();
      },
      error: () => {}
    });

    try {
      const res: any = await firstValueFrom(this.config.calculateCampaignPayment(this.campaignId));
      this.calculated = res?.data || res;
      this.recompute();
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'Failed to load payment details';
    } finally {
      this.loading = false;
      this.cd.markForCheck();
    }
  }

  private p2r(v: number | undefined | null): number { return Number(v || 0) / 100; }
  private fmt(rupees: number): string {
    return '₹' + Number(rupees || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  private recompute() {
    if (!this.calculated) return;
    const c = this.calculated;
    const accepted = Number(c.acceptedCount || 0);
    const platformFee = this.p2r(c.platformFee);
    const gst = Math.round(platformFee * (this.gstPercent / 100));
    this.totalRupees = this.p2r(c.payerTotal) + gst;

    const rows: BreakdownRow[] = [
      { label: 'Price per influencer', value: this.fmt(this.p2r(c.pricePerInfluencer)) },
      { label: 'Accepted influencers', value: '× ' + accepted },
      { label: 'Agreed amount', value: this.fmt(this.p2r(c.agreedAmount)), strong: true },
      c.platformFeeEnabled
        ? { label: `Platform fee (${c.platformFeePercent}%)`, value: this.fmt(platformFee) }
        : { label: 'Platform fee', value: 'Free during launch', free: true },
    ];
    if (gst > 0) rows.push({ label: `GST (${this.gstPercent}%)`, value: this.fmt(gst) });
    this.breakdown = rows;

    this.trustLabels = c.trustLabels || [];

    const typeMap: Record<string, string> = {
      paid_collab: 'Paid Collaboration',
      product: 'Product Collaboration',
      invite_location: 'Invite to Location',
      pay_to_join: 'Pay to Join',
    };
    this.chip = typeMap[(c.campaignType || '').toLowerCase()] || 'Campaign';
    this.subtitle = `${accepted} accepted influencer${accepted === 1 ? '' : 's'}`;
  }

  get transactionNote(): string {
    return `Campaign payment ${this.campaignId.slice(-6).toUpperCase()}`;
  }

  readonly nextSteps = [
    'Note the <strong>UTR / transaction id</strong> shown by your UPI app.',
    'Return to the <strong>Campaigns</strong> page and click <strong>Record Payment</strong>.',
    'Go to <strong>Submit Payment</strong> tab, enter UTR, upload screenshot.',
    'Our team verifies within 24 hours.',
  ];
}
