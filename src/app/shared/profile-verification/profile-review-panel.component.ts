import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ProfileFlag,
  ProfileVerificationDashboard,
} from '../../services/profile-verification.service';
import { ProfileFlagsComponent } from './profile-flags.component';
import { VerificationStatusComponent } from './verification-status.component';

@Component({
  selector: 'app-profile-review-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, VerificationStatusComponent, ProfileFlagsComponent],
  template: `
    <section class="profile-review-panel" [class.compact]="compact">
      <div class="loading" *ngIf="loading">
        <div class="spinner-border text-warning" role="status"></div>
        <span>Loading profile review...</span>
      </div>

      <ng-container *ngIf="!loading && detail as data">
        <div class="review-header" *ngIf="showHeader">
          <div>
            <p class="eyebrow">{{ data.userType }}</p>
            <h2>{{ data.displayName }}</h2>
          </div>
          <span class="status-chip">{{ data.verificationStatus }}</span>
        </div>

        <app-verification-status
          [completion]="data.profileCompletion"
          [qualityScore]="data.profileQualityScore"
          [qualityLabel]="data.profileQualityLabel"
          [status]="data.verificationStatus"
          [checklist]="data.checklist"
        />

        <section
          class="eligibility"
          *ngIf="showEligibility"
          [ngClass]="data.campaignEligibility.eligible ? 'eligible' : 'blocked'"
        >
          <i class="bi" [ngClass]="data.campaignEligibility.eligible ? 'bi-check-circle-fill' : 'bi-lock-fill'"></i>
          <div>
            <strong>{{ data.campaignEligibility.eligible ? 'Campaign participation enabled' : 'Campaign participation blocked' }}</strong>
            <p *ngIf="data.campaignEligibility.eligible">This profile meets the current campaign eligibility rules.</p>
            <ul *ngIf="!data.campaignEligibility.eligible">
              <li *ngFor="let blocker of data.campaignEligibility.blockers">{{ blocker }}</li>
            </ul>
          </div>
        </section>

        <app-profile-flags
          title="Open Flags"
          [flags]="data.actionRequired"
          [editable]="editable"
          [showAdd]="editable && showAddFlag"
          (addFlag)="addFlag.emit()"
          (updateFlag)="updateFlag.emit($event)"
        />

        <div class="notes" *ngIf="editable">
          <label>
            Review notes
            <textarea
              rows="3"
              [ngModel]="notes"
              (ngModelChange)="notesChange.emit($event)"
            ></textarea>
          </label>
        </div>

        <div class="actions" *ngIf="editable">
          <button type="button" class="approve" (click)="action.emit('approve')">Approve</button>
          <button type="button" class="warning" (click)="action.emit('approve_warning')">Approve with warning</button>
          <button type="button" class="changes" (click)="action.emit('request_changes')">Request changes</button>
          <button type="button" class="reject" (click)="action.emit('reject')">Reject</button>
        </div>
      </ng-container>

      <div class="empty" *ngIf="!loading && !detail">
        <i class="bi bi-person-check"></i>
        <span>Select a profile to review.</span>
      </div>
    </section>
  `,
  styles: [`
    .profile-review-panel {
      display: grid;
      gap: 1rem;
    }
    .review-header,
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .eyebrow {
      margin: 0 0 0.2rem;
      color: #657082;
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    h2 {
      margin: 0;
      color: #16162f;
      font-size: 1.3rem;
      font-weight: 900;
    }
    .status-chip {
      border-radius: 999px;
      background: #eef1f6;
      color: #16162f;
      padding: 0.3rem 0.7rem;
      font-weight: 900;
    }
    .eligibility {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      border-radius: 12px;
      padding: 1rem;
      border: 1px solid #e1e6ef;
      background: #fff;
    }
    .eligibility > i {
      font-size: 1.35rem;
      margin-top: 0.1rem;
    }
    .eligibility.eligible {
      background: #f1fbf5;
      border-color: #bdebcf;
      color: #1f8d43;
    }
    .eligibility.blocked {
      background: #fff8f4;
      border-color: #ffd8c2;
      color: #bd2d20;
    }
    .eligibility strong {
      color: inherit;
    }
    .eligibility p,
    .eligibility ul {
      margin: 0.25rem 0 0;
      color: #465468;
    }
    .notes label {
      display: grid;
      gap: 0.35rem;
      color: #465468;
      font-size: 0.82rem;
      font-weight: 800;
    }
    .notes textarea {
      border: 1px solid #d7deea;
      border-radius: 9px;
      padding: 0.6rem 0.7rem;
      font: inherit;
    }
    .actions {
      justify-content: flex-start;
    }
    .actions button {
      border: 1px solid #d7deea;
      border-radius: 9px;
      background: #fff;
      color: #16162f;
      padding: 0.55rem 0.8rem;
      font-weight: 800;
    }
    .actions .approve { background: #2da64a; border-color: #2da64a; color: #fff; }
    .actions .warning { background: #fff5e5; border-color: #ffd89b; color: #9b4b00; }
    .actions .changes { background: #e8580c; border-color: #e8580c; color: #fff; }
    .actions .reject { background: #fff0ef; border-color: #ffc9bf; color: #bd2d20; }
    .loading,
    .empty {
      min-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.55rem;
      color: #64748b;
      font-weight: 800;
    }
    .empty {
      flex-direction: column;
    }
    .empty i {
      color: #e8580c;
      font-size: 1.8rem;
    }
    .compact {
      gap: 0.75rem;
    }
  `],
})
export class ProfileReviewPanelComponent {
  @Input() detail: ProfileVerificationDashboard | null = null;
  @Input() loading = false;
  @Input() editable = false;
  @Input() showHeader = true;
  @Input() showEligibility = false;
  @Input() showAddFlag = false;
  @Input() compact = false;
  @Input() notes = '';

  @Output() notesChange = new EventEmitter<string>();
  @Output() action = new EventEmitter<string>();
  @Output() updateFlag = new EventEmitter<{ flag: ProfileFlag; status: 'Resolved' | 'Ignored' }>();
  @Output() addFlag = new EventEmitter<void>();
}
