import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  ProfileVerificationDashboard,
  ProfileVerificationService,
} from '../../services/profile-verification.service';
import { VerificationStatusComponent } from '../../shared/profile-verification/verification-status.component';
import { ProfileFlagsComponent } from '../../shared/profile-verification/profile-flags.component';

@Component({
  selector: 'app-profile-verification-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, VerificationStatusComponent, ProfileFlagsComponent],
  template: `
    <main class="verification-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Profile Verification</p>
          <h1>{{ dashboard()?.displayName || 'Your profile' }}</h1>
        </div>
        <button type="button" class="refresh-btn" (click)="load()">
          <i class="bi bi-arrow-clockwise"></i>
          Refresh
        </button>
      </div>

      <div class="alert alert-danger" *ngIf="error()">{{ error() }}</div>

      <div class="loading" *ngIf="loading()">
        <div class="spinner-border text-warning" role="status"></div>
      </div>

      <ng-container *ngIf="!loading() && dashboard() as data">
        <app-verification-status
          [completion]="data.profileCompletion"
          [qualityScore]="data.profileQualityScore"
          [qualityLabel]="data.profileQualityLabel"
          [status]="data.verificationStatus"
          [checklist]="data.checklist"
        />

        <section class="eligibility" [ngClass]="data.campaignEligibility.eligible ? 'eligible' : 'blocked'">
          <i class="bi" [ngClass]="data.campaignEligibility.eligible ? 'bi-check-circle-fill' : 'bi-lock-fill'"></i>
          <div>
            <strong>{{ data.campaignEligibility.eligible ? 'Campaign participation enabled' : 'Campaign participation blocked' }}</strong>
            <p *ngIf="data.campaignEligibility.eligible">Your profile meets the current campaign eligibility rules.</p>
            <ul *ngIf="!data.campaignEligibility.eligible">
              <li *ngFor="let blocker of data.campaignEligibility.blockers">{{ blocker }}</li>
            </ul>
          </div>
        </section>

        <app-profile-flags [flags]="data.actionRequired" />

        <section class="actions-panel" *ngIf="data.actionRequired.length">
          <div>
            <h2>Submit Updated Profile</h2>
            <p>After fixing the open items, send your profile back to the admin review queue.</p>
          </div>
          <div class="action-links">
            <a [routerLink]="profileRoute()">
              <i class="bi bi-person-gear"></i>
              Edit profile
            </a>
            <button type="button" [disabled]="submitting()" (click)="resubmit()">
              <i class="bi bi-send"></i>
              {{ submitting() ? 'Submitting...' : 'Submit for review' }}
            </button>
          </div>
        </section>
      </ng-container>
    </main>
  `,
  styles: [`
    .verification-page {
      max-width: 980px;
      margin: 0 auto;
      padding: 1.4rem;
      display: grid;
      gap: 1rem;
    }
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .eyebrow {
      margin: 0 0 0.2rem;
      color: #657082;
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      color: #16162f;
      font-size: clamp(1.6rem, 3vw, 2.2rem);
      font-weight: 900;
    }
    .refresh-btn,
    .actions-panel button,
    .actions-panel a {
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
    .actions-panel button {
      background: #e8580c;
      border-color: #e8580c;
      color: #fff;
    }
    .actions-panel button:disabled {
      opacity: 0.65;
    }
    .loading {
      display: flex;
      justify-content: center;
      padding: 2rem;
    }
    .eligibility,
    .actions-panel {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      border-radius: 12px;
      padding: 1rem;
      border: 1px solid #e1e6ef;
      background: #fff;
    }
    .eligibility {
      justify-content: flex-start;
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
      background: #fff7f5;
      border-color: #ffc9bf;
      color: #bd2d20;
    }
    .eligibility strong,
    .actions-panel h2 {
      color: #16162f;
      font-weight: 900;
    }
    .eligibility p,
    .actions-panel p {
      margin: 0.25rem 0 0;
      color: #657082;
    }
    .eligibility ul {
      margin: 0.35rem 0 0;
      padding-left: 1.2rem;
      color: #67433b;
    }
    .actions-panel h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .action-links {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
      flex-shrink: 0;
    }
    @media (max-width: 720px) {
      .page-header,
      .actions-panel {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `],
})
export class ProfileVerificationDashboardComponent implements OnInit {
  dashboard = signal<ProfileVerificationDashboard | null>(null);
  loading = signal(true);
  submitting = signal(false);
  error = signal('');

  profileRoute = computed(() => {
    const userType = this.dashboard()?.userType;
    if (userType === 'Brand') return '/brand-profile';
    if (userType === 'Photographer') return '/photographer-profile';
    return '/influencer-profile';
  });

  constructor(private api: ProfileVerificationService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getMyDashboard().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to load profile verification.');
        this.loading.set(false);
      },
    });
  }

  resubmit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.api.resubmit().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.submitting.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to resubmit profile.');
        this.submitting.set(false);
      },
    });
  }
}
