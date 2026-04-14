import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../config.service';

@Component({
  selector: 'app-write-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="review-modal-backdrop" (click)="close.emit()">
      <div class="review-modal" (click)="$event.stopPropagation()">
        <div class="rm-header">
          <h3 class="rm-title">Write a Review</h3>
          <button class="rm-close" (click)="close.emit()"><i class="bi bi-x-lg"></i></button>
        </div>

        <div class="rm-target" *ngIf="targetName">
          Reviewing: <strong>{{ targetName }}</strong>
        </div>

        <!-- Star rating -->
        <div class="rm-stars">
          <button
            class="star-btn"
            *ngFor="let s of stars"
            [class.active]="s <= rating"
            (click)="rating = s"
            type="button"
          >
            <i [class]="s <= rating ? 'bi bi-star-fill' : 'bi bi-star'"></i>
          </button>
          <span class="star-label">{{ ratingLabel }}</span>
        </div>

        <textarea
          class="rm-textarea"
          rows="4"
          placeholder="Share your experience working together..."
          [(ngModel)]="comment"
          maxlength="600"
        ></textarea>
        <div class="rm-char-count">{{ comment.length }}/600</div>

        <div class="rm-note">
          <i class="bi bi-info-circle"></i>
          Reviews are published after admin approval, typically within 24 hours.
        </div>

        <div class="rm-error" *ngIf="error">{{ error }}</div>
        <div class="rm-success" *ngIf="success">
          <i class="bi bi-check-circle-fill"></i> Review submitted! It will appear after admin approval.
        </div>

        <div class="rm-actions" *ngIf="!success">
          <button class="rm-btn-cancel" (click)="close.emit()">Cancel</button>
          <button class="rm-btn-submit" [disabled]="loading || rating === 0" (click)="submit()">
            <span *ngIf="loading" class="spinner-border spinner-border-sm" role="status"></span>
            {{ loading ? 'Submitting...' : 'Submit Review' }}
          </button>
        </div>
        <div class="rm-actions" *ngIf="success">
          <button class="rm-btn-cancel" (click)="close.emit()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .review-modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1200;
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
    }
    .review-modal {
      background: #fff;
      border-radius: 14px;
      padding: 1.5rem;
      width: 100%; max-width: 460px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .rm-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem;
    }
    .rm-title { font-size: 1.1rem; font-weight: 700; margin: 0; }
    .rm-close {
      background: none; border: none; cursor: pointer;
      font-size: 1.1rem; color: #888; line-height: 1;
      &:hover { color: #333; }
    }
    .rm-target {
      font-size: 0.88rem; color: #666;
      margin-bottom: 0.8rem;
      strong { color: #333; }
    }
    .rm-stars {
      display: flex; align-items: center; gap: 0.3rem;
      margin-bottom: 1rem;
    }
    .star-btn {
      background: none; border: none; cursor: pointer;
      font-size: 1.5rem; padding: 0; color: #ccc;
      transition: color 0.15s;
      &.active, &:hover { color: #f59e0b; }
    }
    .star-label {
      font-size: 0.82rem; color: #888; margin-left: 0.4rem;
    }
    .rm-textarea {
      width: 100%; border: 1.5px solid #e5e7eb;
      border-radius: 8px; padding: 0.7rem;
      font-size: 0.9rem; resize: vertical;
      box-sizing: border-box;
      &:focus { outline: none; border-color: #E8580C; }
    }
    .rm-char-count { text-align: right; font-size: 0.75rem; color: #aaa; margin: 0.2rem 0 0.8rem; }
    .rm-note {
      font-size: 0.8rem; color: #888;
      display: flex; align-items: flex-start; gap: 0.4rem;
      margin-bottom: 1rem;
      i { color: #E8580C; margin-top: 2px; }
    }
    .rm-error { color: #c53030; font-size: 0.85rem; margin-bottom: 0.8rem; }
    .rm-success {
      color: #22b37a; font-size: 0.88rem;
      display: flex; align-items: center; gap: 0.4rem;
      margin-bottom: 0.8rem;
    }
    .rm-actions {
      display: flex; gap: 0.6rem; justify-content: flex-end;
    }
    .rm-btn-cancel {
      padding: 0.5rem 1.2rem;
      border: 1.5px solid #ddd; border-radius: 8px;
      background: none; cursor: pointer; font-size: 0.9rem;
      &:hover { background: #f5f5f5; }
    }
    .rm-btn-submit {
      padding: 0.5rem 1.4rem;
      background: #E8580C; color: #fff;
      border: none; border-radius: 8px;
      font-weight: 600; font-size: 0.9rem; cursor: pointer;
      display: flex; align-items: center; gap: 0.4rem;
      &:hover { background: #c94a08; }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }
  `]
})
export class WriteReviewComponent implements OnInit {
  @Input() inviteId!: string;
  @Input() targetName = '';
  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  stars = [1, 2, 3, 4, 5];
  rating = 0;
  comment = '';
  loading = false;
  error = '';
  success = false;

  readonly ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  get ratingLabel() { return this.ratingLabels[this.rating] || ''; }

  constructor(private config: ConfigService) {}

  ngOnInit() {}

  submit() {
    if (this.rating === 0) return;
    this.loading = true;
    this.error = '';
    this.config.writeReview({ inviteId: this.inviteId, rating: this.rating, comment: this.comment }).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        this.submitted.emit();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to submit review. Please try again.';
      }
    });
  }
}
