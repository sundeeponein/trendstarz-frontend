import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { PlansService, Plan } from '../plans.service';
import { ConfigService } from '../config.service';
import { buildFounderOfferOptions, hasRealFounderOffer, FounderOfferOption } from './founder-offer.util';

const BENEFITS_BY_ROLE: Record<string, string[]> = {
  INFLUENCER: ['⭐ Higher search ranking', '🚀 Featured profile', '🔔 Early campaign notifications', '💼 Priority visibility to brands', '💬 Priority support'],
  PHOTOGRAPHER: ['⭐ Higher search ranking', '🚀 Featured profile', '🔔 Early campaign notifications', '💼 Priority visibility to brands', '💬 Priority support'],
  BRAND: ['🔍 Advanced search & filters', '📇 View creator contact details', '📊 Campaign analytics dashboard', '📣 Bulk outreach tools', '🏷️ Featured badge'],
};

@Component({
  selector: 'app-founder-offer-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="founder-modal-backdrop" *ngIf="open">
      <div class="founder-modal" role="dialog" aria-modal="true">
        <div class="founder-modal-header">
          <h2>🎉 Welcome to TrendStarz!</h2>
          <p>Complete your creator journey with TrendStarz Pro.</p>
        </div>

        <ng-container *ngIf="hasOffer; else noOfferTpl">
          <div class="founder-offer-banner">
            <span class="founder-offer-title">{{ offerName }}</span>
            <span class="founder-offer-countdown" *ngIf="daysLeft > 0">Ends in {{ daysLeft }} day{{ daysLeft === 1 ? '' : 's' }}</span>
          </div>

          <div class="founder-options" *ngIf="options.length">
            <div class="founder-option" *ngFor="let o of options" [class.recommended]="o.recommended">
              <span class="founder-option-badge" *ngIf="o.recommended">Recommended</span>
              <div class="founder-option-label">
                <ng-container *ngIf="o.bonusMonths > 0; else noBonusLabel">🔥 Pay for {{ o.baseMonths }} Month{{ o.baseMonths === 1 ? '' : 's' }} → Get {{ o.totalMonths }} Months</ng-container>
                <ng-template #noBonusLabel>{{ o.cycleLabel }} Plan</ng-template>
              </div>
              <div class="founder-option-price">
                <span class="founder-option-price-original" *ngIf="o.discountPercent > 0">₹{{ o.originalPrice | number }}</span>
                ₹{{ o.price | number }}
                <span class="founder-option-discount" *ngIf="o.discountPercent > 0">Save {{ o.discountPercent }}%</span>
              </div>
            </div>
          </div>
        </ng-container>

        <ng-template #noOfferTpl>
          <p class="founder-plain-intro">Upgrade to Premium anytime for more features built for your role.</p>
        </ng-template>

        <div class="founder-benefits">
          <span *ngFor="let b of benefits">{{ b }}</span>
        </div>

        <div class="founder-actions">
          <button type="button" class="btn-upgrade" (click)="onUpgrade()">{{ hasOffer ? 'Upgrade Now' : 'Upgrade to Premium' }}</button>
          <button type="button" class="btn-later" (click)="onDismiss()">Continue with Free</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .founder-modal-backdrop {
      position: fixed; inset: 0; z-index: 1090;
      background: rgba(7,12,22,0.7);
      display: grid; place-items: center; padding: 1rem;
    }
    .founder-modal {
      width: min(480px, 100%);
      background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%);
      border-radius: 18px;
      border: 1px solid #fdba74;
      box-shadow: 0 24px 70px rgba(0,0,0,0.3);
      padding: 1.75rem;
      text-align: center;
    }
    .founder-modal-header h2 { margin: 0 0 0.35rem; font-size: 1.4rem; color: #1f2937; }
    .founder-modal-header p { margin: 0 0 1rem; color: #6b7280; font-size: 0.92rem; }
    .founder-plain-intro { color: #374151; font-size: 0.92rem; margin: 0 0 1rem; }
    .founder-offer-banner {
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      background: #f97316; color: #fff; border-radius: 999px;
      padding: 0.4rem 1rem; font-weight: 800; font-size: 0.88rem;
      margin-bottom: 1rem;
    }
    .founder-offer-countdown { font-weight: 700; opacity: 0.92; }
    .founder-options { display: grid; gap: 0.6rem; margin-bottom: 1rem; }
    .founder-option {
      position: relative;
      border: 1.5px solid #fdba74; border-radius: 12px;
      background: #fff; padding: 0.75rem 1rem;
      display: flex; align-items: center; justify-content: space-between;
    }
    .founder-option.recommended { border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.18); }
    .founder-option-badge {
      position: absolute; top: -10px; left: 12px;
      background: #f97316; color: #fff; font-size: 0.65rem; font-weight: 800;
      border-radius: 999px; padding: 0.1rem 0.55rem;
    }
    .founder-option-label { font-weight: 700; color: #1f2937; font-size: 0.88rem; text-align: left; flex: 1; }
    .founder-option-price {
      font-weight: 800; color: #c2410c; font-size: 1.05rem;
      display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem;
      white-space: nowrap; margin-left: 0.75rem;
    }
    .founder-option-price-original { font-weight: 600; color: #9ca3af; text-decoration: line-through; font-size: 0.78rem; }
    .founder-option-discount { font-weight: 700; color: #16a34a; font-size: 0.7rem; }
    .founder-benefits {
      display: grid; gap: 0.35rem; text-align: left;
      background: rgba(255,255,255,0.6); border-radius: 10px;
      padding: 0.75rem 1rem; margin-bottom: 1.1rem; font-size: 0.85rem; color: #374151;
    }
    .founder-actions { display: grid; gap: 0.5rem; }
    .btn-upgrade {
      background: #f97316; color: #fff; border: none; border-radius: 10px;
      padding: 0.7rem; font-weight: 800; font-size: 0.95rem; cursor: pointer;
    }
    .btn-upgrade:hover { background: #ea6c0a; }
    .btn-later {
      background: transparent; color: #6b7280; border: none;
      font-weight: 600; font-size: 0.85rem; cursor: pointer; padding: 0.3rem;
    }
    .btn-later:hover { color: #374151; text-decoration: underline; }
  `],
})
export class FounderOfferModalComponent implements OnChanges {
  @Input() open = false;
  @Input() role: 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER' = 'INFLUENCER';
  @Output() closed = new EventEmitter<void>();

  options: FounderOfferOption[] = [];
  daysLeft = 7;
  hasOffer = false;
  offerName = 'Founder Launch Offer';

  constructor(
    private plansService: PlansService,
    private config: ConfigService,
    private router: Router,
  ) {}

  get benefits(): string[] {
    return BENEFITS_BY_ROLE[this.role] || BENEFITS_BY_ROLE['INFLUENCER'];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.plansService.getActivePlans(this.role).subscribe((plans) => {
        const paidPlan = plans.find((p: Plan) => (p?.price?.monthly ?? 0) > 0 || (p?.price?.quarterly ?? 0) > 0);
        this.hasOffer = hasRealFounderOffer(paidPlan);
        this.offerName = paidPlan?.founderOfferName || 'Founder Launch Offer';
        // The popup only ever shows once per user (gated by founderOfferSeenAt), so
        // "ends in N days" always counts from this view, not from registration —
        // otherwise existing users (registered long before this feature shipped)
        // would see the offer with the countdown already silently expired.
        this.daysLeft = paidPlan?.founderOfferWindowDays || 7;
        this.options = buildFounderOfferOptions(paidPlan);
      });
    }
  }

  private markSeen(): void {
    this.config.markFounderOfferSeen().subscribe({ next: () => {}, error: () => {} });
  }

  onUpgrade(): void {
    this.markSeen();
    this.closed.emit();
    this.router.navigate(['/upgrade-premium']);
  }

  onDismiss(): void {
    this.markSeen();
    this.closed.emit();
  }
}
