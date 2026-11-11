import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../config.service';
import { timeout } from 'rxjs/operators';

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

      <div class="reviews-error" *ngIf="!loading && !locked && !!error">
        <span>{{ error }}</span>
        <button type="button" class="reviews-retry-btn" (click)="retry()">Retry</button>
      </div>

      <div class="reviews-empty" *ngIf="!loading && !locked && !error && reviews.length === 0">
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
  styleUrl: './review-list.component.scss'
})
export class ReviewListComponent implements OnInit, OnChanges {
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
    this.tryLoad();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetId'] || changes['canRead']) {
      this.tryLoad();
    }
  }

  private tryLoad(): void {
    this.reviews = [];
    this.error = '';
    this.loading = false;
    this.locked = false;

    if (!this.canRead) {
      this.locked = true;
      return;
    }

    const id = String(this.targetId || '').trim();
    if (!id) {
      this.error = 'Reviews are unavailable for this profile.';
      return;
    }

    this.load(id);
  }

  private load(targetId: string): void {
    this.loading = true;
    this.config.getReviewsForTarget(targetId).pipe(timeout(10000)).subscribe({
      next: (res: any) => {
        this.reviews = res.reviews || [];
        this.error = '';
        this.loading = false;
      },
      error: (err: any) => {
        if (err?.status === 403) {
          this.locked = true;
          this.error = '';
        } else {
          this.error = 'Unable to load reviews right now. Please try again.';
        }
        this.loading = false;
      }
    });
  }

  retry(): void {
    this.tryLoad();
  }

  getStarsArray(rating: number): number[] {
    return Array(Math.min(rating, 5)).fill(0);
  }
  getEmptyStarsArray(rating: number): number[] {
    return Array(Math.max(5 - rating, 0)).fill(0);
  }
}
