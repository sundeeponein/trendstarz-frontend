import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../config.service';
import { hasValidUpiId, upiIdError } from '../upi.util';

export type PayoutDetails = { upiId: string; mobile: string; accountHolderName: string };

const DISMISS_KEY = 'tsz_upi_prompt_later';

/**
 * Dashboard ask after sign-in: creators without a valid UPI ID add it here, so paid
 * invites can be accepted (and paid) without surprises. "Later" hides it until the
 * next sign-in (this browser session).
 */
@Component({
  selector: 'app-payout-upi-banner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pub" *ngIf="visible">
      <div class="pub-title"><i class="bi bi-bank"></i> {{ savedUpiInvalid ? 'Please fix your UPI ID' : 'Add your UPI ID to get paid' }}</div>
      <p class="pub-sub" *ngIf="savedUpiInvalid">
        Your saved UPI ID <strong>{{ payout.upiId }}</strong> doesn't look right, so payouts can't be sent to it.
      </p>
      <p class="pub-sub">
        TrendStarZ sends payouts for paid collaborations to your UPI ID. You'll need it to accept paid invites.
        Payouts are sent after you submit your post link and it's approved.
      </p>
      <div class="pub-form">
        <input type="text" class="form-control form-control-sm" placeholder="UPI ID, e.g. 9876543210@ybl"
               [(ngModel)]="upiId" autocomplete="off" autocapitalize="off" spellcheck="false" />
        <input type="text" class="form-control form-control-sm" placeholder="Name on your UPI / bank account"
               [(ngModel)]="name" autocomplete="off" />
      </div>
      <div class="pub-error" *ngIf="error">{{ error }}</div>
      <p class="pub-hint">Please double-check it — a payout sent to a wrong UPI ID can't be pulled back.</p>
      <div class="pub-actions">
        <button type="button" class="btn btn-sm btn-primary" [disabled]="busy" (click)="save()">Save UPI ID</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="busy" (click)="later()">Later</button>
      </div>
    </div>
  `,
  styles: [
    `
      .pub { margin-bottom: 16px; padding: 12px 14px; border-radius: 12px; border: 1px solid #fcd34d; background: #fffbeb; color: #1e293b; }
      .pub-title { font-weight: 700; }
      .pub-sub { margin: 2px 0 6px; font-size: 13px; color: #475569; }
      .pub-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 4px; }
      @media (max-width: 576px) { .pub-form { grid-template-columns: 1fr; } }
      .pub-error { font-size: 12px; color: #c62828; margin-bottom: 4px; }
      .pub-hint { margin: 0 0 8px; font-size: 12px; color: #64748b; }
      .pub-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      :host-context([data-theme='dark']) .pub { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.35); color: #e2e8f0; }
      :host-context([data-theme='dark']) .pub-sub, :host-context([data-theme='dark']) .pub-hint { color: #cbd5e1; }
    `,
  ],
})
export class PayoutUpiBannerComponent {
  @Input() role: 'influencer' | 'photographer' = 'influencer';
  /** True once the profile has loaded (avoids flashing the ask before we know). */
  @Input() ready = false;
  @Input() set payout(v: PayoutDetails | null | undefined) {
    this._payout = v || { upiId: '', mobile: '', accountHolderName: '' };
    if (!this.touched) {
      this.upiId = this._payout.upiId || '';
      this.name = this._payout.accountHolderName || '';
    }
  }
  get payout(): PayoutDetails {
    return this._payout;
  }
  @Output() saved = new EventEmitter<PayoutDetails>();

  private _payout: PayoutDetails = { upiId: '', mobile: '', accountHolderName: '' };
  upiId = '';
  name = '';
  error = '';
  busy = false;
  done = false;
  dismissed = readDismissed();
  private touched = false;

  constructor(private config: ConfigService, private cdr: ChangeDetectorRef) {}

  get visible(): boolean {
    return this.ready && !this.done && !this.dismissed && !hasValidUpiId(this.payout.upiId);
  }

  get savedUpiInvalid(): boolean {
    return !!(this.payout.upiId || '').trim() && !!upiIdError(this.payout.upiId);
  }

  save(): void {
    if (this.busy) return;
    this.touched = true;
    const upiId = this.upiId.trim().toLowerCase();
    this.error = upiIdError(upiId) || (upiId ? '' : 'Please enter your UPI ID.');
    if (this.error) return;
    const payout: PayoutDetails = {
      upiId,
      mobile: this.payout.mobile || '',
      accountHolderName: this.name.trim() || this.payout.accountHolderName || '',
    };
    this.busy = true;
    this.config.savePayoutDetails(this.role, payout).subscribe({
      next: () => {
        this.busy = false;
        this.done = true;
        this.saved.emit(payout);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.busy = false;
        this.error = err?.error?.message || "Couldn't save your UPI ID. Please try again.";
        this.cdr.markForCheck();
      },
    });
  }

  later(): void {
    this.dismissed = true;
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage blocked: hides for this page view only */
    }
  }
}

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}
