import { CommonModule } from '@angular/common';
import { Component, NgZone } from '@angular/core';
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
    private readonly ngZone: NgZone,
  ) {}

  // Non-YouTube links are the most common mistake — the headline never says
  // "YouTube," so people paste whatever social URL they have handy. Catch
  // the obvious cases client-side with a specific message, before spending
  // a YouTube API call on a request that can never succeed.
  private static readonly OTHER_PLATFORM_HINTS: Array<{ match: RegExp; name: string }> = [
    { match: /instagram\.com/i, name: 'Instagram' },
    { match: /facebook\.com|fb\.com/i, name: 'Facebook' },
    { match: /linkedin\.com/i, name: 'LinkedIn' },
    { match: /(twitter\.com|x\.com)/i, name: 'X (Twitter)' },
    { match: /tiktok\.com/i, name: 'TikTok' },
  ];

  check(): void {
    const url = this.youtubeUrl.trim();
    if (!url || this.loading) return;

    const otherPlatform = ScorePreviewComponent.OTHER_PLATFORM_HINTS.find((p) => p.match.test(url));
    if (otherPlatform && !/youtube\.com|youtu\.be/i.test(url)) {
      this.error = `That's an ${otherPlatform.name} link — the free preview only supports YouTube channels right now. Paste your YouTube channel URL instead.`;
      this.result = null;
      return;
    }

    this.loading = true;
    this.error = '';
    this.result = null;
    // HttpClient is configured with withFetch() (app.config.ts) — fetch()
    // promise continuations aren't always reliably re-entered into
    // Angular's zone, so state set here can otherwise sit unrendered until
    // an unrelated zone-patched event (e.g. a click) forces a CD cycle.
    // Same class of bug already worked around elsewhere in this app
    // (influencer-registration.component.ts's post-submit handler).
    this.api.previewFromYoutubeUrl(url).subscribe({
      next: (result) => {
        this.ngZone.run(() => {
          this.result = result;
          this.loading = false;
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.error = err?.error?.message || 'Could not check that channel. Please try again.';
          this.loading = false;
        });
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
