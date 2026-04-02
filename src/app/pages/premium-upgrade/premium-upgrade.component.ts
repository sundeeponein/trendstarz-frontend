
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ChangeDetectorRef,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PlansService, Plan, PlanCapabilities, FREE_CAPABILITIES } from '../../shared/plans.service';

@Component({
  selector: 'app-premium-upgrade',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './premium-upgrade.component.html',
  styleUrls: ['./premium-upgrade.component.scss'],
})
export class PremiumUpgradeComponent implements OnInit, OnDestroy {

  step: 'plan' | 'payment' | 'success' = 'plan';
  paymentTab: 'upi' | 'qr' = 'upi';
  selectedDuration: '1m' | '3m' | '1y' | '' = '';
  upgrading = false;
  upgradeError = '';
  upiCopied = false;
  upiRef: string = '';
  plans = [
    { duration: '1m' as const, label: '1 Month',  price: '₹399',   amount: 39900,  badge: '',           pricePer: '₹399/mo'  },
    { duration: '3m' as const, label: '3 Months', price: '₹999',   amount: 99900,  badge: 'Save 16%',   pricePer: '₹333/mo'  },
    { duration: '1y' as const, label: '1 Year',   price: '₹2,999', amount: 299900, badge: 'Best Value',  pricePer: '₹250/mo'  },
  ];
  readonly upiId = 'trendstarzin@kotak';
  readonly isProduction = environment.production;
  myPayments: any[] = [];

  // Dynamic plan features from backend
  activePlan: Plan | null = null;
  myCapabilities: PlanCapabilities = FREE_CAPABILITIES;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private plansService: PlansService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit(): void {
    this.loadMyPayments();
    this.loadPlanInfo();
  }

  loadPlanInfo() {
    const user = this.getCurrentUser();
    const userType = user?.role === 'brand' ? 'BRAND' : 'INFLUENCER';
    this.plansService.getActivePlans(userType).subscribe(plans => {
      this.activePlan = plans[0] ?? null;
      this.cdr.markForCheck();
    });
    this.plansService.getMyCapabilities().subscribe(caps => {
      this.myCapabilities = caps;
      this.cdr.markForCheck();
    });
  }

  get planFeatures() { return this.activePlan?.features ?? []; }
  get planLimits() { return this.activePlan?.limits ?? []; }
  get retentionDays() { return this.activePlan?.policies?.imageRetentionDaysAfterExpiry ?? 45; }
  get maxImages() { return this.plansService.getLimitValue(this.myCapabilities, 'maxImages'); }

  loadMyPayments() {
    const token = this.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http.get(`${environment.apiBaseUrl}/payment/my`, { headers }).subscribe({
      next: (res: any) => {
        this.myPayments = Array.isArray(res?.payments) ? res.payments : [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.myPayments = [];
      },
    });
  }

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
    // Show a toast/snackbar for instant feedback
    if (isPlatformBrowser(this.platformId)) {
      const toast = document.createElement('div');
      toast.innerText = 'Payment recorded! Pending admin approval.';
      toast.style.position = 'fixed';
      toast.style.bottom = '32px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = '#323232';
      toast.style.color = '#fff';
      toast.style.padding = '16px 32px';
      toast.style.borderRadius = '8px';
      toast.style.fontSize = '1.1rem';
      toast.style.zIndex = '9999';
      toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }
    // Delay redirect to profile for 7 seconds
    setTimeout(() => this.goToProfile(), 7000);
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

