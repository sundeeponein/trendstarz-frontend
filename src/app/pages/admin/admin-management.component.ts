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
    // Fetch all management data from backend
    this.http.get('/api/social-media').subscribe((data: any) => {
      this.config.socialMediaPlatforms = Array.isArray(data) ? data : [];
    });
    this.http.get('/api/categories').subscribe((data: any) => {
      this.config.categories = Array.isArray(data) ? data : [];
    });
    this.http.get('/api/states').subscribe((data: any) => {
      this.config.locations = Array.isArray(data) ? data : [];
    });
    this.http.get('/api/languages').subscribe((data: any) => {
      this.config.languages = Array.isArray(data) ? data : [];
    });
    this.http.get('/api/tiers').subscribe((data: any) => {
      this.config.tiers = Array.isArray(data) ? data : [];
    });
  }

  toggleVisible(type: string, idx: number, subIdx?: number) {
    if (type === 'socialMedia') {
      this.config.socialMediaPlatforms[idx].visible = !this.config.socialMediaPlatforms[idx].visible;
    } else if (type === 'categories') {
      this.config.categories[idx].visible = !this.config.categories[idx].visible;
    } else if (type === 'languages') {
      this.config.languages[idx].visible = !this.config.languages[idx].visible;
    } else if (type === 'tiers') {
      this.config.tiers[idx].visible = !this.config.tiers[idx].visible;
    } else if (type === 'state') {
      this.config.locations[idx].visible = !this.config.locations[idx].visible;
    } else if (type === 'district' && subIdx !== undefined) {
      this.config.locations[idx].districts[subIdx].visible = !this.config.locations[idx].districts[subIdx].visible;
    }
    // TODO: Save config changes to backend via API
  }
}
