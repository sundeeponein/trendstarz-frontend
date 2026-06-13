// Helper for template to cast string to DurationType
// Helper for template to cast string to DurationType
type DurationType = '1m' | '3m' | '1y' | '';
export function toDurationType(val: string): DurationType {
  if (val === '1m' || val === '3m' || val === '1y' || val === '') return val as DurationType;
  return '';
}
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
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PlansService, Plan } from '../../shared/plans.service';
import { PaymentCheckoutComponent, BreakdownRow } from '../../shared/payment-checkout/payment-checkout.component';
import { MonetizationApiService } from '../../services/monetization-api.service';




@Component({
  selector: 'app-premium-upgrade',
  standalone: true,
  imports: [CommonModule, FormsModule, PaymentCheckoutComponent],
  templateUrl: './premium-upgrade.component.html',
  styleUrls: ['./premium-upgrade.component.scss'],
})
export class PremiumUpgradeComponent implements OnInit, OnDestroy {
      // --- ₹ Savings for UI ---
    selectedDuration: any = null;
    selectedRole: string = 'influencer';
    upgrading = false;
    processingRazorpay = false;
    upgradeError = '';
    upiCopied = false;
    upiRef: string = '';
    couponCode: string = '';
    couponApplied = false;
    couponError = '';
    discountAmount = 0;
    planDiscountPercent = 0;
    myPayments: any[] = [];
    discountLabel?: string;
    readonly upiId = 'trendstarzin@kotak';
    readonly isProduction = environment.production;

    readonly durations = [
      { key: '1m', label: '1 Month', sublabel: '', priceKey: 'monthly' },
      { key: '3m', label: '3 Months', sublabel: 'Save 10%', priceKey: 'monthly3' },
      { key: '1y', label: '1 Year', sublabel: 'Best value', priceKey: 'yearly' },
    ];
    selectedDurationKey: string = '1m';

    get monthSavings(): number {
      return (this.selectedPlan?.price.monthly ?? 0) * 1 - (this.selectedPlan?.price.monthly ?? 0);
    }
    get quarterlySavings(): number {
      return (this.selectedPlan?.price.monthly ?? 0) * 3 - (this.selectedPlan?.price.quarterly ?? 0);
    }
    get yearlySavings(): number {
      return (this.selectedPlan?.price.monthly ?? 0) * 12 - (this.selectedPlan?.price.yearly ?? 0);
    }

    constructor(
      private http: HttpClient,
      private router: Router,
      private cdr: ChangeDetectorRef,
      private plansService: PlansService,
      private monetizationApi: MonetizationApiService,
      @Inject(PLATFORM_ID) private platformId: object,
    ) {}

    ngOnInit(): void {
      this.loadMyPayments();
      // Set selectedRole based on logged-in user
      const user = this.getCurrentUser();
      if (user?.role === 'brand') {
        this.selectedRole = 'brand';
      } else if (user?.role === 'photographer') {
        this.selectedRole = 'photographer';
      } else {
        this.selectedRole = 'influencer';
      }
      // Fetch plans from API
      this.plansService.getActivePlans(this.selectedRole).subscribe((plans: Plan[]) => {
        this.plans = plans;
        const paidPlan = plans.find(p => p.price.monthly > 0) ?? plans[0];
        if (paidPlan) {
          this.selectedPlan = paidPlan;
          this.selectedDurationKey = '1m';
          this.updateDuration();
          this.applyPlanDiscount();
        }
        this.cdr.detectChanges();
      });
    }
  step: 'plan' | 'payment' | 'success' = 'plan';
  paymentTab: 'upi' | 'qr' = 'upi';
  plans: Plan[] = [];
  selectedPlan: Plan | null = null;

  // Select a plan and duration
  selectPlan(plan: Plan, duration: any) {
    this.selectedPlan = plan;
    this.selectedDuration = duration;
  }

  // Select a plan card (called from template click)
  selectPlanCard(plan: Plan) {
    this.selectedPlan = plan;
    this.selectedDurationKey = '1m';
    this.updateDuration();
    this.resetCoupon();
    this.applyPlanDiscount();
  }

  // Select a duration key (1m, 3m, 1y)
  selectDuration(key: string) {
    this.selectedDurationKey = key;
    this.updateDuration();
    this.resetCoupon();
    this.applyPlanDiscount();
  }

  updateDuration() {
    const plan = this.selectedPlan;
    if (!plan) return;
    // Map duration key to price and offer
    let price = 0;
    let label = '';
    let offerKey = '';
    if (this.selectedDurationKey === '1y') {
      price = plan.price.yearly;
      label = 'Yearly';
      offerKey = 'discountYearly';
    } else if (this.selectedDurationKey === '3m') {
      price = plan.price.quarterly;
      label = '3 Months';
      offerKey = 'discountQuarterly';
    } else {
      price = plan.price.monthly;
      label = 'Monthly';
      offerKey = 'discountMonthly';
    }
    this.selectedDuration = { key: this.selectedDurationKey, label, price };

    // Find admin-configured discount for this duration
    let discountPercent = 0;
    if (plan.offers && Array.isArray(plan.offers)) {
      // Look for a matching offer key (e.g., discountMonthly, discountQuarterly, discountYearly)
      const offer = plan.offers.find((o: any) => o.key === offerKey);
      if (offer && offer.value > 0) {
        discountPercent = offer.value;
      }
    }
    // Store the discount percent for use in calculation
    this.planDiscountPercent = discountPercent;
    this.applyPlanDiscount();
  }

  applyPlanDiscount() {
    // Reset discount
    this.planDiscountPercent = 0;
    this.discountLabel = this.selectedPlan?.discountLabel || '';
    if (!this.selectedPlan || !this.selectedPlan.offers) return;
    // Robust: check both discount keys for both roles
    const discountKeys = ["discountOnBrandPro", "discountOnInfluencerPro", "discountOnPhotographerPro"];
    let offer = this.selectedPlan.offers.find((o: any) => discountKeys.includes(o.key) && o.value > 0);
    if (offer) {
      this.planDiscountPercent = offer.value;
      // Only apply if no coupon is applied
      if (!this.couponApplied) {
        this.discountAmount = Math.round((this.selectedDuration?.price ?? 0) * (offer.value / 100));
      }
    } else if (!this.couponApplied) {
      this.discountAmount = 0;
    }
  }

  get finalPrice(): number {
    return Math.max(0, (this.selectedDuration?.price ?? 0)  - this.discountAmount);
  }

  // Breakdown rows for shared <app-payment-checkout>
  get paymentBreakdown(): BreakdownRow[] {
    const dur = this.selectedDuration;
    if (!dur) return [];
    const rows: BreakdownRow[] = [
      { label: this.selectedPlan?.name + ' · ' + (dur.label || ''), value: '₹' + dur.price },
    ];
    if (this.discountAmount > 0) {
      const label = this.couponApplied
        ? 'Coupon discount'
        : (this.discountLabel || `Discount (${this.planDiscountPercent}%)`);
      rows.push({ label, value: '− ₹' + this.discountAmount, free: true });
    }
    rows.push({ label: 'Total', value: '₹' + this.finalPrice, strong: true });
    return rows;
  }

  get paymentTransactionNote(): string {
    return (this.selectedPlan?.name || 'TrendstarZ') + ' Premium';
  }

  getContactVisibilityLabel(plan: Plan): string {
    const featureKey = plan.userType === 'BRAND' ? 'viewContactDetails' : 'contactVisibility';
    const feature = plan.features?.find(f => f.key === featureKey);
    if (!feature?.value) {
      return 'Contact details hidden';
    }
    return plan.userType === 'BRAND'
      ? 'Unlock influencer contact details (per invite)'
      : 'Contact details visible to brands';
  }

  applyCoupon() {
    this.couponError = '';
    // Simple coupon: TRENDSTARZ10 = 10% off
    const code = this.couponCode.trim().toUpperCase();
    if (code === 'TRENDSTARZ10') {
      this.discountAmount = Math.round((this.selectedDuration?.price ?? 0) * 0.1);
      this.couponApplied = true;
    } else if (code === 'TRENDSTARZ20') {
      this.discountAmount = Math.round((this.selectedDuration?.price ?? 0) * 0.2);
      this.couponApplied = true;
    } else {
      this.couponError = 'Invalid or expired coupon code.';
      this.couponApplied = false;
      // Re-apply plan discount if coupon is removed
      this.applyPlanDiscount();
    }
  }

  resetCoupon() {
    this.couponCode = '';
    this.couponApplied = false;
    this.couponError = '';
    this.applyPlanDiscount();
  }


  loadMyPayments() {
    const token = this.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http.get(`${environment.apiBaseUrl}/payment/my`, { headers }).subscribe({
      next: (res: any) => {
        this.myPayments = Array.isArray(res?.payments) ? res.payments : [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.myPayments = [];
      },
    });
  }

  ngOnDestroy() {
    // Cleanup if needed
  }



  public get upiQrUrl(): string {
    const plan = this.selectedPlan;
    if (!plan || !this.selectedDuration) return '';
    // Use finalPrice for QR
    const upiString = `upi://pay?pa=${this.upiId}&pn=TrendstarZ&am=${this.finalPrice}&cu=INR&tn=${encodeURIComponent(plan.name + ' Premium')}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiString)}`;
  }




  // Returns the CTA label for the upgrade button
  public getCtaLabel(): string {
    if (!this.selectedPlan || !this.selectedDuration) return 'Proceed to Payment →';
    if (this.selectedDuration.price === 0) return 'Continue with Free Plan →';
    return `Proceed to Payment →`;
  }

  public goToPayment() {
    if (!this.selectedDuration) {
      this.upgradeError = 'Please select a plan to continue.';
      return;
    }
    this.upgradeError = '';
    this.upiRef = '';
    this.step = 'payment';
    this.paymentTab = 'upi'; // ← Start with UPI tab
  }

  public setTab(tab: 'upi' | 'qr') {
    this.paymentTab = tab;
    this.upgradeError = '';
  }

  // ─── UPI / QR manual fallback ─────────────────────────────────────────────
  public payByUpi() {
    if (!this.upiRef.trim()) {
      this.upgradeError = 'Please enter the UPI Transaction ID after completing payment.';
      return;
    }
    this.upgrading = true;
    this.upgradeError = '';
    this.recordUpiPayment();
  }

  public copyUpiId() {
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
    const userType = user?.role === 'brand'
      ? 'Brand'
      : user?.role === 'photographer'
        ? 'Photographer'
        : 'Influencer';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http
      .post(
        `${environment.apiBaseUrl}/payment`,
        {
          transactionId: this.upiRef.trim(),
          premiumDuration: this.selectedDuration?.key ?? this.selectedDuration,
          userType,
          paymentMethod: this.paymentTab,
          couponCode: this.couponApplied ? this.couponCode.trim().toUpperCase() : undefined,
          finalAmount: this.finalPrice,
        },
        { headers },
      )
      .subscribe({
        next: () => this.onSuccess(),
        error: (err) => {
          this.upgrading = false;
          this.upgradeError = err?.error?.message || 'Failed to record payment. Please try again.';
          this.cdr.detectChanges();
        },
      });
  }

  private async ensureRazorpayLoaded(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;
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

  async payByRazorpay() {
    if (!this.selectedPlan) {
      this.upgradeError = 'Please select a plan first.';
      return;
    }
    this.processingRazorpay = true;
    this.upgradeError = '';
    try {
      const billingCycle =
        this.selectedDurationKey === '1y'
          ? 'yearly'
          : this.selectedDurationKey === '3m'
            ? 'quarterly'
            : 'monthly';
      const orderRes = await firstValueFrom(
        this.monetizationApi.createSubscriptionOrder(
          String((this.selectedPlan as any)?._id || ''),
          billingCycle,
        ),
      );
      const order = orderRes?.order;
      if (!order?.orderId || !order?.keyId) {
        this.upgradeError = 'Failed to initialize Razorpay order.';
        return;
      }

      const loaded = await this.ensureRazorpayLoaded();
      if (!loaded) {
        this.upgradeError = 'Failed to load Razorpay checkout.';
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const rz = new (window as any).Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'TrendstarZ',
          description: 'Premium subscription',
          order_id: order.orderId,
          handler: async (resp: any) => {
            try {
              await firstValueFrom(
                this.monetizationApi.verifyRazorpayPayment({
                  orderId: resp?.razorpay_order_id,
                  paymentId: resp?.razorpay_payment_id,
                  signature: resp?.razorpay_signature,
                  paymentType: 'subscription',
                }),
              );
              this.onSuccess();
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
    } catch (err: any) {
      this.upgradeError = err?.message || err?.error?.message || 'Razorpay payment failed. Please use manual UPI.';
    } finally {
      this.processingRazorpay = false;
      this.cdr.detectChanges();
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private onSuccess() {
    this.upgrading = false;
    this.step = 'success';
    this.cdr.detectChanges();
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
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  private getCurrentUser(): any {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch { return {}; }
  }

  public goToProfile() {
    if (!isPlatformBrowser(this.platformId)) return;
    const user = this.getCurrentUser();
    if (user?.role === 'brand') {
      this.router.navigate(['/brand-profile']);
      return;
    }
    if (user?.role === 'photographer') {
      this.router.navigate(['/photographer-profile']);
      return;
    }
    this.router.navigate(['/influencer-profile']);
  }
}
