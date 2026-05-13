import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  selectedRoleTab: 'influencer' | 'brand' = 'influencer';

  // --- Summary counts ---
  influencerCount = 0;
  influencerActivated = 0;
  influencerPending = 0;
  influencerPremium = 0;
  influencerDeleted = 0;

  brandCount = 0;
  brandActivated = 0;
  brandPending = 0;
  brandPremium = 0;
  brandDeleted = 0;

  // --- Quick stats strip ---
  totalPending = 0;
  totalVerified = 0;
  premiumTotal = 0;
  suspiciousFlaggedTotal = 0;
  suspiciousFlaggedInfluencers = 0;
  suspiciousFlaggedBrands = 0;

  // --- Verification queue ---
  pendingMobileVerif = 0;
  pendingEmailVerif = 0;
  pendingApproval = 0;
  latestPendingUsers: { type: 'influencer' | 'brand'; name: string; label: string }[] = [];

  pendingMobileVerifInfluencer = 0;
  pendingMobileVerifBrand = 0;
  pendingEmailVerifInfluencer = 0;
  pendingEmailVerifBrand = 0;
  pendingApprovalInfluencer = 0;
  pendingApprovalBrand = 0;

  latestPendingInfluencers: { type: 'influencer' | 'brand'; name: string; label: string }[] = [];
  latestPendingBrands: { type: 'influencer' | 'brand'; name: string; label: string }[] = [];

  // --- Recent registrations (left panel) ---
  recentRegistrations: { type: 'influencer' | 'brand'; name: string; email: string; status: string; createdAt: string }[] = [];
  recentInfluencerRegistrations: { type: 'influencer' | 'brand'; name: string; email: string; status: string; createdAt: string }[] = [];
  recentBrandRegistrations: { type: 'influencer' | 'brand'; name: string; email: string; status: string; createdAt: string }[] = [];

  private allInfluencers: any[] = [];
  private allBrands: any[] = [];
  private fetchedCount = 0;

  getAuthHeaders() {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') || sessionStorage.getItem('token')
        : '';
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  constructor(private http: HttpClient, private cd: ChangeDetectorRef, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.fetchInfluencers();
      this.fetchBrands();
    }
  }

  private onFetchDone() {
    this.fetchedCount++;
    if (this.fetchedCount >= 2) {
      this.buildDerivedData();
    }
  }

  get visibleRecentRegistrations() {
    return this.selectedRoleTab === 'influencer'
      ? this.recentInfluencerRegistrations
      : this.recentBrandRegistrations;
  }

  get visiblePendingUsers() {
    return this.selectedRoleTab === 'influencer'
      ? this.latestPendingInfluencers
      : this.latestPendingBrands;
  }

  get visiblePendingApprovalCount() {
    return this.selectedRoleTab === 'influencer'
      ? this.pendingApprovalInfluencer
      : this.pendingApprovalBrand;
  }

  get visiblePendingMobileCount() {
    return this.selectedRoleTab === 'influencer'
      ? this.pendingMobileVerifInfluencer
      : this.pendingMobileVerifBrand;
  }

  get visiblePendingEmailCount() {
    return this.selectedRoleTab === 'influencer'
      ? this.pendingEmailVerifInfluencer
      : this.pendingEmailVerifBrand;
  }

  setRoleTab(role: 'influencer' | 'brand') {
    this.selectedRoleTab = role;
  }

  private buildDerivedData() {
    const combined = [
      ...this.allInfluencers.map(u => ({
        type: 'influencer' as const,
        name: u.name || u.username || 'Influencer',
        email: u.email || '',
        status: u.status || 'pending',
        createdAt: u.createdAt || '',
      })),
      ...this.allBrands.map(u => ({
        type: 'brand' as const,
        name: u.brandName || u.brandUsername || 'Brand',
        email: u.email || '',
        status: u.status || 'pending',
        createdAt: u.createdAt || '',
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    this.recentRegistrations = combined.slice(0, 8);
    this.recentInfluencerRegistrations = combined.filter(u => u.type === 'influencer').slice(0, 8);
    this.recentBrandRegistrations = combined.filter(u => u.type === 'brand').slice(0, 8);

    // --- Quick stats ---
    this.totalPending = this.influencerPending + this.brandPending;
    this.totalVerified = this.influencerActivated + this.brandActivated;
    this.premiumTotal = this.influencerPremium + this.brandPremium;

    // --- Verification queue ---
    const activeInf = this.allInfluencers.filter(u => (u.status || '').toLowerCase() !== 'deleted');
    const activeBrand = this.allBrands.filter(u => (u.status || '').toLowerCase() !== 'deleted');

    this.suspiciousFlaggedInfluencers = activeInf.filter((u: any) => this.isSuspiciousOrFlagged(u)).length;
    this.suspiciousFlaggedBrands = activeBrand.filter((u: any) => this.isSuspiciousOrFlagged(u)).length;
    this.suspiciousFlaggedTotal = this.suspiciousFlaggedInfluencers + this.suspiciousFlaggedBrands;

    this.pendingMobileVerifInfluencer = activeInf.filter(u => !u.isMobileVerified).length;
    this.pendingMobileVerifBrand = activeBrand.filter(u => !u.isMobileVerified).length;
    this.pendingMobileVerif =
      this.pendingMobileVerifInfluencer + this.pendingMobileVerifBrand;

    this.pendingEmailVerifInfluencer = activeInf.filter(u => !u.isEmailVerified).length;
    this.pendingEmailVerifBrand = activeBrand.filter(u => !u.isEmailVerified).length;
    this.pendingEmailVerif =
      this.pendingEmailVerifInfluencer + this.pendingEmailVerifBrand;

    this.pendingApprovalInfluencer = this.influencerPending;
    this.pendingApprovalBrand = this.brandPending;
    this.pendingApproval = this.totalPending;

    // Latest pending users for queue preview (top 5)
    this.latestPendingUsers = combined
      .filter(u => u.status === 'pending')
      .slice(0, 5)
      .map(u => ({
        type: u.type,
        name: u.name,
        label: u.type === 'influencer' ? 'Influencer — Pending' : 'Brand — Pending',
      }));

    this.latestPendingInfluencers = this.latestPendingUsers.filter(u => u.type === 'influencer').slice(0, 5);
    this.latestPendingBrands = this.latestPendingUsers.filter(u => u.type === 'brand').slice(0, 5);

    this.cd.detectChanges();
  }

  private isSuspiciousOrFlagged(user: any): boolean {
    if (!user) return false;
    if (user.isFlagged === true || user.flagged === true || user.isSuspicious === true) {
      return true;
    }
    const tags = Array.isArray(user.adminTags) ? user.adminTags : [];
    return tags.some((tag: any) => {
      const value = String(tag || '').toLowerCase();
      return value.includes('flagged') || value.includes('suspicious');
    });
  }

  fetchInfluencers() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/influencers`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          const all = Array.isArray(data) ? data : ((data as any)?.data || []);
          this.allInfluencers = all;
          const filtered = all.filter((u: any) => (u.status || '').toLowerCase() !== 'deleted');
          this.influencerCount = filtered.length;
          this.influencerActivated = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'accepted').length;
          this.influencerPending = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'pending').length;
          this.influencerPremium = filtered.filter((u: any) => !!u.isPremium).length;
          this.influencerDeleted = all.filter((u: any) => (u.status || '').toLowerCase() === 'deleted').length;
          this.onFetchDone();
        },
        error: (err) => {
          console.error('[AdminDashboard] Error fetching influencers:', err);
          this.onFetchDone();
        }
      });
  }

  fetchBrands() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/brands`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          const all = Array.isArray(data) ? data : ((data as any)?.data || []);
          this.allBrands = all;
          const filtered = all.filter((u: any) => (u.status || '').toLowerCase() !== 'deleted');
          this.brandCount = filtered.length;
          this.brandActivated = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'accepted').length;
          this.brandPending = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'pending').length;
          this.brandPremium = filtered.filter((u: any) => !!u.isPremium).length;
          this.brandDeleted = all.filter((u: any) => (u.status || '').toLowerCase() === 'deleted').length;
          this.onFetchDone();
        },
        error: (err) => {
          console.error('[AdminDashboard] Error fetching brands:', err);
          this.onFetchDone();
        }
      });
  }
}
