import { ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CollaborationAudit, CollaborationScoreApiService } from '../../services/collaboration-score-api.service';
import { CollaborationScoreUiUtilsService } from '../../services/collaboration-score-ui-utils.service';
import { VisibilityService } from '../../core/visibility.service';

/**
 * TrendScore + campaign readiness on a creator's full profile page.
 * Logged-in viewers see the score (GET /api/audit/:userId is auth-only and
 * brand-safe — no suggested pricing). Guests get a login prompt. Renders
 * nothing when the creator has no audit yet. Cards only show the positive
 * "Campaign Ready" badge; this is where the full picture lives.
 */
@Component({
  selector: 'app-profile-trendscore',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="pts-card" *ngIf="!isLoggedIn">
      <span class="pts-icon" aria-hidden="true"><i class="bi bi-graph-up-arrow"></i></span>
      <div class="pts-body">
        <p class="pts-kicker">TrendScore</p>
        <p class="pts-copy">Log in to see this creator's TrendScore and campaign readiness.</p>
      </div>
      <a routerLink="/login" class="pts-btn">Log in</a>
    </div>

    <div class="pts-card" *ngIf="isLoggedIn && audit">
      <div class="pts-ring" [style.background]="ringBackground" role="img"
           [attr.aria-label]="'TrendScore ' + audit.collaborationScore + ' out of 100'">
        <span>{{ audit.collaborationScore }}<small>/100</small></span>
      </div>
      <div class="pts-body">
        <p class="pts-kicker">TrendScore</p>
        <p class="pts-title">{{ ui.scoreTierLabel(audit.collaborationScore) }}</p>
        <span class="badge rounded-pill" [ngClass]="ui.campaignReadinessClass(audit.campaignReadiness)">
          {{ audit.campaignReadiness }}
        </span>
        <p class="pts-copy">Based on profile completeness, content quality, posting consistency and branding.
          <a routerLink="/trendstarz-score">How TrendScore works</a></p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; margin-bottom: 16px; }
    .pts-card {
      display: flex; align-items: center; gap: 16px;
      background: #fff; border: 1px solid #eee; border-radius: 16px; padding: 18px 20px;
    }
    .pts-icon {
      flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; border-radius: 12px; background: #fff1ea; color: #ea580c; font-size: 1.2rem;
    }
    .pts-ring {
      flex-shrink: 0; width: 72px; height: 72px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .pts-ring span {
      width: 58px; height: 58px; border-radius: 50%; background: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.2rem; color: #0b1220;
    }
    .pts-ring small { font-size: 0.62rem; font-weight: 600; color: rgba(11,18,32,.55); }
    .pts-body { flex: 1; min-width: 0; }
    .pts-kicker {
      margin: 0; font-size: 0.72rem; letter-spacing: 1.2px; text-transform: uppercase;
      color: #e8612d; font-weight: 700;
    }
    .pts-title { margin: 2px 0 6px; font-weight: 800; color: #0b1220; }
    .pts-copy { margin: 8px 0 0; font-size: 0.82rem; color: rgba(11,18,32,.62); }
    .pts-copy a { color: #ea580c; font-weight: 600; text-decoration: none; }
    .pts-btn {
      flex-shrink: 0; padding: 8px 16px; border-radius: 10px; text-decoration: none;
      background: linear-gradient(90deg, #ff7a00, #ff4d1a); color: #fff; font-weight: 700; font-size: 0.84rem;
    }
    @media (max-width: 575.98px) {
      .pts-card { flex-wrap: wrap; }
      .pts-btn { width: 100%; text-align: center; }
    }
  `],
})
export class ProfileTrendscoreComponent implements OnChanges {
  @Input() userId: string | null | undefined = null;

  audit: CollaborationAudit | null = null;
  private loadedFor = '';

  constructor(
    private api: CollaborationScoreApiService,
    public ui: CollaborationScoreUiUtilsService,
    private visibility: VisibilityService,
    private cd: ChangeDetectorRef,
  ) {}

  get isLoggedIn(): boolean {
    return this.visibility.isLoggedIn();
  }

  get ringBackground(): string {
    const score = Math.max(0, Math.min(100, Number(this.audit?.collaborationScore) || 0));
    const color = this.ui.scoreRingColor(score);
    return `conic-gradient(${color} ${score * 3.6}deg, #eef0f5 0deg)`;
  }

  ngOnChanges(): void {
    const id = String(this.userId || '').trim();
    if (!id || !this.isLoggedIn || id === this.loadedFor) return;
    this.loadedFor = id;
    this.api.getAudit(id).subscribe({
      next: (audit) => {
        this.audit = audit && audit.collaborationScore != null ? audit : null;
        this.cd.detectChanges();
      },
      error: () => {
        this.audit = null;
        this.cd.detectChanges();
      },
    });
  }
}
