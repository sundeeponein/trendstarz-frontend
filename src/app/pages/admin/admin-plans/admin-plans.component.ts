import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlansService, Plan } from '../../../shared/plans.service';
import { AdminConfirmDialogComponent } from '../../../shared/admin-confirm-dialog/admin-confirm-dialog.component';

@Component({
  selector: 'app-admin-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminConfirmDialogComponent],
  templateUrl: './admin-plans.component.html',
  styleUrls: ['./admin-plans.component.scss'],
})
export class AdminPlansComponent implements OnInit {
  confirmDialogOpen = false;
  confirmDialogMessage = '';
  confirmDialogAction: (() => void) | null = null;

  influencerPlans: Plan[] = [];
  brandPlans: Plan[] = [];
  photographerPlans: Plan[] = [];

  activeTab: 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER' = 'INFLUENCER';

  setTab(tab: 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER') {
    this.activeTab = tab;
  }

  get activePlans(): Plan[] {
    if (this.activeTab === 'BRAND') return this.brandPlans;
    if (this.activeTab === 'PHOTOGRAPHER') return this.photographerPlans;
    return this.influencerPlans;
  }

  // Quick reference so trial days across roles are visible without switching tabs —
  // avoids the "is this plan's trial different on purpose or did I forget it" confusion.
  get trialDaysSummary(): { label: string; days: number }[] {
    const trialDaysOf = (plans: Plan[]) => {
      const plan = plans.find(p => p.highlight) || plans[0];
      return plan?.offers?.find(o => o.key === 'trialPeriodDays')?.value ?? 0;
    };
    return [
      { label: 'Influencer Pro', days: trialDaysOf(this.influencerPlans) },
      { label: 'Brand Pro', days: trialDaysOf(this.brandPlans) },
      { label: 'Photo/Video Pro', days: trialDaysOf(this.photographerPlans) },
    ];
  }

  readonly masterFeatures: { [k: string]: { key: string; label: string }[] } = {
    INFLUENCER: [
      { key: 'publicProfileListing', label: 'Public profile listing' },
      { key: 'socialMediaVisibility', label: 'Show social media links' },
      { key: 'contactVisibility', label: 'Contact details visible to brands' },
      { key: 'priorityListing', label: 'Priority search ranking' },
      { key: 'analyticsDashboard', label: 'Analytics dashboard' },
      { key: 'canWriteReview', label: 'Write reviews for brands' },
      { key: 'canReadReviews', label: 'View influencer & brand reviews' },
      { key: 'canInviteUsers', label: 'Can invite users' },
      { key: 'canViewAnalytics', label: 'Can view analytics' },
    ],
    BRAND: [
      { key: 'browseInfluencerProfiles', label: 'Browse influencer profiles' },
      { key: 'viewSocialLinks', label: 'View public social links' },
      { key: 'viewContactDetails', label: 'View contact details' },
      { key: 'advancedSearchFilters', label: 'Advanced search & filters' },
      { key: 'campaignAnalyticsDashboard', label: 'Campaign analytics dashboard' },
      { key: 'bulkOutreachTools', label: 'Bulk outreach tools' },
      { key: 'canWriteReview', label: 'Write reviews for influencers' },
      { key: 'canReadReviews', label: 'View influencer & brand reviews' },
      { key: 'canInviteUsers', label: 'Can invite users' },
      { key: 'canViewAnalytics', label: 'Can view analytics' },
      { key: 'featuredBadge', label: 'Featured badge' },
    ],
    PHOTOGRAPHER: [
      { key: 'publicProfileListing', label: 'Public photographer profile' },
      { key: 'socialMediaVisibility', label: 'Show social media links' },
      { key: 'contactVisibility', label: 'Contact details visible to brands' },
      { key: 'priorityListing', label: 'Priority search ranking' },
      { key: 'analyticsDashboard', label: 'Analytics dashboard' },
      { key: 'canWriteReview', label: 'Write reviews for brands' },
      { key: 'canReadReviews', label: 'View influencer & brand reviews' },
      { key: 'canInviteUsers', label: 'Can invite users' },
      { key: 'canViewAnalytics', label: 'Can view analytics' },
    ],
  };

  readonly masterOffers: { [k: string]: { key: string; label: string }[] } = {
    INFLUENCER: [
      { key: 'trialPeriodDays', label: 'Trial period (days)' },
      { key: 'discountMonthly', label: 'Monthly Discount (%)' },
      { key: 'discountQuarterly', label: 'Quarterly Discount (%)' },
      { key: 'discountYearly', label: 'Yearly Discount (%)' },
    ],
    BRAND: [
      { key: 'trialPeriodDays', label: 'Trial period (days)' },
      { key: 'discountMonthly', label: 'Monthly Discount (%)' },
      { key: 'discountQuarterly', label: 'Quarterly Discount (%)' },
      { key: 'discountYearly', label: 'Yearly Discount (%)' },
    ],
    PHOTOGRAPHER: [
      { key: 'trialPeriodDays', label: 'Trial period (days)' },
      { key: 'discountMonthly', label: 'Monthly Discount (%)' },
      { key: 'discountQuarterly', label: 'Quarterly Discount (%)' },
      { key: 'discountYearly', label: 'Yearly Discount (%)' },
    ],
  };

  readonly masterLimits: { [k: string]: { key: string; label: string }[] } = {
    INFLUENCER: [
      { key: 'dailyProfileViewLimit', label: 'Daily profile views' },
      { key: 'dailySearchLimit', label: 'Daily searches' },
      { key: 'maxProductImages', label: 'Product images' },
      { key: 'maxActiveCampaigns', label: 'Active campaign' },
      { key: 'maxInvitesPerCampaign', label: 'Invites / campaign' },
      { key: 'maxInviteOptions', label: 'Invite options' },
      { key: 'maxCampaignPosts', label: 'Max campaign posts' },
    ],
    BRAND: [
      { key: 'dailyProfileViewLimit', label: 'Daily profile views' },
      { key: 'dailySearchLimit', label: 'Daily searches' },
      { key: 'maxActiveCampaigns', label: 'Active campaign' },
      { key: 'maxInvitesPerCampaign', label: 'Invites / campaign' },
      { key: 'maxTeamSeats', label: 'Team seat' },
      { key: 'analytics', label: 'Analytics' },
      { key: 'maxCampaignPosts', label: 'Max campaign posts' },
    ],
    PHOTOGRAPHER: [
      { key: 'dailyProfileViewLimit', label: 'Daily profile views' },
      { key: 'dailySearchLimit', label: 'Daily searches' },
      { key: 'maxPortfolioImages', label: 'Portfolio images' },
      { key: 'maxActiveCampaigns', label: 'Active campaign' },
      { key: 'maxInvitesPerCampaign', label: 'Invites / campaign' },
      { key: 'analytics', label: 'Analytics' },
      { key: 'maxCampaignPosts', label: 'Max campaign posts' },
    ],
  };

  plans: Plan[] = [];
  loading = false;
  error = '';
  successMsg = '';
  saving = false;

  editingPlan: Plan | null = null;
  isCreating = false;
  showTypeSelector = false;
  newPlanType: 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER' | null = null;

  readonly userTypes = ['INFLUENCER', 'BRAND', 'PHOTOGRAPHER'];

  constructor(private plansService: PlansService) {}

  ngOnInit() {
    this.loadPlans();
  }

  showConfirm(message: string, action: () => void) {
    this.confirmDialogMessage = message;
    this.confirmDialogAction = action;
    this.confirmDialogOpen = true;
  }

  onConfirmDialogConfirm() {
    if (this.confirmDialogAction) this.confirmDialogAction();
    this.confirmDialogOpen = false;
    this.confirmDialogAction = null;
  }

  onConfirmDialogCancel() {
    this.confirmDialogOpen = false;
    this.confirmDialogAction = null;
  }

  getMergedFeatures(): { key: string; label: string; value: boolean }[] {
    if (!this.editingPlan) return [];
    const type = this.editingPlan.userType as 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER';
    const master = this.masterFeatures[type] || [];
    return master.map(m => {
      const found = this.editingPlan!.features.find(f => f.key === m.key);
      return { ...m, value: found ? found.value : false };
    });
  }

  getMergedLimits(): { key: string; label: string; value: number }[] {
    if (!this.editingPlan) return [];
    const type = this.editingPlan.userType as 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER';
    const master = this.masterLimits[type] || [];
    return master.map(m => {
      const found = this.editingPlan!.limits.find(l => l.key === m.key);
      return { ...m, value: found ? found.value : 0 };
    });
  }

  getMergedOffers(): { key: string; label: string; value: number }[] {
    if (!this.editingPlan) return [];
    const type = this.editingPlan.userType as 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER';
    const master = this.masterOffers[type] || [];
    return master.map(m => {
      const found = (this.editingPlan!.offers ?? []).find(o => o.key === m.key);
      return { ...m, value: found ? found.value : 0 };
    });
  }

  getOfferValue(key: string): number {
    return this.getMergedOffers().find(o => o.key === key)?.value ?? 0;
  }

  setOfferValue(key: string, value: number) {
    if (!this.editingPlan) return;
    if (!this.editingPlan.offers) this.editingPlan.offers = [];
    const idx = this.editingPlan.offers.findIndex(o => o.key === key);
    if (idx >= 0) {
      this.editingPlan.offers[idx].value = value;
      return;
    }
    const master = this.masterOffers[this.editingPlan.userType as 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER'] || [];
    const m = master.find(o => o.key === key);
    if (m) this.editingPlan.offers.push({ ...m, value });
  }

  // Offer values are mixed units: trialPeriodDays is a day count, the discount
  // keys are percentages. Render each with its own unit instead of assuming '%' for all.
  offerValueDisplay(o: { key: string; value: number }): string {
    return o.key === 'trialPeriodDays' ? `${o.value} days` : `${o.value}%`;
  }

  getPricingPreview(): { label: string; price: number; discountPercent: number; final: number }[] {
    if (!this.editingPlan) return [];
    const offers = this.getMergedOffers();
    const discountFor = (key: string) => offers.find(o => o.key === key)?.value ?? 0;
    const rows: { key: 'monthly' | 'quarterly' | 'yearly'; label: string; discountKey: string }[] = [
      { key: 'monthly', label: 'Monthly', discountKey: 'discountMonthly' },
      { key: 'quarterly', label: 'Quarterly', discountKey: 'discountQuarterly' },
      { key: 'yearly', label: 'Yearly', discountKey: 'discountYearly' },
    ];
    return rows.map(r => {
      const price = this.editingPlan!.price[r.key] ?? 0;
      const discountPercent = discountFor(r.discountKey);
      return { label: r.label, price, discountPercent, final: Math.round(price * (1 - discountPercent / 100)) };
    });
  }

  getFinalPrice(durationKey: 'monthly' | 'quarterly' | 'yearly'): number {
    return this.getPricingPreview().find(r => r.label.toLowerCase() === durationKey)?.final ?? 0;
  }

  private syncContactVisibilityFeature(_plan: Plan) {
    // No-op retained for compatibility.
  }

  loadFromConfig() {
    this.loading = true;
    this.error = '';
    this.successMsg = '';
    this.plansService.adminLoadFromConfig().subscribe({
      next: (res) => {
        if (res.success) {
          this.successMsg = res.message || 'Plans loaded from config';
          this.plans = res.plans;
          this.influencerPlans = res.plans.filter(p => p.userType === 'INFLUENCER');
          this.brandPlans = res.plans.filter(p => p.userType === 'BRAND');
          this.photographerPlans = res.plans.filter(p => p.userType === 'PHOTOGRAPHER');
        } else {
          this.error = res.message || 'Failed to load from config';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load from config';
        this.loading = false;
      },
    });
  }

  loadPlans() {
    this.loading = true;
    this.error = '';
    this.plansService.adminListAll().subscribe({
      next: plans => {
        this.plans = plans;
        this.influencerPlans = plans.filter(p => p.userType === 'INFLUENCER');
        this.brandPlans = plans.filter(p => p.userType === 'BRAND');
        this.photographerPlans = plans.filter(p => p.userType === 'PHOTOGRAPHER');
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load plans. Check your connection or login.';
        this.loading = false;
      },
    });
  }

  startCreate() {
    this.loading = false;
    this.isCreating = false;
    this.saving = false;
    this.showTypeSelector = true;
    this.newPlanType = null;
    this.editingPlan = null;
  }

  selectNewPlanType(type: 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER') {
    this.showTypeSelector = false;
    this.isCreating = true;
    this.newPlanType = type;

    if (type === 'INFLUENCER') {
      this.editingPlan = {
        name: 'Pro',
        userType: 'INFLUENCER',
        price: { monthly: 399, quarterly: 999, yearly: 2999 },
        features: this.masterFeatures['INFLUENCER'].map(f => ({ ...f, value: true })),
        limits: [
          { key: 'dailyProfileViewLimit', label: 'Daily profile views', value: 300 },
          { key: 'dailySearchLimit', label: 'Daily searches', value: 150 },
          { key: 'maxProductImages', label: 'Product images', value: 20 },
          { key: 'maxActiveCampaigns', label: 'Active campaign', value: 10 },
          { key: 'maxInvitesPerCampaign', label: 'Invites / campaign', value: 10 },
          { key: 'maxInviteOptions', label: 'Invite options', value: 20 },
          { key: 'maxCampaignPosts', label: 'Max campaign posts', value: 20 },
        ],
        offers: this.masterOffers['INFLUENCER'].map(o => ({ ...o, value: 0 })),
        policies: { imageRetentionDaysAfterExpiry: 45 },
        highlight: true,
        isActive: true,
        sortOrder: 1,
      };
    } else if (type === 'BRAND') {
      this.editingPlan = {
        name: 'Pro',
        userType: 'BRAND',
        price: { monthly: 399, quarterly: 999, yearly: 2999 },
        features: this.masterFeatures['BRAND'].map(f => ({ ...f, value: true })),
        limits: [
          { key: 'dailyProfileViewLimit', label: 'Daily profile views', value: 500 },
          { key: 'dailySearchLimit', label: 'Daily searches', value: 250 },
          { key: 'maxActiveCampaigns', label: 'Active campaign', value: 10 },
          { key: 'maxInvitesPerCampaign', label: 'Invites / campaign', value: 20 },
          { key: 'maxTeamSeats', label: 'Team seats', value: 5 },
          { key: 'analytics', label: 'Analytics', value: 1 },
          { key: 'maxCampaignPosts', label: 'Max campaign posts', value: 30 },
        ],
        offers: this.masterOffers['BRAND'].map(o => ({ ...o, value: 0 })),
        policies: { imageRetentionDaysAfterExpiry: 45 },
        highlight: true,
        isActive: true,
        sortOrder: 1,
      };
    } else {
      this.editingPlan = {
        name: 'Pro',
        userType: 'PHOTOGRAPHER',
        price: { monthly: 399, quarterly: 999, yearly: 2999 },
        features: this.masterFeatures['PHOTOGRAPHER'].map(f => ({ ...f, value: true })),
        limits: [
          { key: 'dailyProfileViewLimit', label: 'Daily profile views', value: 300 },
          { key: 'dailySearchLimit', label: 'Daily searches', value: 150 },
          { key: 'maxPortfolioImages', label: 'Portfolio images', value: 10 },
          { key: 'maxActiveCampaigns', label: 'Active campaign', value: 10 },
          { key: 'maxInvitesPerCampaign', label: 'Invites / campaign', value: 10 },
          { key: 'analytics', label: 'Analytics', value: 0 },
          { key: 'maxCampaignPosts', label: 'Max campaign posts', value: 20 },
        ],
        offers: this.masterOffers['PHOTOGRAPHER'].map(o => ({ ...o, value: 0 })),
        policies: { imageRetentionDaysAfterExpiry: 45 },
        highlight: true,
        isActive: true,
        sortOrder: 1,
      };
    }

    if (this.editingPlan) {
      this.syncContactVisibilityFeature(this.editingPlan);
    }
  }

  startEdit(plan: Plan) {
    this.loading = false;
    this.isCreating = false;
    this.saving = false;
    this.editingPlan = JSON.parse(JSON.stringify(plan));
    if (this.editingPlan) {
      this.syncContactVisibilityFeature(this.editingPlan);
    }
  }

  onContactVisibilityPolicyChange() {
    // Deprecated: kept as no-op.
  }

  onUserTypeChange() {
    if (!this.editingPlan) return;
    this.editingPlan.features = this.getMergedFeatures();
    this.editingPlan.limits = this.getMergedLimits();
    this.editingPlan.offers = this.getMergedOffers();
  }

  cancelEdit() {
    this.editingPlan = null;
    this.isCreating = false;
    this.saving = false;
    this.showTypeSelector = false;
    this.newPlanType = null;
  }

  save() {
    if (!this.editingPlan) return;

    this.error = '';
    this.successMsg = '';
    this.saving = true;

    this.editingPlan.features = this.getMergedFeatures();
    this.editingPlan.limits = this.getMergedLimits();
    this.editingPlan.offers = this.getMergedOffers();
    if (!this.editingPlan.policies) {
      this.editingPlan.policies = { imageRetentionDaysAfterExpiry: 45 };
    }
    this.syncContactVisibilityFeature(this.editingPlan);

    if (this.isCreating) {
      this.plansService.adminCreate(this.editingPlan).subscribe({
        next: () => {
          this.successMsg = 'Plan created successfully';
          this.editingPlan = null;
          this.isCreating = false;
          this.saving = false;
          this.loadPlans();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Failed to save plan';
          this.saving = false;
        },
      });
      return;
    }

    const id = this.editingPlan._id!;
    this.plansService.adminUpdate(id, this.editingPlan).subscribe({
      next: () => {
        this.successMsg = 'Plan updated successfully';
        this.editingPlan = null;
        this.saving = false;
        this.loadPlans();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to update plan';
        this.saving = false;
      },
    });
  }

  deletePlan(plan: Plan) {
    this.showConfirm(
      `Are you sure you want to delete "${plan.name}" (${plan.userType})? This cannot be undone.`,
      () => {
        this.plansService.adminDelete(plan._id!).subscribe({
          next: () => {
            this.successMsg = 'Plan deleted';
            this.loadPlans();
          },
          error: () => (this.error = 'Failed to delete plan'),
        });
      },
    );
  }

  toggleFeature(key: string) {
    if (!this.editingPlan) return;
    const idx = this.editingPlan.features.findIndex(f => f.key === key);
    if (idx >= 0) {
      this.editingPlan.features[idx].value = !this.editingPlan.features[idx].value;
      return;
    }
    const master = this.masterFeatures[this.editingPlan.userType as 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER'] || [];
    const m = master.find(f => f.key === key);
    if (m) this.editingPlan.features.push({ ...m, value: true });
  }

  setLimitValue(key: string, value: number) {
    if (!this.editingPlan) return;
    const idx = this.editingPlan.limits.findIndex(l => l.key === key);
    if (idx >= 0) {
      this.editingPlan.limits[idx].value = value;
      return;
    }
    const master = this.masterLimits[this.editingPlan.userType as 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER'] || [];
    const m = master.find(l => l.key === key);
    if (m) this.editingPlan.limits.push({ ...m, value });
  }

  addFeature() {
    this.editingPlan?.features.push({ key: '', label: '', value: true });
  }

  removeFeature(i: number) {
    this.editingPlan?.features.splice(i, 1);
  }

  addLimit() {
    this.editingPlan?.limits.push({ key: '', label: '', value: 0 });
  }

  removeLimit(i: number) {
    this.editingPlan?.limits.splice(i, 1);
  }

  trackById(_: number, item: Plan) {
    return item._id;
  }

  trackByKey(_: number, item: { key: string }) {
    return item.key;
  }
}
