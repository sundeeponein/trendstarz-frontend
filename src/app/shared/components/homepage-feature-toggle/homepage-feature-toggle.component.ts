import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable consent toggle for the featuredInMarketing field — shown in
 * account settings and on each role's edit-profile page. Copy is
 * intentionally generic (not "photo") since it covers Influencer profile
 * photos, Brand logos, and Photographer portfolio photos alike.
 */
@Component({
  selector: 'app-homepage-feature-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './homepage-feature-toggle.component.html',
  styleUrls: ['./homepage-feature-toggle.component.scss'],
})
export class HomepageFeatureToggleComponent {
  @Input() checked = false;
  @Input() disabled = false;
  @Output() checkedChange = new EventEmitter<boolean>();

  onChange(): void {
    if (this.disabled) return;
    this.checkedChange.emit(!this.checked);
  }
}
