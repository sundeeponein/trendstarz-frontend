import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * Reusable consent toggle for the featuredInMarketing field — shown in
 * account settings and on each role's edit-profile page. Copy is
 * intentionally generic (not "photo") since it covers Influencer profile
 * photos, Brand logos, and Photographer portfolio photos alike.
 *
 * Homepage Hero Feature is a Premium benefit — non-Premium users see an
 * upsell instead of the toggle (see isPremium input). Server-side, this is
 * also enforced in setMarketingConsent and the requirePremium query filter,
 * so this is UX, not the real gate.
 */
@Component({
  selector: 'app-homepage-feature-toggle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './homepage-feature-toggle.component.html',
  styleUrls: ['./homepage-feature-toggle.component.scss'],
})
export class HomepageFeatureToggleComponent {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() isPremium = true;
  @Input() visibilityLabel = 'Public';
  @Output() checkedChange = new EventEmitter<boolean>();

  get isUnavailable(): boolean {
    return this.disabled || !this.isPremium;
  }

  get helperText(): string {
    if (!this.isPremium) {
      return 'Upgrade to Premium to become eligible for the homepage spotlight.';
    }

    if (this.disabled) {
      return 'Available only for Public profiles. Change your profile visibility to Public to feature your profile on the homepage.';
    }

    return 'Allow TrendStarZ to feature your profile in the homepage spotlight and help you get discovered by brands and visitors.';
  }

  onChange(): void {
    if (this.isUnavailable) return;
    this.checkedChange.emit(!this.checked);
  }
}
