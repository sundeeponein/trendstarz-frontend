import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-management.component.html',
  styleUrls: ['./admin-management.component.scss']
})
export class AdminManagementComponent implements OnInit {
  activeTab: string = 'influencer';
  config: any = {};

  ngOnInit() {
    this.loadConfig();
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  loadConfig() {
    // TODO: Fetch config from backend API instead of static file/localStorage
    // Example: this.http.get('/api/admin/config').subscribe(cfg => this.config = cfg);
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
