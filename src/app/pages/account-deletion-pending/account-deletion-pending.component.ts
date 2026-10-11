import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';

/**
 * Shown right after login when the account has a pending self-deletion
 * request (see AuthService.buildDeletionPendingLoginResponse) — the login
 * token issued for this state only works against cancel-deletion /
 * deletion-status (JwtAuthGuard blocks every other endpoint), so this page
 * is the only thing the user can do until they either cancel or let the
 * grace period run out.
 */
@Component({
  selector: 'app-account-deletion-pending',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './account-deletion-pending.component.html',
  styleUrls: ['./account-deletion-pending.component.scss'],
})
export class AccountDeletionPendingComponent implements OnInit {
  loading = true;
  cancelling = false;
  deletionPending = false;
  gracePeriodEndsAt: Date | null = null;
  error = '';

  constructor(
    private readonly config: ConfigService,
    private readonly session: SessionService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const userId = this.session.getUser()?.id;
    if (!userId) {
      this.goToLogin();
      return;
    }
    this.config.getSelfDeletionStatus(userId).subscribe((status) => {
      this.loading = false;
      this.deletionPending = !!status?.deletionPending;
      this.gracePeriodEndsAt = status?.gracePeriodEndsAt ? new Date(status.gracePeriodEndsAt) : null;
      if (!this.deletionPending) {
        // Already cancelled/expired elsewhere — nothing to do here.
        this.goToLogin();
      }
    });
  }

  get daysRemaining(): number | null {
    if (!this.gracePeriodEndsAt) return null;
    const ms = this.gracePeriodEndsAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  cancelDeletion(): void {
    const userId = this.session.getUser()?.id;
    if (this.cancelling || !userId) return;
    this.cancelling = true;
    this.error = '';
    this.config.cancelSelfDeletion(userId).subscribe({
      next: () => {
        this.cancelling = false;
        // The restricted token from the pending-deletion login can't be used
        // for normal endpoints — send them back to log in fresh.
        this.session.clearSession();
        this.router.navigate(['/login'], { queryParams: { reactivated: '1' } });
      },
      error: () => {
        this.cancelling = false;
        this.error = 'Could not cancel deletion. Please try again.';
      },
    });
  }

  goToLogin(): void {
    this.session.clearSession();
    this.router.navigate(['/login']);
  }
}
