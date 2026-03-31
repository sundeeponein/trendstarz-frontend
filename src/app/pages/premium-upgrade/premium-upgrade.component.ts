import {
  Component,
  OnDestroy,
  PLATFORM_ID,
  Inject,
  ChangeDetectorRef,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

// Razorpay is loaded via CDN script — declare for TypeScript
declare const Razorpay: any;

@Component({
  selector: 'app-premium-upgrade',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './premium-upgrade.component.html',
  styleUrls: ['./premium-upgrade.component.scss'],
})
export class PremiumUpgradeComponent implements OnDestroy {
  step: 'plan' | 'payment' | 'success' = 'plan';
  paymentTab: 'card' | 'upi' | 'qr' = 'card';

  selectedDuration: '1m' | '3m' | '1y' | '' = '';
  upgrading = false;
  upgradeError = '';
  loadingOrder = false;

  // UPI / QR manual fallback
  upiRef = '';
  upiCopied = false;

  plans = [
    { duration: '1m' as const, label: '1 Month',  price: '₹399',   amount: 39900,  badge: '',           pricePer: '₹399/mo'  },
    { duration: '3m' as const, label: '3 Months', price: '₹999',   amount: 99900,  badge: 'Save 16%',   pricePer: '₹333/mo'  },
    { duration: '1y' as const, label: '1 Year',   price: '₹2,999', amount: 299900, badge: 'Best Value',  pricePer: '₹250/mo'  },
  ];

  readonly upiId = 'trendstarz@ybl'; // ← replace with your UPI merchant VPA
  readonly isProduction = environment.production;

  private rzpInstance: any = null;
  private rzpScriptLoaded = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnDestroy() {
    this.rzpInstance?.close?.();
  }

  get selectedPlan() {
    return this.plans.find(p => p.duration === this.selectedDuration) || null;
  }

  get upiQrUrl(): string {
    const plan = this.selectedPlan;
    if (!plan) return '';
    const upiString = `upi://pay?pa=${this.upiId}&pn=TrendstarZ&am=${plan.amount / 100}&cu=INR&tn=${encodeURIComponent(plan.label + ' Premium')}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiString)}`;
  }

  selectPlan(duration: '1m' | '3m' | '1y') {
    this.selectedDuration = duration;
    this.upgradeError = '';
  }

  goToPayment() {
    if (!this.selectedDuration) {
      this.upgradeError = 'Please select a plan to continue.';
      return;
    }
    this.upgradeError = '';
    this.upiRef = '';
    this.step = 'payment';
    this.paymentTab = 'card';
  }

  setTab(tab: 'card' | 'upi' | 'qr') {
    this.paymentTab = tab;
    this.upgradeError = '';
  }

  // ─── Razorpay Checkout (Card / Netbanking / Wallet / UPI via popup) ───────
  async openRazorpay() {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = this.getToken();
    if (!token) { this.upgradeError = 'Not logged in. Please refresh the page.'; return; }

    this.loadingOrder = true;
    this.upgradeError = '';

    try {
      await this.loadRazorpayScript();
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const order: any = await firstValueFrom(
        this.http.post(
          `${environment.apiBaseUrl}/payment/create-order`,
          { premiumDuration: this.selectedDuration },
          { headers },
        ),
      );
      this.loadingOrder = false;
      this.cdr.detectChanges();

      const user = this.getCurrentUser();
      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'TrendstarZ',
        description: `${this.selectedPlan?.label} Premium`,
        order_id: order.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phoneNumber || '',
        },
        theme: { color: '#f97316' },
        modal: {
          ondismiss: () => {
            this.upgradeError = 'Payment was cancelled. You can try again.';
            this.cdr.detectChanges();
          },
        },
        handler: (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          this.verifyAndActivate(
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature,
          );
        },
      };
      this.rzpInstance = new Razorpay(options);
      this.rzpInstance.on('payment.failed', (resp: any) => {
        this.upgradeError =
          resp?.error?.description || 'Payment failed. Please try again.';
        this.upgrading = false;
        this.cdr.detectChanges();
      });
      this.rzpInstance.open();
    } catch (err: any) {
      this.loadingOrder = false;
      this.upgradeError = err?.error?.message || 'Could not initiate payment. Please try again.';
    }
  }

  private verifyAndActivate(orderId: string, paymentId: string, signature: string) {
    this.upgrading = true;
    this.upgradeError = '';
    const token = this.getToken();
    if (!token) { this.upgradeError = 'Not logged in.'; this.upgrading = false; return; }

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http
      .post(
        `${environment.apiBaseUrl}/payment/verify-payment`,
        {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          premiumDuration: this.selectedDuration,
        },
        { headers },
      )
      .subscribe({
        next: () => this.onSuccess(),
        error: (err) => {
          this.upgrading = false;
          this.upgradeError =
            err?.error?.message || 'Payment verification failed. Please contact support.';
          this.cdr.detectChanges();
        },
      });
  }

  // ─── UPI / QR manual fallback ─────────────────────────────────────────────
  payByUpi() {
    if (!this.upiRef.trim()) {
      this.upgradeError = 'Please enter the UPI Transaction ID after completing payment.';
      return;
    }
    this.upgrading = true;
    this.upgradeError = '';
    this.directUpgrade();
  }

  copyUpiId() {
    if (isPlatformBrowser(this.platformId)) {
      navigator.clipboard.writeText(this.upiId).then(() => {
        this.upiCopied = true;
        setTimeout(() => (this.upiCopied = false), 2000);
      });
    }
  }

  private directUpgrade() {
    const token = this.getToken();
    if (!token) { this.upgradeError = 'Not logged in.'; this.upgrading = false; return; }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http
      .patch(
        `${environment.apiBaseUrl}/users/self/upgrade-premium`,
        { premiumDuration: this.selectedDuration },
        { headers },
      )
      .subscribe({
        next: () => this.onSuccess(),
        error: (err) => {
          this.upgrading = false;
          this.upgradeError = err?.error?.message || 'Upgrade failed. Please try again.';
        },
      });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private onSuccess() {
    this.upgrading = false;
    this.step = 'success';
    setTimeout(() => this.goToProfile(), 3000);
  }

  private getToken(): string | null {
    return isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : null;
  }

  private getCurrentUser(): any {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch { return {}; }
  }

  private loadRazorpayScript(): Promise<void> {
    if (this.rzpScriptLoaded || typeof Razorpay !== 'undefined') {
      this.rzpScriptLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => { this.rzpScriptLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
      document.body.appendChild(script);
    });
  }

  goToProfile() {
    if (!isPlatformBrowser(this.platformId)) return;
    const user = this.getCurrentUser();
    this.router.navigate([user?.role === 'brand' ? '/brand-profile' : '/influencer-profile']);
  }
}

