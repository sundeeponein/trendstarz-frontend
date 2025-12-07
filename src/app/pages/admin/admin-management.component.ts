import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';

@Component({
  selector: 'app-admin-management',
  standalone: true,
  imports: [CommonModule],
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
    }
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  loadConfig() {
    // Fetch all management data from backend using environment.apiBaseUrl
    const baseUrl = (window as any).environment?.apiBaseUrl || 'https://trendstarz-backend-on1h.onrender.com';
    this.http.get(baseUrl + '/social-media').subscribe((data: any) => {
      this.config.socialMediaPlatforms = Array.isArray(data) ? data.map((item: any) => ({ ...item, visible: !!item.showInFrontend })) : [];
    });
    this.http.get(baseUrl + '/categories').subscribe((data: any) => {
      this.config.categories = Array.isArray(data) ? data.map((item: any) => ({ ...item, visible: !!item.showInFrontend })) : [];
    });
    this.http.get(baseUrl + '/states').subscribe((data: any) => {
      this.config.locations = Array.isArray(data)
        ? data.map((state: any) => ({
            ...state,
            visible: !!state.showInFrontend,
            districts: (state.districts || []).map((dist: any) => ({ ...dist, visible: !!dist.showInFrontend }))
          }))
        : [];
    });
    this.http.get(baseUrl + '/languages').subscribe((data: any) => {
      this.config.languages = Array.isArray(data) ? data.map((item: any) => ({ ...item, visible: !!item.showInFrontend })) : [];
    });
    this.http.get(baseUrl + '/tiers').subscribe((data: any) => {
      this.config.tiers = Array.isArray(data) ? data.map((item: any) => ({ ...item, visible: !!item.showInFrontend })) : [];
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
    } else if (type === 'district' && subIdx !== undefined) {
      const dist = this.config.locations[idx].districts[subIdx];
      dist.visible = !dist.visible;
    }
  }

  saveAllVisibility() {
    const baseUrl = (window as any).environment?.apiBaseUrl || 'https://trendstarz-backend-on1h.onrender.com';
    const payload = {
      tiers: this.config.tiers.map((t: any) => ({ _id: t._id, showInFrontend: t.visible })),
      socialMedia: this.config.socialMediaPlatforms.map((s: any) => ({ _id: s._id, showInFrontend: s.visible })),
      categories: this.config.categories.map((c: any) => ({ _id: c._id, showInFrontend: c.visible })),
      languages: this.config.languages.map((l: any) => ({ _id: l._id, showInFrontend: l.visible })),
      states: this.config.locations.map((s: any) => ({ _id: s._id, showInFrontend: s.visible })),
      districts: ([] as any[]).concat(...this.config.locations.map((s: any) => (s.districts || []).map((d: any) => ({ _id: d._id, showInFrontend: d.visible }))))
    };
    this.http.post(baseUrl + '/admin/batch-update-visibility', payload)
      .subscribe({
        next: () => {
          alert('Visibility updated successfully!');
          this.loadConfig();
        },
        error: (err) => {
          alert('Error saving visibility.');
          console.error('Batch update error:', err);
        }
      });
  }
}
