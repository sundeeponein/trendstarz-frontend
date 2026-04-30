import { Component, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable manual-UPI payment checkout block.
 * Used by:
 *   - /campaign-pay/:campaignId   (Campaign Payment, incl. Pay-to-Join)
 *   - /upgrade-premium             (Premium plan upgrade)
 *
 * TODO (post-MVP): Once a Razorpay merchant account is approved, replace
 * the UPI deep-link + manual UTR entry with a Razorpay Checkout flow that
 * auto-verifies the payment via webhook. The same Inputs (title, amount,
 * breakdown, transactionNote, nextSteps) can stay; only the "Pay" button
 * action needs to switch from upi:// to razorpay.open(options).
 */
export interface BreakdownRow {
  label: string;
  value: string;
  strong?: boolean;
  free?: boolean;
  hint?: string;
}

@Component({
  selector: 'app-payment-checkout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-checkout.component.html',
  styleUrls: ['./payment-checkout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentCheckoutComponent {
  /** Heading shown at top of card e.g. "Pay for Campaign". */
  @Input() title = 'Payment';
  /** Small line below title, e.g. "1 accepted influencer". */
  @Input() subtitle = '';
  /** Pill on the right of the title, e.g. "PAID COLLABORATION" or "PREMIUM PLAN". */
  @Input() chip = '';
  /** Amount to pay in rupees (already paise→rupee converted by caller). */
  @Input() amountRupees = 0;
  /** Optional breakdown rows shown above QR. */
  @Input() breakdown: BreakdownRow[] = [];
  /** Note shown to UPI app (`tn` field of upi:// link). */
  @Input() transactionNote = 'TrendstarZ payment';
  /** Fallback / custom UPI ID. */
  @Input() upiId = 'trendstarzin@kotak';
  @Input() payeeName = 'TrendstarZ';
  /** Bullets shown under "After paying:" — leave empty to hide section. */
  @Input() nextSteps: string[] = [];
  /** Optional small green trust labels (e.g. "Released after campaign approval"). */
  @Input() trustLabels: string[] = [];
  /** Hide outer card chrome when used embedded inside another container. */
  @Input() embedded = false;
  /** Hide the page-style card border (when embedded inside other card). */
  @Input() showBreakdown = true;

  upiCopied = false;
  amountCopied = false;

  constructor(private cd: ChangeDetectorRef) {}

  get amountFormatted(): string {
    return '₹' + Number(this.amountRupees || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  get upiPayLink(): string {
    return `upi://pay?pa=${this.upiId}&pn=${encodeURIComponent(this.payeeName)}&am=${this.amountRupees}&cu=INR&tn=${encodeURIComponent(this.transactionNote)}`;
  }

  get upiQrUrl(): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(this.upiPayLink)}`;
  }

  copyUpi() {
    navigator.clipboard?.writeText(this.upiId).then(() => {
      this.upiCopied = true;
      this.cd.markForCheck();
      setTimeout(() => { this.upiCopied = false; this.cd.markForCheck(); }, 1500);
    });
  }

  copyAmount() {
    navigator.clipboard?.writeText(String(this.amountRupees)).then(() => {
      this.amountCopied = true;
      this.cd.markForCheck();
      setTimeout(() => { this.amountCopied = false; this.cd.markForCheck(); }, 1500);
    });
  }
}
