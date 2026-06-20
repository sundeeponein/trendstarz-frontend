import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-registration-notice',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './registration-notice.component.html',
  styleUrls: ['./registration-notice.component.scss'],
})
export class RegistrationNoticeComponent {
  /** Show the green "activated on email verify" line — registration pages only */
  @Input() showActivationNotice = false;
  /** Show the orange "accounts may be removed" moderation warning */
  @Input() showModerationWarning = false;
  @Input() role: 'influencer' | 'brand' | 'photographer' | null = null;

  get noGuaranteeText(): string | null {
    switch (this.role) {
      case 'influencer':
        return 'Registration does not guarantee collaborations, campaign approvals, creator selections, or paid promotions.';
      case 'photographer':
        return 'Registration does not guarantee project assignments, collaborations, or paid opportunities.';
      case 'brand':
        return 'Creator participation depends on creator interest, eligibility, availability, and campaign requirements.';
      default:
        return null;
    }
  }

  get hasContent(): boolean {
    return this.showActivationNotice || this.showModerationWarning || !!this.noGuaranteeText;
  }
}
