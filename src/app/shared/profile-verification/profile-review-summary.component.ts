import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProfileVerificationDashboard } from '../../services/profile-verification.service';
import { ProfileReviewPanelComponent } from './profile-review-panel.component';

@Component({
  selector: 'app-profile-review-summary',
  standalone: true,
  imports: [CommonModule, RouterModule, ProfileReviewPanelComponent],
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

        <app-profile-review-panel
          [detail]="detail"
          [loading]="loading"
          [editable]="false"
          [showHeader]="false"
          [showEligibility]="true"
          [compact]="true"
        />

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
      overflow: auto;
      background: #fff;
      border-radius: 12px;
      border: 1px solid #d7deea;
      padding: 1rem;
      display: grid;
      gap: 1rem;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.24);
    }
    .review-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
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
}
