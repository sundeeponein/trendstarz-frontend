import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileVisibility } from '../../config.service';

interface VisibilityOption {
  value: ProfileVisibility;
  icon: string;
  label: string;
  description: string;
}

/**
 * Reusable "Who can view my profile?" control — used in registration,
 * edit-profile, and Settings → Privacy & Visibility. See the eligibility
 * matrix in profile-eligibility.util.ts (backend) for what each tier
 * actually gates: Guest/Logged-in visibility, Search, and Homepage Feature.
 */
@Component({
  selector: 'app-profile-visibility-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-visibility-selector.component.html',
  styleUrls: ['./profile-visibility-selector.component.scss'],
})
export class ProfileVisibilitySelectorComponent {
  @Input() value: ProfileVisibility = 'PUBLIC';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<ProfileVisibility>();

  readonly options: VisibilityOption[] = [
    {
      value: 'PUBLIC',
      icon: '🌍',
      label: 'Public (Guests & Logged-in Users)',
      description:
        'Recommended for creators looking for brand collaborations. Visible to visitors, in creator/brand search, and eligible for the homepage feature (if enabled).',
    },
    {
      value: 'MEMBERS_ONLY',
      icon: '🔒',
      label: 'Logged-in Users Only',
      description:
        'Only registered TrendStarZ users can view your profile. Hidden from guests and search engines, but still findable in search by logged-in users.',
    },
    {
      value: 'PRIVATE',
      icon: '👤',
      label: 'Private',
      description:
        'Hidden from everyone except you and TrendStarZ admins. Not shown in search, listings, or the homepage.',
    },
  ];

  select(value: ProfileVisibility): void {
    if (this.disabled || value === this.value) return;
    this.valueChange.emit(value);
  }
}
