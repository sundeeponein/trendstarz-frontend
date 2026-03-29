import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-management.component.html',
  styleUrls: ['./admin-management.component.scss']
})
export class AdminManagementComponent implements OnInit {
  activeTab: string = 'influencer';
  config: any = {
    socialMediaPlatforms: [],
    categories: [],
    locations: [],
    languages: [],
    tiers: []
  };

  settings = {
    preApproveInfluencers: false,
    influencerRequireEmailVerified: true,
    influencerRequireMobileVerified: false,
    preApproveBrands: false,
    brandRequireEmailVerified: true,
    brandRequireMobileVerified: false,
  };
  settingsSaving = false;
  settingsSaved = false;

  isServer: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isServer = isPlatformServer(this.platformId);
  }

  ngOnInit() {
    if (!this.isServer) {
      this.loadConfig();
      this.loadSettings();
    }
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  loadSettings() {
    const token = localStorage.getItem('token');
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    this.http.get<any>(`${environment.apiBaseUrl}/admin/settings`, headers).subscribe({
      next: (res) => {
        this.settings.preApproveInfluencers = !!res?.preApproveInfluencers;
        this.settings.influencerRequireEmailVerified = res?.influencerRequireEmailVerified !== false;
        this.settings.influencerRequireMobileVerified = !!res?.influencerRequireMobileVerified;
        this.settings.preApproveBrands = !!res?.preApproveBrands;
        this.settings.brandRequireEmailVerified = res?.brandRequireEmailVerified !== false;
        this.settings.brandRequireMobileVerified = !!res?.brandRequireMobileVerified;
      },
      error: () => {}
    });
  }

  saveSettings() {
    this.settingsSaving = true;
    this.settingsSaved = false;
    const token = localStorage.getItem('token');
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    this.http.patch<any>(`${environment.apiBaseUrl}/admin/settings`, this.settings, headers).subscribe({
      next: () => {
        this.settingsSaving = false;
        this.settingsSaved = true;
        setTimeout(() => this.settingsSaved = false, 3000);
      },
      error: () => {
        this.settingsSaving = false;
        alert('Error saving settings.');
      }
    });
  }

  loadConfig() {
    const baseUrl = environment.apiBaseUrl;
    this.http.get(baseUrl + '/social-media').subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.socialMediaPlatforms = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
    });
    this.http.get(baseUrl + '/categories').subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.categories = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
    });
    this.http.get(baseUrl + '/states').subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.locations = data.map((state: any) => ({ ...state, visible: !!state.showInFrontend }));
    });
    this.http.get(baseUrl + '/languages').subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.languages = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
    });
    this.http.get(baseUrl + '/tiers').subscribe((res: any) => {
      const data = Array.isArray(res) ? res : (res?.data || []);
      this.config.tiers = data.map((item: any) => ({ ...item, visible: !!item.showInFrontend }));
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
    } else if (type === 'languages') {
      const lang = this.config.languages[idx];
      lang.visible = !lang.visible;
    } else if (type === 'state') {
      const state = this.config.locations[idx];
      state.visible = !state.visible;
    }
  }

  saveAllVisibility() {
    const baseUrl = environment.apiBaseUrl;
    if (!baseUrl) {
  // console.error('API base URL is not set in environment.');
      return;
    }

    const payload = {
      tiers: this.config.tiers.map((t: any) => ({ _id: t._id, showInFrontend: t.visible })),
      socialMedia: this.config.socialMediaPlatforms.map((s: any) => ({ _id: s._id, showInFrontend: s.visible })),
      categories: this.config.categories.map((c: any) => ({ _id: c._id, showInFrontend: c.visible })),
      languages: this.config.languages.map((l: any) => ({ _id: l._id, showInFrontend: l.visible })),
      states: this.config.locations.map((s: any) => ({ _id: s._id, showInFrontend: s.visible }))
    };
  // console.log('[BatchUpdate] Payload:', payload);
    const token = localStorage.getItem('token');
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    this.http.post(baseUrl + '/admin/batch-update-visibility', payload, headers)
      .subscribe({
        next: () => {
          alert('Visibility updated successfully!');
          this.loadConfig();
        },
        error: (err) => {
          alert('Error saving visibility.');
          // console.error('Batch update error:', err);
        }
      });
  }
}
