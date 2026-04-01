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

@Component({
  selector: 'app-premium-upgrade',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './premium-upgrade.component.html',
  styleUrls: ['./premium-upgrade.component.scss'],
})
export class PremiumUpgradeComponent implements OnDestroy {
  step: 'plan' | 'payment' | 'success' = 'plan';
  paymentTab: 'upi' | 'qr' = 'upi'; // ← Primary: direct UPI only (no Razorpay)

  selectedDuration: '1m' | '3m' | '1y' | '' = '';
  upgrading = false;
  upgradeError = '';

  // UPI / QR direct payment
  upiRef = '';
  upiCopied = false;

  plans = [
    { duration: '1m' as const, label: '1 Month',  price: '₹399',   amount: 39900,  badge: '',           pricePer: '₹399/mo'  },
    { duration: '3m' as const, label: '3 Months', price: '₹999',   amount: 99900,  badge: 'Save 16%',   pricePer: '₹333/mo'  },
    { duration: '1y' as const, label: '1 Year',   price: '₹2,999', amount: 299900, badge: 'Best Value',  pricePer: '₹250/mo'  },
  ];

  // ⬇️ REPLACE WITH YOUR UPI ID ⬇️
  // Format: 'yourname@bank' (e.g., 'sundeep@okhdfcbank' or 'sundeep@ybl')
  readonly upiId = 'trendstarzin@kotak'; // ← CHANGE THIS TO YOUR UPI ID
  readonly isProduction = environment.production;

  // Optional: Use a static QR image URL instead of generating dynamically
  // readonly staticQrImageUrl = 'https://your-domain.com/qr-code.png'; // Uncomment if you have a pre-generated QR image

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnDestroy() {
    // Cleanup if needed
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
    this.paymentTab = 'upi'; // ← Start with UPI tab
  }

  setTab(tab: 'upi' | 'qr') {
    this.paymentTab = tab;
    this.upgradeError = '';
  }

  // ─── UPI / QR manual fallback ─────────────────────────────────────────────
  payByUpi() {
    if (!this.upiRef.trim()) {
      this.upgradeError = 'Please enter the UPI Transaction ID after completing payment.';
      return;
    }
    this.upgrading = true;
    this.upgradeError = '';
    this.recordUpiPayment();
  }

  copyUpiId() {
    if (isPlatformBrowser(this.platformId)) {
      navigator.clipboard.writeText(this.upiId).then(() => {
        this.upiCopied = true;
        setTimeout(() => (this.upiCopied = false), 2000);
      });
    }
  }

  private recordUpiPayment() {
    const token = this.getToken();
    if (!token) { this.upgradeError = 'Not logged in.'; this.upgrading = false; return; }
    const user = this.getCurrentUser();
    const userType = user?.role === 'brand' ? 'Brand' : 'Influencer';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http
      .post(
        `${environment.apiBaseUrl}/payment`,
        {
          transactionId: this.upiRef.trim(),
          premiumDuration: this.selectedDuration,
          userType,
          paymentMethod: this.paymentTab,
        },
        { headers },
      )
      .subscribe({
        next: () => this.onSuccess(),
        error: (err) => {
          this.upgrading = false;
          this.upgradeError = err?.error?.message || 'Failed to record payment. Please try again.';
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

  goToProfile() {
    if (!isPlatformBrowser(this.platformId)) return;
    const user = this.getCurrentUser();
    this.router.navigate([user?.role === 'brand' ? '/brand-profile' : '/influencer-profile']);
  }
}

