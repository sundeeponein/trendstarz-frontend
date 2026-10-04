import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileVerificationDashboard } from '../../../services/profile-verification.service';

type StepIcon = 'done' | 'active' | 'upcoming';

/**
 * Self-service "what do I still need to do?" tracker — Email → Mobile →
 * Admin Review. Deliberately never mentions auto-delete/retention policy;
 * from the user's side this is just "here's your next step," internal
 * cleanup rules stay internal. Driven entirely by the existing
 * ProfileVerificationService dashboard (getMyDashboard), so it always agrees
 * with the admin's own view of the same account — no separate source of truth.
 */
@Component({
  selector: 'app-registration-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './registration-progress.component.html',
  styleUrls: ['./registration-progress.component.scss'],
})
export class RegistrationProgressComponent {
  @Input() dashboard: ProfileVerificationDashboard | null = null;
  /** Whether OTP self-verification is on for this deployment — otherwise mobile verification is manual/callback-based. */
  @Input() otpVerificationEnabled = false;
  @Input() resendingEmailVerification = false;
  @Input() requestingMobileCallback = false;
  @Input() mobileCallbackRequested = false;
  @Input() resendingMobileOtp = false;

  @Output() resendEmail = new EventEmitter<void>();
  @Output() resendOtp = new EventEmitter<void>();
  @Output() requestCallback = new EventEmitter<void>();
  @Output() updateProfile = new EventEmitter<void>();

  get emailVerified(): boolean {
    return this.dashboard?.verificationChecks?.['emailVerified'] === true;
  }

  get mobileVerified(): boolean {
    return this.dashboard?.verificationChecks?.['mobileVerified'] === true;
  }

  get accountStatus(): string {
    return this.dashboard?.accountStatus || 'pending';
  }

  get isDeclined(): boolean {
    return this.accountStatus === 'declined';
  }

  /**
   * accountStatus "accepted" alone isn't enough — an admin can Accept an
   * account independently of email/mobile verification (they're separate
   * fields), which would otherwise show "Admin Approved" as done while a
   * step above it still reads "Pending." Requiring both keeps the three
   * rows from ever contradicting each other.
   */
  get isApproved(): boolean {
    return this.accountStatus === 'accepted' && this.emailVerified && this.mobileVerified;
  }

  get declineReason(): string {
    return (this.dashboard?.declineReason || '').trim();
  }

  get emailStep(): StepIcon {
    return this.emailVerified ? 'done' : 'active';
  }

  get mobileStep(): StepIcon {
    if (this.mobileVerified) return 'done';
    return this.emailVerified ? 'active' : 'upcoming';
  }

  get adminReviewStep(): StepIcon {
    if (this.isApproved) return 'done';
    return this.emailVerified && this.mobileVerified ? 'active' : 'upcoming';
  }

  /** Which single next-action block to show below the tracker rows. */
  get activeStage(): 'email' | 'mobile' | 'admin_review' | 'approved' | null {
    if (this.isDeclined) return null;
    if (!this.emailVerified) return 'email';
    if (!this.mobileVerified) return 'mobile';
    if (!this.isApproved) return 'admin_review';
    return 'approved';
  }
}
