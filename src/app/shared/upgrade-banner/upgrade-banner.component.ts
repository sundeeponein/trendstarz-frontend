import { Component } from '@angular/core';

@Component({
  selector: 'app-upgrade-banner',
  standalone: true,
  templateUrl: './upgrade-banner.component.html',
  styleUrls: ['./upgrade-banner.component.scss']
})
export class UpgradeBannerComponent {
  onUpgrade() {
    // Redirect to upgrade page or open modal
    window.location.href = '/upgrade-premium';
  }
}
