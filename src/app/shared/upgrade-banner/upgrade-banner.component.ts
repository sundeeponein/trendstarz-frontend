import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-upgrade-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upgrade-banner.component.html',
  styleUrls: ['./upgrade-banner.component.scss']
})
export class UpgradeBannerComponent {
  @Input() message: string = '';
  onUpgrade() {
    // Redirect to upgrade page or open modal
    window.location.href = '/upgrade-premium';
  }
}
