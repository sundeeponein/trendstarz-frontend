


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlansService, Plan, PlanFeature, PlanLimit, PlanOffer } from '../../../shared/plans.service';
import { AdminConfirmDialogComponent } from '../../../shared/admin-confirm-dialog/admin-confirm-dialog.component';

@Component({
  selector: 'app-admin-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminConfirmDialogComponent],
  templateUrl: './admin-plans.component.html',
  styleUrls: ['./admin-plans.component.scss'],
})

export class AdminPlansComponent implements OnInit {
  // Confirmation dialog state
  confirmDialogOpen = false;
  confirmDialogMessage = '';
  confirmDialogAction: (() => void) | null = null;

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
  influencerPlans: Plan[] = [];
  brandPlans: Plan[] = [];

  // Master feature/limit lists for each user type
  readonly masterFeatures: { [k: string]: { key: string; label: string }[] } = {
    INFLUENCER: [
      { key: 'publicProfileListing', label: 'Public profile listing' },
      { key: 'socialMediaVisibility', label: 'Show social media links' },
      { key: 'contactVisibility', label: 'Contact details visible to brands' },
      { key: 'priorityListing', label: 'Priority search ranking' },
      { key: 'analyticsDashboard', label: 'Analytics dashboard' },
      { key: 'canWriteReview', label: 'Write reviews for brands' },
      { key: 'canReadReviews', label: 'View influencer & brand reviews' },
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
    ],
  };

  readonly masterOffers: { [k: string]: { key: string; label: string }[] } = {
    INFLUENCER: [
      { key: 'trialPeriodDays', label: 'Trial period (days)' },
      { key: 'discountOnBrandPro', label: 'Discount on Brand Pro plan (%)' },
    ],
    BRAND: [
      { key: 'trialPeriodDays', label: 'Trial period (days)' },
      { key: 'discountOnInfluencerPro', label: 'Discount on Influencer Pro plan (%)' },
    ],
  };

  getMergedOffers(): { key: string; label: string; value: number }[] {
    if (!this.editingPlan) return [];
    const type = this.editingPlan.userType as 'INFLUENCER' | 'BRAND';
    const master = this.masterOffers[type] || [];
    return master.map(m => {
      const found = (this.editingPlan!.offers ?? []).find((o: any) => o.key === m.key);
      return { ...m, value: found ? found.value : 0 };
    });
  }

  setOfferValue(key: string, value: number) {
    if (!this.editingPlan) return;
    if (!this.editingPlan.offers) this.editingPlan.offers = [];
    const idx = this.editingPlan.offers.findIndex(o => o.key === key);
    if (idx >= 0) {
      this.editingPlan.offers[idx].value = value;
    } else {
      const master = this.masterOffers[this.editingPlan.userType as 'INFLUENCER' | 'BRAND'] || [];
      const m = master.find(o => o.key === key);
      if (m) this.editingPlan.offers.push({ ...m, value });
    }
  }

  readonly masterLimits: { [k: string]: { key: string; label: string }[] } = {
    INFLUENCER: [
      { key: 'maxProductImages', label: 'Product images' },
      { key: 'maxActiveCampaigns', label: 'Active campaign' },
      { key: 'maxInvitesPerCampaign', label: 'Invites / campaign' },
      { key: 'maxInviteOptions', label: 'Invite options' },
    ],
    BRAND: [
      { key: 'maxActiveCampaigns', label: 'Active campaign' },
      { key: 'maxInvitesPerCampaign', label: 'Invites / campaign' },
      { key: 'maxTeamSeats', label: 'Team seat' },
      { key: 'analytics', label: 'Analytics' },
    ],
  };

  // Merge plan features/limits with master list for UI
  getMergedFeatures(): { key: string; label: string; value: boolean }[] {
    if (!this.editingPlan) return [];
    const type = this.editingPlan.userType as 'INFLUENCER' | 'BRAND';
    const master = this.masterFeatures[type] || [];
    return master.map(m => {
      const found = this.editingPlan!.features.find(f => f.key === m.key);
      return { ...m, value: found ? found.value : false };
    });
  }
  getMergedLimits(): { key: string; label: string; value: number }[] {
    if (!this.editingPlan) return [];
    const type = this.editingPlan.userType as 'INFLUENCER' | 'BRAND';
    const master = this.masterLimits[type] || [];
    return master.map(m => {
      const found = this.editingPlan!.limits.find(l => l.key === m.key);
      return { ...m, value: found ? found.value : 0 };
    });
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
  plans: Plan[] = [];
  loading = false;
  error = '';
  successMsg = '';

  // Edit / create state
  editingPlan: Plan | null = null;
  isCreating = false;
  showTypeSelector = false;
  newPlanType: 'INFLUENCER' | 'BRAND' | null = null;

  readonly userTypes = ['INFLUENCER', 'BRAND'];

  constructor(private plansService: PlansService) {}

  ngOnInit() {
    this.loadPlans();
  }

  loadPlans() {
    this.loading = true;
    this.error = '';
    this.plansService.adminListAll().subscribe({
      next: plans => {
        this.plans = plans;
        this.influencerPlans = plans.filter(p => p.userType === 'INFLUENCER');
        this.brandPlans = plans.filter(p => p.userType === 'BRAND');
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
    this.showTypeSelector = true;
    this.newPlanType = null;
    this.editingPlan = null;
  }

  selectNewPlanType(type: 'INFLUENCER' | 'BRAND') {
    this.showTypeSelector = false;
    this.isCreating = true;
    this.newPlanType = type;
    if (type === 'INFLUENCER') {
      this.editingPlan = {
        name: 'Pro',
        userType: 'INFLUENCER',
        price: { monthly: 399, quarterly: 999, yearly: 2999 },
        features: [
          { key: 'publicProfileListing', label: 'Public profile listing', value: true },
          { key: 'socialMediaVisibility', label: 'Show social media links', value: true },
          { key: 'contactVisibility', label: 'Contact details visible to brands', value: true },
          { key: 'priorityListing', label: 'Priority search ranking', value: true },
          { key: 'analyticsDashboard', label: 'Analytics dashboard', value: true },
          { key: 'canWriteReview', label: 'Write reviews for brands', value: true },
          { key: 'canReadReviews', label: 'View influencer & brand reviews', value: true },
        ],
        limits: [
          { key: 'maxProductImages', label: 'Product images', value: 20 },
          { key: 'maxActiveCampaigns', label: 'Active campaign', value: 10 },
          { key: 'maxInvitesPerCampaign', label: 'Invites / campaign', value: 10 },
          { key: 'maxInviteOptions', label: 'Invite options', value: 20 },
        ],
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
        features: [
          { key: 'browseInfluencerProfiles', label: 'Browse influencer profiles', value: true },
          { key: 'viewSocialLinks', label: 'View public social links', value: true },
          { key: 'viewContactDetails', label: 'View contact details', value: true },
          { key: 'advancedSearchFilters', label: 'Advanced search & filters', value: true },
          { key: 'campaignAnalyticsDashboard', label: 'Campaign analytics dashboard', value: true },
          { key: 'bulkOutreachTools', label: 'Bulk outreach tools', value: true },
          { key: 'canWriteReview', label: 'Write reviews for influencers', value: true },
          { key: 'canReadReviews', label: 'View influencer & brand reviews', value: true },
        ],
        limits: [
          { key: 'maxActiveCampaigns', label: 'Active campaign', value: 10 },
          { key: 'maxInvitesPerCampaign', label: 'Invites / campaign', value: 20 },
          { key: 'maxTeamSeats', label: 'Team seats', value: 5 },
          { key: 'analytics', label: 'Analytics', value: 1 },
        ],
        policies: { imageRetentionDaysAfterExpiry: 45 },
        highlight: true,
        isActive: true,
        sortOrder: 1,
      };
    }
  }

  startEdit(plan: Plan) {
    this.loading = false;
    this.isCreating = false;
    // Deep clone to avoid mutating the list
    this.editingPlan = JSON.parse(JSON.stringify(plan));
  }

  onUserTypeChange() {
    if (!this.editingPlan) return;
    if (this.editingPlan.userType === 'BRAND') {
      // Ensure maxProductImages exists
      if (!this.editingPlan.limits.some(l => l.key === 'maxProductImages')) {
        this.editingPlan.limits.push({ key: 'maxProductImages', label: 'Product images', value: 10 });
      }
    } else {
      // Remove maxProductImages for non-BRAND
      this.editingPlan.limits = this.editingPlan.limits.filter(l => l.key !== 'maxProductImages');
    }
  }

  cancelEdit() {
    this.editingPlan = null;
    this.isCreating = false;
    this.showTypeSelector = false;
    this.newPlanType = null;
  }

  save() {
    if (!this.editingPlan) return;
    this.error = '';
    this.successMsg = '';

    // Sync ALL master features/limits/offers so the full set is persisted to DB,
    // not just the subset that was previously stored.
    this.editingPlan.features = this.getMergedFeatures();
    this.editingPlan.limits = this.getMergedLimits();
    this.editingPlan.offers = this.getMergedOffers();

    if (this.isCreating) {
      this.plansService.adminCreate(this.editingPlan).subscribe({
        next: () => {
          this.successMsg = 'Plan created successfully';
          this.editingPlan = null;
          this.isCreating = false;
          this.loadPlans();
        },
        error: (err) => (this.error = err?.error?.message || 'Failed to save plan'),
      });
    } else {
      const id = this.editingPlan._id!;
      this.plansService.adminUpdate(id, this.editingPlan).subscribe({
        next: () => {
          this.successMsg = 'Plan updated successfully';
          this.editingPlan = null;
          this.loadPlans();
        },
        error: (err) => (this.error = err?.error?.message || 'Failed to update plan'),
      });
    }
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
      }
    );
  }

  toggleFeature(key: string) {
    if (!this.editingPlan) return;
    const idx = this.editingPlan.features.findIndex(f => f.key === key);
    if (idx >= 0) {
      this.editingPlan.features[idx].value = !this.editingPlan.features[idx].value;
    } else {
      const master = this.masterFeatures[this.editingPlan.userType as 'INFLUENCER' | 'BRAND'] || [];
      const m = master.find((f: any) => f.key === key);
      if (m) this.editingPlan.features.push({ ...m, value: true });
    }
  }

  setLimitValue(key: string, value: number) {
    if (!this.editingPlan) return;
    const idx = this.editingPlan.limits.findIndex(l => l.key === key);
    if (idx >= 0) {
      this.editingPlan.limits[idx].value = value;
    } else {
      const master = this.masterLimits[this.editingPlan.userType as 'INFLUENCER' | 'BRAND'] || [];
      const m = master.find((l: any) => l.key === key);
      if (m) this.editingPlan.limits.push({ ...m, value });
    }
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
}
