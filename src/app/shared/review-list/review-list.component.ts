import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../config.service';

@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="reviews-section">
      <div class="reviews-header">
        <span class="reviews-title">
          <i class="bi bi-star-half"></i> Reviews
          <span class="reviews-count" *ngIf="reviews.length > 0">({{ reviews.length }})</span>
        </span>
        <span class="avg-rating" *ngIf="avgRating > 0">
          <span class="stars-inline">
            <i *ngFor="let s of starsFull" class="bi bi-star-fill"></i>
            <i *ngIf="hasHalfStar" class="bi bi-star-half"></i>
          </span>
          {{ avgRating | number:'1.1-1' }}
        </span>
      </div>

      <div class="reviews-locked" *ngIf="locked">
        <i class="bi bi-lock-fill"></i>
        <span>Upgrade to <strong>Pro</strong> to view reviews.</span>
      </div>

      <div class="reviews-loading" *ngIf="loading">
        <div class="spinner-border spinner-border-sm text-warning" role="status"></div>
      </div>

      <div class="reviews-empty" *ngIf="!loading && !locked && reviews.length === 0">
        No reviews yet.
      </div>

      <div class="review-item" *ngFor="let r of reviews">
        <div class="review-top">
          <span class="reviewer-type-badge" [ngClass]="r.reviewerType">
            {{ r.reviewerType | titlecase }}
          </span>
          <span class="review-stars">
            <i class="bi bi-star-fill" *ngFor="let _ of getStarsArray(r.rating)"></i>
            <i class="bi bi-star" *ngFor="let _ of getEmptyStarsArray(r.rating)"></i>
          </span>
          <span class="review-date">{{ r.createdAt | date:'mediumDate' }}</span>
        </div>
        <p class="review-comment" *ngIf="r.comment">{{ r.comment }}</p>
      </div>
    </div>
  `,
  styles: [`
    .reviews-section { margin-top: 1.2rem; }
    .reviews-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 0.8rem;
    }
    .reviews-title {
      font-size: 1rem; font-weight: 700; color: #333;
      display: flex; align-items: center; gap: 0.4rem;
      i { color: #E8580C; }
    }
    .reviews-count { font-size: 0.85rem; color: #888; font-weight: 400; }
    .avg-rating {
      display: flex; align-items: center; gap: 0.4rem;
      font-weight: 700; font-size: 0.95rem; color: #333;
    }
    .stars-inline { color: #f59e0b; display: flex; gap: 2px; font-size: 0.85rem; }
    .reviews-locked {
      display: flex; align-items: center; gap: 0.5rem;
      background: #fff8f0; border: 1px solid #f5d8c0;
      border-radius: 8px; padding: 0.8rem 1rem;
      font-size: 0.88rem; color: #888;
      i { color: #E8580C; }
      strong { color: #E8580C; }
    }
    .reviews-loading { display: flex; justify-content: center; padding: 1rem; }
    .reviews-empty { font-size: 0.88rem; color: #aaa; font-style: italic; }
    .review-item {
      border: 1px solid #f0ece8; border-radius: 9px;
      padding: 0.75rem 0.9rem; margin-bottom: 0.6rem;
    }
    .review-top {
      display: flex; align-items: center; gap: 0.5rem;
      margin-bottom: 0.4rem; flex-wrap: wrap;
    }
    .reviewer-type-badge {
      font-size: 0.72rem; padding: 2px 8px; border-radius: 20px;
      font-weight: 600; text-transform: capitalize;
      &.brand { background: #e0f0ff; color: #2271b1; }
      &.influencer { background: #e6f9f1; color: #22b37a; }
    }
    .review-stars {
      display: flex; gap: 2px;
      i { color: #f59e0b; font-size: 0.85rem; }
    }
    .review-date { font-size: 0.75rem; color: #aaa; margin-left: auto; }
    .review-comment { font-size: 0.88rem; color: #555; margin: 0; line-height: 1.5; }
  `]
})
export class ReviewListComponent implements OnInit {
  @Input() targetId!: string;
  /** If true, shows locked message instead of fetching */
  @Input() canRead = false;

  reviews: any[] = [];
  loading = false;
  locked = false;
  error = '';

  get avgRating(): number {
    if (!this.reviews.length) return 0;
    return this.reviews.reduce((sum, r) => sum + r.rating, 0) / this.reviews.length;
  }
  get starsFull(): number[] {
    return Array(Math.floor(this.avgRating)).fill(0);
  }
  get hasHalfStar(): boolean {
    return this.avgRating % 1 >= 0.5;
  }

  constructor(private config: ConfigService) {}

  ngOnInit() {
    if (!this.canRead) {
      this.locked = true;
      return;
    }
    this.load();
  }

  load() {
    this.loading = true;
    this.config.getReviewsForTarget(this.targetId).subscribe({
      next: (res: any) => {
        this.reviews = res.reviews || [];
        this.loading = false;
      },
      error: (err: any) => {
        if (err?.status === 403) {
          this.locked = true;
        }
        this.loading = false;
      }
    });
  }

  getStarsArray(rating: number): number[] {
    return Array(Math.min(rating, 5)).fill(0);
  }
  getEmptyStarsArray(rating: number): number[] {
    return Array(Math.max(5 - rating, 0)).fill(0);
  }
}
