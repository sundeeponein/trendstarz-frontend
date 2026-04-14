import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../../shared/config.service';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reviews.component.html',
  styleUrls: ['./admin-reviews.component.scss']
})
export class AdminReviewsComponent implements OnInit {
  reviews: any[] = [];
  loading = true;
  error = '';
  actionLoading = new Set<string>();
  adminNotes: { [id: string]: string } = {};
  toast = '';

  constructor(private config: ConfigService, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;
    this.config.adminGetPendingReviews().subscribe({
      next: (res: any) => {
        this.reviews = res.reviews || [];
        this.loading = false;
        this.cd.detectChanges();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load pending reviews.';
        this.loading = false;
        this.cd.detectChanges();
      }
    });
  }

  decide(review: any, action: 'approved' | 'rejected') {
    if (this.actionLoading.has(review._id)) return;
    this.actionLoading.add(review._id);
    this.config.adminDecideReview(review._id, action, this.adminNotes[review._id]).subscribe({
      next: () => {
        this.actionLoading.delete(review._id);
        this.reviews = this.reviews.filter(r => r._id !== review._id);
        this.showToast(action === 'approved' ? 'Review approved and published.' : 'Review rejected.');
        this.cd.detectChanges();
      },
      error: (err: any) => {
        this.actionLoading.delete(review._id);
        this.error = err?.error?.message || 'Action failed.';
        this.cd.detectChanges();
      }
    });
  }

  showToast(msg: string) {
    this.toast = msg;
    setTimeout(() => { this.toast = ''; this.cd.detectChanges(); }, 3000);
  }

  getStarsArray(rating: number): number[] {
    return Array(Math.min(rating, 5)).fill(0);
  }

  getEmptyStarsArray(rating: number): number[] {
    return Array(Math.max(5 - rating, 0)).fill(0);
  }
}
