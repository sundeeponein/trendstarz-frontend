import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface TrustBadgeItem {
  icon: string;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-trust-badges-strip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trust-badges-strip.component.html',
  styleUrls: ['./trust-badges-strip.component.scss'],
})
export class TrustBadgesStripComponent {
  @Input() items: TrustBadgeItem[] = [
    { icon: 'bi-person-check', title: 'Verified Profiles', subtitle: 'Manually reviewed & verified' },
    { icon: 'bi-tag', title: 'Transparent Pricing', subtitle: 'See starting prices upfront' },
    { icon: 'bi-shield-lock', title: 'Secure Platform', subtitle: 'Safe payments & data' },
    { icon: 'bi-heart', title: 'Trusted by Brands', subtitle: 'Growing creator network' },
  ];
}
