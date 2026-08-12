import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { VerificationFunnelComponent, FunnelStage } from '../../../shared/components/verification-funnel/verification-funnel.component';

type FunnelStageCounts = {
  registered: number;
  active: number;
  emailVerified: number;
  mobileVerified: number;
  searchEligible: number;
  adminApproved: number;
  featuredEligible: number;
  campaignEligible: number;
};

const STAGE_LABELS: Array<{ key: keyof FunnelStageCounts; label: string }> = [
  { key: 'registered', label: 'Registered' },
  { key: 'active', label: 'Active' },
  { key: 'emailVerified', label: 'Email Verified' },
  { key: 'mobileVerified', label: 'Mobile Verified' },
  { key: 'searchEligible', label: 'Search Eligible' },
  { key: 'adminApproved', label: 'Admin Approved' },
  { key: 'featuredEligible', label: 'Featured Eligible' },
  { key: 'campaignEligible', label: 'Campaign Eligible' },
];

@Component({
  selector: 'app-verification-funnel-page',
  standalone: true,
  imports: [CommonModule, RouterModule, VerificationFunnelComponent],
  templateUrl: './verification-funnel.component.html',
  styleUrls: ['./verification-funnel.component.scss'],
})
export class VerificationFunnelPageComponent implements OnInit {
  loading = false;
  error = '';
  activeTab: 'combined' | 'influencer' | 'brand' | 'photographer' = 'combined';
  readonly tabs: Array<{ key: 'combined' | 'influencer' | 'brand' | 'photographer'; label: string }> = [
    { key: 'combined', label: 'All Roles' },
    { key: 'influencer', label: 'Influencers' },
    { key: 'brand', label: 'Brands' },
    { key: 'photographer', label: 'Photo/Videographers' },
  ];

  private combined: FunnelStageCounts | null = null;
  private byRole: Record<string, FunnelStageCounts> = {};

  get stages(): FunnelStage[] {
    const counts = this.activeTab === 'combined' ? this.combined : this.byRole[this.activeTab];
    if (!counts) return [];
    return STAGE_LABELS.map(({ key, label }) => ({ key, label, count: counts[key] }));
  }

  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.load();
  }

  private getAuthHeaders() {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('token') || sessionStorage.getItem('token'))
      : '';
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  setTab(tab: 'combined' | 'influencer' | 'brand' | 'photographer'): void {
    this.activeTab = tab;
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.http.get<any>(`${environment.apiBaseUrl}/admin/verification-funnel`, this.getAuthHeaders()).subscribe({
      next: (res) => {
        const data = res?.data ?? res;
        this.combined = data?.combined ?? null;
        this.byRole = data?.byRole ?? {};
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load the verification funnel.';
      },
    });
  }
}
