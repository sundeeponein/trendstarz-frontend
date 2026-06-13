import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProfileVerificationDashboard } from '../../services/profile-verification.service';

@Component({
  selector: 'app-profile-review-summary',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="review-summary" *ngIf="detail || loading">
      <div class="summary-loading" *ngIf="loading">
        <span class="spinner-border spinner-border-sm text-warning" role="status"></span>
        <span>Loading review...</span>
      </div>

      <ng-container *ngIf="!loading && detail as data">
        <div class="summary-grid">
          <div>
            <span>Profile</span>
            <strong>{{ data.profileCompletion || 0 }}%</strong>
          </div>
          <div>
            <span>Campaign</span>
            <strong [class.blocked]="!data.campaignEligibility.eligible">
              {{ data.campaignEligibility.eligible ? 'Enabled' : 'Blocked' }}
            </strong>
          </div>
        </div>
        <button type="button" class="summary-link" (click)="open = true">
          View review
        </button>
      </ng-container>
    </div>

    <div class="review-modal-backdrop" *ngIf="open" (click)="open = false">
      <div class="review-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <div class="review-modal-header">
          <div>
            <p>Profile Review</p>
            <h3>{{ detail?.displayName || 'Profile' }}</h3>
          </div>
          <button type="button" class="close-btn" aria-label="Close" (click)="open = false">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="review-modal-body">
          <div class="simple-review" *ngIf="detail as data">
            <div class="simple-card">
              <span>Profile completion</span>
              <strong>{{ data.profileCompletion || 0 }}%</strong>
              <div class="meter"><i [style.width.%]="data.profileCompletion || 0"></i></div>
            </div>
            <div class="simple-card">
              <span>Campaign status</span>
              <strong [class.blocked]="!data.campaignEligibility.eligible">
                {{ data.campaignEligibility.eligible ? 'Enabled' : 'Blocked' }}
              </strong>
              <p *ngIf="data.campaignEligibility.eligible">Your profile can participate in eligible campaigns.</p>
              <ul *ngIf="!data.campaignEligibility.eligible">
                <li *ngFor="let blocker of data.campaignEligibility.blockers">{{ blocker }}</li>
              </ul>
            </div>
            <div class="simple-card">
              <span>Review status</span>
              <strong>{{ data.verificationStatus }}</strong>
              <p *ngIf="getAttentionItems(data).length">{{ getAttentionItems(data).length }} item{{ getAttentionItems(data).length === 1 ? '' : 's' }} need attention.</p>
              <p *ngIf="!getAttentionItems(data).length">No open review issues.</p>
            </div>

            <div class="simple-card">
              <span>Verified</span>
              <ul class="status-list ok" *ngIf="getVerifiedItems(data).length; else noVerifiedItems">
                <li *ngFor="let item of getVerifiedItems(data)">
                  <i class="bi bi-check-circle-fill"></i>
                  {{ item }}
                </li>
              </ul>
              <ng-template #noVerifiedItems>
                <p>No completed checks yet.</p>
              </ng-template>
            </div>

            <div class="simple-card attention">
              <span>Needs attention</span>
              <ul class="status-list" *ngIf="getAttentionItems(data).length; else noAttentionItems">
                <li *ngFor="let item of getAttentionItems(data)">
                  <i class="bi bi-exclamation-triangle"></i>
                  {{ item }}
                </li>
              </ul>
              <ng-template #noAttentionItems>
                <p>No changes requested.</p>
              </ng-template>
            </div>
          </div>
        </div>

        <div class="review-modal-actions" *ngIf="profileRoute">
          <a [routerLink]="profileRoute" (click)="open = false">
            <i class="bi bi-person-gear"></i>
            Edit profile
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .review-summary {
      margin-top: 0.65rem;
      display: grid;
      gap: 0.55rem;
    }
    .summary-loading {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      color: #64748b;
      font-weight: 800;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
    }
    .summary-grid > div {
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(215, 222, 234, 0.8);
      padding: 0.45rem 0.55rem;
      display: grid;
      gap: 0.05rem;
    }
    .summary-grid span {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    .summary-grid strong {
      color: #198754;
      font-size: 0.95rem;
      line-height: 1.15;
    }
    .summary-grid strong.blocked {
      color: #bd2d20;
    }
    .summary-link {
      justify-self: start;
      border: 0;
      background: transparent;
      color: #0d6efd;
      padding: 0;
      font-weight: 900;
      text-decoration: underline;
    }
    .review-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1080;
      background: rgba(7, 12, 22, 0.6);
      display: grid;
      place-items: center;
      padding: 1rem;
    }
    .review-modal {
      width: min(980px, 100%);
      max-height: min(86vh, 900px);
      overflow: hidden;
      background: #fff;
      border-radius: 12px;
      border: 1px solid #d7deea;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.24);
    }
    .review-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-shrink: 0;
      padding: 1rem;
      border-bottom: 1px solid #e8edf5;
    }
    .review-modal-header p {
      margin: 0 0 0.15rem;
      color: #657082;
      font-size: 0.78rem;
      font-weight: 900;
      text-transform: uppercase;
    }
    .review-modal-header h3 {
      margin: 0;
      color: #16162f;
      font-weight: 900;
    }
    .close-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid #d7deea;
      background: #fff;
      color: #16162f;
    }
    .review-modal-actions {
      display: flex;
      justify-content: flex-end;
      flex-shrink: 0;
      padding: 1rem;
      border-top: 1px solid #e8edf5;
      background: #fff;
    }
    .review-modal-body {
      min-height: 0;
      overflow-y: auto;
      padding: 1rem;
    }
    .simple-review {
      display: grid;
      gap: 0.75rem;
    }
    .simple-card {
      border: 1px solid #e1e6ef;
      border-radius: 10px;
      padding: 0.85rem;
      background: #fbfcfe;
      display: grid;
      gap: 0.35rem;
    }
    .simple-card span {
      color: #657082;
      font-size: 0.78rem;
      font-weight: 900;
      text-transform: uppercase;
    }
    .simple-card strong {
      color: #198754;
      font-size: 1.25rem;
      line-height: 1.2;
    }
    .simple-card strong.blocked {
      color: #bd2d20;
    }
    .simple-card p,
    .simple-card ul {
      margin: 0;
      color: #465468;
    }
    .meter {
      height: 9px;
      background: #eef1f6;
      border-radius: 999px;
      overflow: hidden;
    }
    .meter i {
      display: block;
      height: 100%;
      background: #2da64a;
      border-radius: inherit;
    }
    .status-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.45rem;
    }
    .status-list li {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      color: #465468;
      font-weight: 800;
    }
    .status-list i {
      color: #e8580c;
      margin-top: 0.1rem;
    }
    .status-list.ok i {
      color: #2da64a;
    }
    .review-modal-actions a {
      border: 1px solid #d7deea;
      border-radius: 9px;
      background: #fff;
      color: #16162f;
      padding: 0.55rem 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-weight: 800;
      text-decoration: none;
    }
  `],
})
export class ProfileReviewSummaryComponent {
  @Input() detail: ProfileVerificationDashboard | null = null;
  @Input() loading = false;
  @Input() profileRoute = '';

  open = false;

  getVerifiedItems(data: ProfileVerificationDashboard): string[] {
    return (data.checklist || [])
      .filter((item) => item.status === 'Verified')
      .map((item) => item.label);
  }

  getAttentionItems(data: ProfileVerificationDashboard): string[] {
    const flags = data.actionRequired || [];
    const flagCodes = new Set(flags.map((flag) => String(flag.flagCode || '').toUpperCase()));
    const hasProfilePhotoFlag = Array.from(flagCodes).some((code) => code.startsWith('PROFILE_PHOTO_') || code === 'FACE_NOT_VISIBLE');

    const checklistItems = (data.checklist || [])
      .filter((item) => item.status !== 'Verified')
      .filter((item) => {
        const label = String(item.label || '').toLowerCase();
        if (label === 'email verified' && flagCodes.has('EMAIL_NOT_VERIFIED')) return false;
        if (label === 'mobile verified' && flagCodes.has('MOBILE_NOT_VERIFIED')) return false;
        if (label === 'profile photo' && hasProfilePhotoFlag) return false;
        if (
          label === 'social profile & creator tier' &&
          (
            flagCodes.has('TIER_MISMATCH') ||
            flagCodes.has('FOLLOWER_COUNT_MISMATCH') ||
            flagCodes.has('SOCIAL_LINK_MISSING') ||
            flagCodes.has('SOCIAL_LINK_BROKEN') ||
            flagCodes.has('SOCIAL_LINK_PRIVATE') ||
            flagCodes.has('SOCIAL_LINK_MISMATCH') ||
            flagCodes.has('SOCIAL_LINK_DUPLICATE')
          )
        ) return false;
        if (
          label === 'location' &&
          (flagCodes.has('LOCATION_MISSING') || flagCodes.has('LOCATION_MISMATCH') || flagCodes.has('INTERNATIONAL_LOCATION'))
        ) return false;
        if (label === 'gallery images attached' && flagCodes.has('PORTFOLIO_MISSING')) return false;
        if (label === 'payment method verified' && flagCodes.has('PAYMENT_MISSING')) return false;
        return true;
      })
      .map((item) => item.label);
    const flagItems = flags.map((flag) => flag.message || flag.flagCode);
    const seen = new Set<string>();
    return [...flagItems, ...checklistItems]
      .filter(Boolean)
      .filter((item) => {
        const key = String(item).trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }
}
