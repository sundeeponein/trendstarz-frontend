import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CollaborationScoreApiService, CollaborationScorePreview } from '../../services/collaboration-score-api.service';

@Component({
  selector: 'app-score-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './score-preview.component.html',
  styleUrls: ['./score-preview.component.scss'],
})
export class ScorePreviewComponent {
  youtubeUrl = '';
  loading = false;
  error = '';
  result: CollaborationScorePreview | null = null;

  constructor(
    private readonly api: CollaborationScoreApiService,
    private readonly router: Router,
  ) {}

  check(): void {
    const url = this.youtubeUrl.trim();
    if (!url || this.loading) return;
    this.loading = true;
    this.error = '';
    this.result = null;
    this.api.previewFromYoutubeUrl(url).subscribe({
      next: (result) => {
        this.result = result;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Could not check that channel. Please try again.';
        this.loading = false;
      },
    });
  }

  tierLabel(score: number): string {
    if (score >= 80) return 'Excellent potential.';
    if (score >= 60) return 'Good potential.';
    if (score >= 40) return 'Room to grow.';
    return 'Just getting started.';
  }

  registerFree(): void {
    this.router.navigate(['/register-influencer']);
  }

  checkAnother(): void {
    this.result = null;
    this.error = '';
    this.youtubeUrl = '';
  }
}
