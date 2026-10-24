import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RateReview } from './rate-review.util';

/** "Your tier changed to Micro on 10 Oct — review these rates: Reel, Story." */
@Component({
  selector: 'app-rate-review-note',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rate-review" *ngIf="review">
      <i class="bi bi-arrow-up-right-circle"></i>
      Your {{ review.platform }} tier changed to <strong>{{ review.tier }}</strong> on
      {{ review.changedAt | date: 'd MMM y' }} — review these rates:
      <strong>{{ review.rates.join(', ') }}</strong>. Change them, or confirm they're still right.
      <button type="button" class="rate-review-ok" [disabled]="busy" (click)="confirm.emit(review.socialAccountId)">
        These rates are still right
      </button>
    </div>
  `,
  styles: [
    `
      .rate-review-ok {
        margin-left: 6px;
        padding: 2px 10px;
        border: 1px solid #d97706;
        border-radius: 999px;
        background: #fff;
        font-size: 0.75rem;
        font-weight: 600;
        color: #92400e;
      }
      .rate-review {
        margin: 6px 0 8px;
        padding: 6px 10px;
        border: 1px solid #fde68a;
        border-radius: 8px;
        background: #fffbeb;
        font-size: 0.8rem;
        color: #92400e;
      }
    `,
  ],
})
export class RateReviewNoteComponent {
  @Input() review: RateReview | null = null;
  @Input() busy = false;
  /** Emits the socialAccountId whose rates the creator confirms unchanged. */
  @Output() confirm = new EventEmitter<string>();
}
