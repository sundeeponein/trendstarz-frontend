
import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { buildDefaultUserTagVisibilityOptions } from '../../../shared/constants/user-tag-options.constants';

const DEFAULT_EQUIPMENT_OPTIONS = [
  { name: 'Sony', visible: true },
  { name: 'Canon', visible: true },
  { name: 'DJI', visible: true },
  { name: 'iPhone Creator', visible: true },
];

const DEFAULT_PRICING_OPTIONS = [
  { key: 'Starting Price', label: 'Starting Price', visible: true },
  { key: 'Per Reel', label: 'Per Reel', visible: true },
  { key: 'Per Shoot', label: 'Per Shoot', visible: true },
  { key: 'Hourly', label: 'Hourly', visible: true },
  { key: 'Equipment', label: 'Equipment Rental', visible: true },
];

@Component({
  selector: 'app-admin-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-management.component.html',
  styleUrls: ['./admin-management.component.scss']
})
export class AdminManagementComponent implements OnInit {
  getDistrictIndex(dist: any): number {
    return this.config.districts.findIndex((d: any) => d._id === dist._id);
  }
  activeTab: string = 'campaigns';
  categoriesRoleTab: 'influencer' | 'brand' | 'photographer' = 'influencer';
  userTagsRoleTab: 'influencer' | 'brand' | 'photographer' | 'commission' = 'influencer';
  config: any = {
    socialMediaPlatforms: [],
    categories: [],
    equipmentOptions: [],
    pricingOptions: [],
    locations: [],
    districts: [],
    languages: [],
    tiers: [],
    userTags: buildDefaultUserTagVisibilityOptions(),
  };

  districtFilterState: string = '';

  get filteredCategories(): any[] {
    const role = this.categoriesRoleTab;
    return (this.config.categories || []).filter((cat: any) => {
      const r = String(cat?.role || '').toLowerCase();
      return r === role || r === 'both' || !r;
    });
  }

  get filteredDistricts(): any[] {
    const all = (this.config.districts || []).map((d: any, i: number) => ({ ...d, _origIndex: i }));
    if (!this.districtFilterState) return all;
    return all.filter((d: any) => d.state === this.districtFilterState);
  }

  setCategoriesRoleTab(role: 'influencer' | 'brand' | 'photographer') {
    this.categoriesRoleTab = role;
  }

  setUserTagsRoleTab(role: 'influencer' | 'brand' | 'photographer' | 'commission') {
    this.userTagsRoleTab = role;
  }

  private normalizeUserTagList(list: unknown, fallback: Array<{ name: string; visible: boolean }>) {
    if (!Array.isArray(list)) {
      return fallback.map((item: any) => ({ ...item }));
    }
    const normalized = list
      .map((item: any) => {
        if (typeof item === 'string') {
          const name = item.trim();
          return name ? { name, visible: true } : null;
        }
        if (item && typeof item === 'object') {
          const name = String(item.name || '').trim();
          if (!name) return null;
          return { name, visible: item.visible !== false };
        }
        return null;
      })
      .filter((item: any) => !!item);

    return normalized.length ? normalized : fallback.map((item: any) => ({ ...item }));
  }

  private getDefaultUserTags() {
    return buildDefaultUserTagVisibilityOptions();
  }

  get filteredUserTags(): Array<{ name: string; visible: boolean }> {
    const list = this.config?.userTags?.[this.userTagsRoleTab];
    return Array.isArray(list) ? list : [];
  }

  getCategoryIndex(cat: any): number {
    return this.config.categories.findIndex((c: any) => c._id === cat._id);
  }

  getUserTagIndex(tag: any): number {
    return this.filteredUserTags.findIndex((t: any) => t.name === tag.name);
  }

  settings = {
    preApproveInfluencers: false,
    influencerRequireEmailVerified: true,
    influencerRequireMobileVerified: false,
    preApproveBrands: false,
    brandRequireEmailVerified: true,
    brandRequireMobileVerified: false,
    campaignApprovalMode: 'manual',
    collaborationApprovalMode: 'manual',
    // Admin-managed support contact (shown on campaign-management page banner).
    // Can be toggled off entirely via supportContactEnabled. Stays useful even
    // after Razorpay automation lands — repurposed as "Need help?" channel.
    supportContactEnabled: true,
    supportContactEmail: 'support@trendstarz.in',
    supportContactPhone: '',
    supportContactWhatsapp: '',
    supportContactMessage: '',
    // Number shown on registration/profile phone field as verification call hint
    verificationCallNumber: '',
    // Platform commission and tax (admin-managed)
    platformFeeEnabled: false,
    platformFeePercent: 0,
    gstPercent: 0,
    earlyAccessAssignmentMode: 'manual',
    // Commission percentages for badge types (applicable when badge is assigned)
    earlyAccessCommissionPercent: 0,
    partnerCommissionPercent: 0,
    internalTestCommissionPercent: 0,
    showSearchLink: true,
    showRegisterInfluencerLink: true,
    showRegisterBrandLink: true,
    showRegisterPhotographerLink: true,
  };
  settingsSaving = false;
  settingsSaved = false;
  earlyAccessRefillRunning = false;
  earlyAccessRefillMessage = '';
  earlyAccessLastRunAt: string | null = null;
  earlyAccessLastRunStatus = '';
  earlyAccessLastRunDetails = '';
  earlyAccessPreviewLoading = false;
  earlyAccessPreview: any = null;
  earlyAccessPreviewRefreshedAt: Date | null = null;
  earlyAccessPreviewCopyMessage = '';
  earlyAccessNormalizeRunning = false;
  earlyAccessNormalizeMessage = '';
  earlyAccessAdvancedOpen = false;
  showVisibilityConfirmModal = false;

  commissionCounts = {
    influencer: { early_access_creator: 0, partner_creator: 0, internal_test_creator: 0 },
    brand: { early_access_brand: 0, partner_brand: 0, internal_test_brand: 0 },
  };

  isServer: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    this.isServer = isPlatformServer(this.platformId);
  }

  ngOnInit() {
    if (!this.isServer) {
      this.loadConfig();
      this.loadSettings();
      this.loadCommissionCounts();
    }
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  loadSettings() {
    const token = this.getToken();
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    this.http.get<any>(`${environment.apiBaseUrl}/admin/settings`, headers).subscribe({
      next: (res) => {
        // ResponseInterceptor wraps responses as { success: true, data: {...} }
        // unless they already contain a 'success' field
        const data = res?.data ?? res;
        this.settings.preApproveInfluencers = !!data?.preApproveInfluencers;
        this.settings.influencerRequireEmailVerified = !!data?.influencerRequireEmailVerified;
        this.settings.influencerRequireMobileVerified = !!data?.influencerRequireMobileVerified;
        this.settings.preApproveBrands = !!data?.preApproveBrands;
        this.settings.brandRequireEmailVerified = !!data?.brandRequireEmailVerified;
        this.settings.brandRequireMobileVerified = !!data?.brandRequireMobileVerified;
        this.settings.campaignApprovalMode = data?.campaignApprovalMode === 'auto_live' ? 'auto_live' : 'manual';
        this.settings.collaborationApprovalMode = data?.collaborationApprovalMode === 'auto_live' ? 'auto_live' : 'manual';
        this.settings.supportContactEnabled = data?.supportContactEnabled !== false;
        this.settings.supportContactEmail = data?.supportContactEmail || 'support@trendstarz.in';
        this.settings.supportContactPhone = data?.supportContactPhone || '';
        this.settings.supportContactWhatsapp = data?.supportContactWhatsapp || '';
        this.settings.supportContactMessage = data?.supportContactMessage || '';
          this.settings.verificationCallNumber = data?.verificationCallNumber || '';
          this.settings.platformFeeEnabled = !!data?.platformFeeEnabled;
          this.settings.platformFeePercent = typeof data?.platformFeePercent === 'number' ? data.platformFeePercent : 10;
          this.settings.gstPercent = typeof data?.gstPercent === 'number' ? data.gstPercent : 18;
          this.settings.earlyAccessAssignmentMode = data?.earlyAccessAssignmentMode === 'auto' ? 'auto' : 'manual';
          this.earlyAccessLastRunAt = data?.earlyAccessLastRunAt || null;
          this.earlyAccessLastRunStatus = String(data?.earlyAccessLastRunStatus || '');
          this.earlyAccessLastRunDetails = String(data?.earlyAccessLastRunDetails || '');
          this.settings.earlyAccessCommissionPercent = typeof data?.earlyAccessCommissionPercent === 'number' ? data.earlyAccessCommissionPercent : 0;
          this.settings.partnerCommissionPercent = typeof data?.partnerCommissionPercent === 'number' ? data.partnerCommissionPercent : 2;
          this.settings.internalTestCommissionPercent = typeof data?.internalTestCommissionPercent === 'number' ? data.internalTestCommissionPercent : 0;
          this.settings.showSearchLink = data?.showSearchLink !== false;
          this.settings.showRegisterInfluencerLink = data?.showRegisterInfluencerLink !== false;
          this.settings.showRegisterBrandLink = data?.showRegisterBrandLink !== false;
          this.settings.showRegisterPhotographerLink = data?.showRegisterPhotographerLink !== false;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  onCampaignApprovalModeToggle(isAutoLive: boolean) {
    this.settings.campaignApprovalMode = isAutoLive ? 'auto_live' : 'manual';
  }

  onCollaborationApprovalModeToggle(isAutoLive: boolean) {
    this.settings.collaborationApprovalMode = isAutoLive ? 'auto_live' : 'manual';
  }

  saveSettings() {
    this.settingsSaving = true;
    this.settingsSaved = false;
    this.cdr.detectChanges();
    const token = this.getToken();
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    // Safety: if the request hangs (backend down / network), unstick the button after 15s.
    const safetyTimer = setTimeout(() => {
      if (this.settingsSaving) {
        this.settingsSaving = false;
        alert('Save is taking too long. Check that the backend is running, then try again.');
        this.cdr.detectChanges();
      }
    }, 15000);

    this.http.patch<any>(`${environment.apiBaseUrl}/admin/settings`, this.settings, headers).subscribe({
      next: (res) => {
        clearTimeout(safetyTimer);
        // Confirm the saved doc actually contains our support fields. If the
        // backend hadn't picked up the schema change, those fields would be
        // missing from the returned `settings` and we'd warn the admin instead
        // of silently letting them think the save worked.
        const saved = (res && (res.settings ?? res.data?.settings)) || {};
        const persistedSupport =
          'supportContactEmail' in saved ||
          'supportContactPhone' in saved ||
          'supportContactWhatsapp' in saved ||
          'supportContactMessage' in saved ||
          'supportContactEnabled' in saved;
        this.settingsSaving = false;
        this.settingsSaved = true;
        this.cdr.detectChanges();
        this.loadSettings();
        if (!persistedSupport) {
          alert(
            'Saved, but support contact fields were not persisted. Please restart the backend so the new schema is loaded.',
          );
        }
        setTimeout(() => {
          this.settingsSaved = false;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (err) => {
        clearTimeout(safetyTimer);
        console.error('Settings save error:', err);
        this.settingsSaving = false;
        alert(`Error saving settings: ${err?.error?.message || err?.message || 'Unknown error'}`);
        this.cdr.detectChanges();
      }
    });
  }

  loadConfig() {
    const baseUrl = environment.apiBaseUrl;
    const token = this.getToken();
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    this.http.get(baseUrl + '/admin/social-media', headers).subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.socialMediaPlatforms = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
    });
    this.http.get(baseUrl + '/admin/categories', headers).subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.categories = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
    });
    this.http.get(baseUrl + '/equipment-options').subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.equipmentOptions = (data.length ? data : DEFAULT_EQUIPMENT_OPTIONS)
        .map((item: any) => ({ ...item, visible: item.visible !== false }));
    }, () => {
      this.config.equipmentOptions = DEFAULT_EQUIPMENT_OPTIONS.map((item: any) => ({ ...item }));
    });
    this.http.get(baseUrl + '/pricing-options').subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.pricingOptions = (data.length ? data : DEFAULT_PRICING_OPTIONS)
        .map((item: any) => ({ ...item, visible: item.visible !== false }));
    }, () => {
      this.config.pricingOptions = DEFAULT_PRICING_OPTIONS.map((item: any) => ({ ...item }));
    });
    this.http.get(baseUrl + '/admin/states', headers).subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.locations = data.map((state: any) => ({ ...state, visible: !!state.showInFrontend }));
    });
    this.http.get(baseUrl + '/admin/languages', headers).subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.languages = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
    });
    this.http.get(baseUrl + '/admin/tiers', headers).subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.tiers = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
    });
    this.http.get(baseUrl + '/admin/districts', headers).subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.districts = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
    });

    this.loadUserTagsConfig();
  }

  loadUserTagsConfig() {
    const token = this.getToken();
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    this.http.get<any>(`${environment.apiBaseUrl}/admin/user-tags-config`, headers).subscribe({
      next: (res) => {
        const data = res?.data ?? res ?? {};
        const defaults = this.getDefaultUserTags();
        this.config.userTags = {
          influencer: this.normalizeUserTagList(data?.influencer, defaults.influencer),
          brand: this.normalizeUserTagList(data?.brand, defaults.brand),
          photographer: this.normalizeUserTagList(data?.photographer, defaults.photographer),
          commission: this.normalizeUserTagList(data?.commission, defaults.commission),
        };
        this.cdr.detectChanges();
      },
      error: () => {
        this.config.userTags = this.getDefaultUserTags();
        this.cdr.detectChanges();
      }
    });
  }


  toggleVisible(type: string, idx: number, subIdx?: number) {
    // Only update local state, do not persist yet
    if (type === 'tiers') {
      const tier = this.config.tiers[idx];
      tier.visible = !tier.visible;
    } else if (type === 'socialMedia') {
      const sm = this.config.socialMediaPlatforms[idx];
      sm.visible = !sm.visible;
    } else if (type === 'categories') {
      const cat = this.config.categories[idx];
      cat.visible = !cat.visible;
    } else if (type === 'equipmentOptions') {
      const eq = this.config.equipmentOptions[idx];
      eq.visible = !eq.visible;
    } else if (type === 'pricingOptions') {
      const pricing = this.config.pricingOptions[idx];
      pricing.visible = !pricing.visible;
    } else if (type === 'languages') {
      const lang = this.config.languages[idx];
      lang.visible = !lang.visible;
    } else if (type === 'state') {
      const state = this.config.locations[idx];
      state.visible = !state.visible;
    } else if (type === 'district') {
      const district = this.config.districts[idx];
      district.visible = !district.visible;
    } else if (type === 'userTags') {
      const tag = this.filteredUserTags[idx];
      if (tag) {
        tag.visible = !tag.visible;
      }
    }
  }

  requestVisibilitySaveConfirmation() {
    this.showVisibilityConfirmModal = true;
  }

  cancelVisibilitySaveConfirmation() {
    this.showVisibilityConfirmModal = false;
  }

  confirmVisibilitySave() {
    this.showVisibilityConfirmModal = false;
    this.saveAllVisibility();
  }

  saveAllVisibility() {
    const baseUrl = environment.apiBaseUrl;
    if (!baseUrl) {
      return;
    }
    let payload: any = {};
    let reloadFn: () => void = () => {};
    switch (this.activeTab) {
      case 'tiers':
        payload = { tiers: this.config.tiers.map((t: any) => ({ _id: t._id, showInFrontend: t.visible })) };
        reloadFn = () => {
          this.http.get(baseUrl + '/admin/tiers', headers).subscribe((res: any) => {
            const data = Array.isArray(res) ? res : (res?.data || []);
            this.config.tiers = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
          });
        };
        break;
      case 'socialMedia':
        payload = { socialMedia: this.config.socialMediaPlatforms.map((s: any) => ({ _id: s._id, showInFrontend: s.visible })) };
        reloadFn = () => {
          this.http.get(baseUrl + '/admin/social-media', headers).subscribe((res: any) => {
            const data = Array.isArray(res) ? res : (res?.data || []);
            this.config.socialMediaPlatforms = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
          });
        };
        break;
      case 'categories':
        payload = { categories: this.config.categories.map((c: any) => ({ _id: c._id, showInFrontend: c.visible })) };
        reloadFn = () => {
          this.http.get(baseUrl + '/admin/categories', headers).subscribe((res: any) => {
            const data = Array.isArray(res) ? res : (res?.data || []);
            this.config.categories = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
          });
        };
        break;
      case 'languages':
        payload = { languages: this.config.languages.map((l: any) => ({ _id: l._id, showInFrontend: l.visible })) };
        reloadFn = () => {
          this.http.get(baseUrl + '/admin/languages', headers).subscribe((res: any) => {
            const data = Array.isArray(res) ? res : (res?.data || []);
            this.config.languages = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
          });
        };
        break;
      case 'location':
        payload = {
          states: this.config.locations.map((s: any) => ({ _id: s._id, showInFrontend: s.visible })),
          districts: this.config.districts.map((d: any) => ({ _id: d._id, showInFrontend: d.visible }))
        };
        reloadFn = () => {
          this.http.get(baseUrl + '/admin/states', headers).subscribe((res: any) => {
            const data = Array.isArray(res) ? res : (res?.data || []);
            this.config.locations = data.map((state: any) => ({ ...state, visible: !!state.showInFrontend }));
          });
          this.http.get(baseUrl + '/admin/districts', headers).subscribe((res: any) => {
            const data = Array.isArray(res) ? res : (res?.data || []);
            this.config.districts = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
          });
        };
        break;
      case 'userTags':
        payload = {
          userTags: {
            influencer: (this.config.userTags?.influencer || []).map((t: any) => ({
              name: String(t?.name || '').trim(),
              visible: t?.visible !== false,
            })).filter((t: any) => !!t.name),
            brand: (this.config.userTags?.brand || []).map((t: any) => ({
              name: String(t?.name || '').trim(),
              visible: t?.visible !== false,
            })).filter((t: any) => !!t.name),
            photographer: (this.config.userTags?.photographer || []).map((t: any) => ({
              name: String(t?.name || '').trim(),
              visible: t?.visible !== false,
            })).filter((t: any) => !!t.name),
            commission: (this.config.userTags?.commission || []).map((t: any) => ({
              name: String(t?.name || '').trim(),
              visible: t?.visible !== false,
            })).filter((t: any) => !!t.name),
          },
        };
        reloadFn = () => this.loadUserTagsConfig();
        break;
      default:
        // fallback to all
        payload = {
          tiers: this.config.tiers.map((t: any) => ({ _id: t._id, showInFrontend: t.visible })),
          socialMedia: this.config.socialMediaPlatforms.map((s: any) => ({ _id: s._id, showInFrontend: s.visible })),
          categories: this.config.categories.map((c: any) => ({ _id: c._id, showInFrontend: c.visible })),
          languages: this.config.languages.map((l: any) => ({ _id: l._id, showInFrontend: l.visible })),
          states: this.config.locations.map((s: any) => ({ _id: s._id, showInFrontend: s.visible })),
          districts: this.config.districts.map((d: any) => ({ _id: d._id, showInFrontend: d.visible })),
          userTags: {
            influencer: (this.config.userTags?.influencer || []).map((t: any) => ({
              name: String(t?.name || '').trim(),
              visible: t?.visible !== false,
            })).filter((t: any) => !!t.name),
            brand: (this.config.userTags?.brand || []).map((t: any) => ({
              name: String(t?.name || '').trim(),
              visible: t?.visible !== false,
            })).filter((t: any) => !!t.name),
            photographer: (this.config.userTags?.photographer || []).map((t: any) => ({
              name: String(t?.name || '').trim(),
              visible: t?.visible !== false,
            })).filter((t: any) => !!t.name),
            commission: (this.config.userTags?.commission || []).map((t: any) => ({
              name: String(t?.name || '').trim(),
              visible: t?.visible !== false,
            })).filter((t: any) => !!t.name),
          },
        };
        reloadFn = () => this.loadConfig();
    }
    // debug: batch update payload
    const token = this.getToken();
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    this.http.post(baseUrl + '/admin/batch-update-visibility', payload, headers)
      .subscribe({
        next: () => {
          alert('Visibility updated successfully!');
          reloadFn();
        },
        error: (err) => {
          alert('Error saving visibility.');
          console.error('Batch update error:', err);
        }
      });
  }

  loadCommissionCounts() {
    const token = this.getToken();
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const base = environment.apiBaseUrl;

    const influencerBadges: (keyof typeof this.commissionCounts.influencer)[] =
      ['early_access_creator', 'partner_creator', 'internal_test_creator'];
    const brandBadges: (keyof typeof this.commissionCounts.brand)[] =
      ['early_access_brand', 'partner_brand', 'internal_test_brand'];

    influencerBadges.forEach(badge => {
      this.http.get<any>(`${base}/admin/users-by-commission-badge/influencer/${badge}`, headers).subscribe({
        next: (res) => {
          const data = res?.data ?? res;
          this.commissionCounts.influencer[badge] = data.count || 0;
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    });

    brandBadges.forEach(badge => {
      this.http.get<any>(`${base}/admin/users-by-commission-badge/brand/${badge}`, headers).subscribe({
        next: (res) => {
          const data = res?.data ?? res;
          this.commissionCounts.brand[badge] = data.count || 0;
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    });
  }

  runEarlyAccessRefillNow() {
    if (this.settings.earlyAccessAssignmentMode !== 'auto') {
      this.earlyAccessRefillMessage = 'Switch to Auto mode and save settings before running refill.';
      this.cdr.detectChanges();
      return;
    }

    if (this.earlyAccessRefillRunning) return;

    this.earlyAccessRefillRunning = true;
    this.earlyAccessRefillMessage = '';
    this.cdr.detectChanges();

    const token = this.getToken();
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    this.http.post<any>(`${environment.apiBaseUrl}/admin/early-access/auto-assign`, {}, headers)
      .subscribe({
        next: (res) => {
          const data = res?.data ?? res;
          this.earlyAccessLastRunAt = data?.lastRunAt || this.earlyAccessLastRunAt;
          this.earlyAccessLastRunStatus = String(data?.lastRunStatus || this.earlyAccessLastRunStatus || '');
          this.earlyAccessLastRunDetails = String(data?.lastRunDetails || this.earlyAccessLastRunDetails || '');
          if (data?.skipped) {
            this.earlyAccessRefillMessage = 'Skipped: Early Access assignment mode is Manual.';
          } else {
            const inflAssigned = Number(data?.influencers?.assignedCount || 0);
            const brandAssigned = Number(data?.brands?.assignedCount || 0);
            const inflReleased = Number(data?.influencers?.releasedCount || 0);
            const brandReleased = Number(data?.brands?.releasedCount || 0);
            this.earlyAccessRefillMessage =
              `Refill complete. Assigned ${inflAssigned} influencers + ${brandAssigned} brands. ` +
              `Released ${inflReleased} influencer slots + ${brandReleased} brand slots.`;
            this.loadCommissionCounts();
          }
          this.loadSettings();
          this.earlyAccessRefillRunning = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.earlyAccessRefillRunning = false;
          this.earlyAccessRefillMessage = `Refill failed: ${err?.error?.message || err?.message || 'Unknown error'}`;
          this.cdr.detectChanges();
        }
      });
  }

  loadEarlyAccessRefillPreview() {
    if (this.earlyAccessPreviewLoading) return;

    this.earlyAccessPreviewLoading = true;
    this.cdr.detectChanges();

    const token = this.getToken();
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    this.http.get<any>(`${environment.apiBaseUrl}/admin/early-access/auto-assign/preview`, headers)
      .subscribe({
        next: (res) => {
          const data = res?.data ?? res;
          this.earlyAccessPreview = data || null;
          this.earlyAccessPreviewRefreshedAt = new Date();
          this.earlyAccessPreviewLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.earlyAccessPreviewLoading = false;
          this.earlyAccessPreview = null;
          this.earlyAccessPreviewRefreshedAt = null;
          this.cdr.detectChanges();
        }
      });
  }

  formatPreviewUser(user: any): string {
    const displayName = String(user?.name || user?.brandName || 'Unknown');
    const email = String(user?.email || '').trim();
    return email ? `${displayName} (${email})` : displayName;
  }

  private buildEarlyAccessPreviewText(): string {
    if (!this.earlyAccessPreview) {
      return 'Early Access preview is empty. Run Preview Refill first.';
    }

    const preview = this.earlyAccessPreview;
    const inf = preview?.influencers || {};
    const br = preview?.brands || {};
    const infUsers = Array.isArray(inf?.previewUsers) ? inf.previewUsers : [];
    const brUsers = Array.isArray(br?.previewUsers) ? br.previewUsers : [];
    const influencerList = infUsers.length
      ? infUsers.map((u: any) => this.formatPreviewUser(u)).join(', ')
      : 'None';
    const brandList = brUsers.length
      ? brUsers.map((u: any) => this.formatPreviewUser(u)).join(', ')
      : 'None';

    return [
      'Early Access Refill Preview',
      `Mode: ${String(preview?.mode || 'manual')}`,
      '',
      'Influencers',
      `Active: ${Number(inf?.activeCount || 0)}/${Number(inf?.cap || 0)}`,
      `Open slots: ${Number(inf?.slotsOpen || 0)}`,
      `Eligible: ${Number(inf?.eligibleCount || 0)}`,
      `Top candidates: ${influencerList}`,
      '',
      'Brands',
      `Active: ${Number(br?.activeCount || 0)}/${Number(br?.cap || 0)}`,
      `Open slots: ${Number(br?.slotsOpen || 0)}`,
      `Eligible: ${Number(br?.eligibleCount || 0)}`,
      `Top candidates: ${brandList}`,
    ].join('\n');
  }

  copyEarlyAccessPreview() {
    const text = this.buildEarlyAccessPreviewText();
    this.earlyAccessPreviewCopyMessage = '';

    if (typeof window === 'undefined') {
      this.earlyAccessPreviewCopyMessage = 'Copy unavailable on server.';
      this.cdr.detectChanges();
      return;
    }

    const fallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      this.earlyAccessPreviewCopyMessage = copied
        ? 'Preview copied.'
        : 'Copy failed. Please copy manually.';
      this.cdr.detectChanges();
    };

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          this.earlyAccessPreviewCopyMessage = 'Preview copied.';
          this.cdr.detectChanges();
        })
        .catch(() => fallbackCopy());
      return;
    }

    fallbackCopy();
  }

  runNormalizeExistingCommissionTags() {
    if (this.earlyAccessNormalizeRunning) return;

    this.earlyAccessNormalizeRunning = true;
    this.earlyAccessNormalizeMessage = '';
    this.cdr.detectChanges();

    const token = this.getToken();
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    this.http.post<any>(`${environment.apiBaseUrl}/admin/early-access/normalize-existing-tags`, {}, headers)
      .subscribe({
        next: (res) => {
          const data = res?.data ?? res;
          const inflUpdated = Number(data?.influencers?.updatedCount || 0);
          const brandUpdated = Number(data?.brands?.updatedCount || 0);
          this.earlyAccessNormalizeMessage =
            `Normalized ${inflUpdated} influencer + ${brandUpdated} brand records.`;
          this.earlyAccessNormalizeRunning = false;
          this.loadCommissionCounts();
          this.loadEarlyAccessRefillPreview();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.earlyAccessNormalizeRunning = false;
          this.earlyAccessNormalizeMessage =
            `Normalize failed: ${err?.error?.message || err?.message || 'Unknown error'}`;
          this.cdr.detectChanges();
        }
      });
  }
}
