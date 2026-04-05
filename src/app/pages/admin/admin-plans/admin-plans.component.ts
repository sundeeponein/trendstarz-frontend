
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlansService, Plan, PlanFeature, PlanLimit } from '../../../shared/plans.service';

@Component({
  selector: 'app-admin-plans',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-plans.component.html',
  styleUrls: ['./admin-plans.component.scss'],
})

export class AdminPlansComponent implements OnInit {
  influencerPlans: Plan[] = [];
  brandPlans: Plan[] = [];


  loadFromConfig() {
    this.loading = true;
    this.error = '';
    this.successMsg = '';
    fetch(`${(window as any).environment?.apiBaseUrl || '/api'}/plans/admin/load-config`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json',
      },
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          this.successMsg = res.message || 'Plans loaded from config';
          this.loadPlans();
        } else {
          this.error = res.message || 'Failed to load from config';
        }
        this.loading = false;
      })
      .catch(() => {
        this.error = 'Failed to load from config';
        this.loading = false;
      });
  }
  plans: Plan[] = [];
  loading = false;
  error = '';
  successMsg = '';

  // Edit / create state
  editingPlan: Plan | null = null;
  isCreating = false;

  readonly userTypes = ['INFLUENCER', 'BRAND', 'ALL'];

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
        this.influencerPlans = plans.filter(p => p.userType === 'INFLUENCER' || p.userType === 'ALL');
        this.brandPlans = plans.filter(p => p.userType === 'BRAND' || p.userType === 'ALL');
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
    this.isCreating = true;
    this.editingPlan = {
      name: 'Pro',
      userType: 'INFLUENCER',
      price: { monthly: 399, yearly: 2999 },
      features: [
        { key: 'socialMediaVisibility', label: 'Show Social Media Links', value: true },
        { key: 'contactVisibility', label: 'Show Contact Details', value: true },
        { key: 'priorityListing', label: 'Priority Listing in Search', value: true },
      ],
      limits: [
        { key: 'maxImages', label: 'Max Images Upload', value: 20 },
        { key: 'maxCampaigns', label: 'Max Campaigns', value: 10 },
      ],
      policies: { imageRetentionDaysAfterExpiry: 45 },
      highlight: true,
      isActive: true,
      sortOrder: 1,
    };
  }

  startEdit(plan: Plan) {
    this.loading = false;
    this.isCreating = false;
    // Deep clone to avoid mutating the list
    this.editingPlan = JSON.parse(JSON.stringify(plan));
  }

  cancelEdit() {
    this.editingPlan = null;
    this.isCreating = false;
  }

  save() {
    if (!this.editingPlan) return;
    this.error = '';
    this.successMsg = '';

    if (this.isCreating) {
      this.plansService.adminCreate(this.editingPlan).subscribe({
        next: () => {
          this.successMsg = 'Plan created successfully';
          this.editingPlan = null;
          this.isCreating = false;
          this.loadPlans();
        },
        error: () => (this.error = 'Failed to save plan'),
      });
    } else {
      const id = this.editingPlan._id!;
      this.plansService.adminUpdate(id, this.editingPlan).subscribe({
        next: () => {
          this.successMsg = 'Plan updated successfully';
          this.editingPlan = null;
          this.loadPlans();
        },
        error: () => (this.error = 'Failed to update plan'),
      });
    }
  }

  deletePlan(plan: Plan) {
    if (!confirm(`Delete plan "${plan.name}" (${plan.userType})? This cannot be undone.`)) return;
    this.plansService.adminDelete(plan._id!).subscribe({
      next: () => {
        this.successMsg = 'Plan deleted';
        this.loadPlans();
      },
      error: () => (this.error = 'Failed to delete plan'),
    });
  }

  toggleFeature(feature: PlanFeature) {
    feature.value = !feature.value;
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
