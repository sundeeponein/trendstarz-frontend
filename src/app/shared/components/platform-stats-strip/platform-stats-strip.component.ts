import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface PlatformStatItem {
  icon: string;
  value: string;
  label: string;
}

@Component({
  selector: 'app-platform-stats-strip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './platform-stats-strip.component.html',
  styleUrls: ['./platform-stats-strip.component.scss'],
})
export class PlatformStatsStripComponent {
  @Input() items: PlatformStatItem[] = [
    { icon: 'bi-people-fill', value: '100+', label: 'Verified Creators' },
    { icon: 'bi-briefcase-fill', value: '50+', label: 'Active Brands' },
    { icon: 'bi-camera-fill', value: '20+', label: 'Photo/VideoGraphers' },
    { icon: 'bi-patch-check-fill', value: '500+', label: 'Campaigns Created' },
  ];
}
