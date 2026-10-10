import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { YoutubeCheck } from './youtube-check.util';

/**
 * Under the YouTube tier on the creator's own profile: what TrendStarZ checked,
 * and what to do — nothing, update the tier, or check the handle.
 */
@Component({
  selector: 'app-youtube-check-note',
  standalone: true,
  imports: [CommonModule],
  template: `
    <p class="yt-check" *ngIf="check" [ngClass]="'yt-check--' + check.status">
      <i class="bi bi-youtube"></i>
      <ng-container [ngSwitch]="check.status">
        <span *ngSwitchCase="'not_found'" class="yt-check-action">
          We couldn't find your YouTube channel <strong>{{ atHandle(check.handle) }}</strong> — please check
          your YouTube handle.
        </span>
        <span *ngSwitchCase="'check_handle'" class="yt-check-action">
          The YouTube channel we found doesn't match your handle — please check your YouTube handle.
        </span>
        <ng-container *ngSwitchDefault>
          <ng-container *ngIf="check.subscribers !== null">
            TrendStarZ checked your channel:
            <strong>{{ check.subscribers | number }} subscribers</strong>
            on {{ check.capturedAt | date: 'd MMM y' }}<ng-container *ngIf="check.tier">
              → <strong>{{ check.tier }}</strong> tier</ng-container>.
          </ng-container>
          <span *ngIf="check.status === 'handle_renamed'" class="yt-check-action">
            Your channel's handle seems to have changed to <strong>{{ atHandle(check.newHandle) }}</strong> on
            YouTube — please update your YouTube handle here.
          </span>
          <span *ngIf="check.status === 'matches' && check.tierAutoUpdatedAt">
            Your tier was updated to match on {{ check.tierAutoUpdatedAt | date: 'd MMM y, h:mm a' }}.
          </span>
          <span *ngIf="check.status === 'please_update'" class="yt-check-action">
            Your profile says <strong>{{ check.declaredTier || 'no tier' }}</strong> — please update your tier.
          </span>
        </ng-container>
      </ng-container>
    </p>
  `,
  styles: [
    `
      .yt-check {
        margin: 6px 0 0;
        font-size: 0.8rem;
        color: #374151;
      }
      .yt-check .bi-youtube {
        color: #ff0000;
      }
      .yt-check-action {
        color: #b45309;
        font-weight: 600;
      }
    `,
  ],
})
export class YoutubeCheckNoteComponent {
  @Input() check: YoutubeCheck | null = null;

  atHandle(handle: string | null | undefined): string {
    const h = String(handle || '').trim().replace(/^@+/, '');
    return h ? `@${h}` : 'your channel';
  }
}
