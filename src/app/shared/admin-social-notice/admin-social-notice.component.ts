import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { tierWithRange } from '../tiers.constants';

/**
 * "Your social media details were updated by Admin" — the creator's notice after an
 * admin (or the automatic YouTube tier update) changed a handle or tier: old → new
 * (tier with its follower range), by whom, when, and Confirm / Edit / Cancel.
 * Shared by the influencer and photographer dashboards.
 */
@Component({
  selector: 'app-admin-social-notice',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-social-notice.component.html',
  styleUrls: ['./admin-social-notice.component.scss'],
})
export class AdminSocialNoticeComponent {
  @Input() notifications: any[] = [];
  /** undefined = just dismiss; otherwise the creator's answer. */
  @Output() respond = new EventEmitter<'confirmed' | 'cancelled' | undefined>();
  @Output() edit = new EventEmitter<void>();

  readonly tierWithRange = tierWithRange;
}
