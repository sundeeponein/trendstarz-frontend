import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CollaborationScoreApiService, CollaborationScorePreview } from '../../services/collaboration-score-api.service';

type PlatformId = 'instagram' | 'facebook' | 'youtube' | 'linkedin';

@Component({
  selector: 'app-score-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './score-preview.component.html',
  styleUrls: ['./score-preview.component.scss'],
})
export class ScorePreviewComponent implements OnDestroy {
  readonly platforms: Array<{ id: PlatformId; name: string; icon: string }> = [
    { id: 'instagram', name: 'Instagram', icon: 'bi bi-instagram' },
    { id: 'facebook', name: 'Facebook', icon: 'bi bi-facebook' },
    { id: 'youtube', name: 'YouTube', icon: 'bi bi-youtube' },
    { id: 'linkedin', name: 'LinkedIn', icon: 'bi bi-linkedin' },
  ];
  selectedPlatform: PlatformId = 'youtube';

  youtubeUrl = '';
  loading = false;
  error = '';
  result: CollaborationScorePreview | null = null;

  // Cosmetic only — real backend latency varies. A score is never rendered
  // while loading (result only ever renders in the separate *ngIf="result"
  // block below), this just avoids a static "Checking…" the whole time.
  private static readonly LOADING_MESSAGES = [
    'Analyzing Profile...',
    'Checking profile quality...',
    'Checking completeness...',
    'Calculating Collaboration Score...',
  ];
  loadingMessageIndex = 0;
  private loadingMessageTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly api: CollaborationScoreApiService,
    private readonly router: Router,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
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

  get loadingMessage(): string {
    return ScorePreviewComponent.LOADING_MESSAGES[this.loadingMessageIndex];
  }

  get selectedPlatformName(): string {
    return this.platforms.find((p) => p.id === this.selectedPlatform)?.name || '';
  }

  selectPlatform(id: PlatformId): void {
    if (this.loading) return;
    this.selectedPlatform = id;
    this.error = '';
  }

  private startLoadingMessages(): void {
    this.loadingMessageIndex = 0;
    this.loadingMessageTimer = setInterval(() => {
      this.ngZone.run(() => {
        this.loadingMessageIndex = (this.loadingMessageIndex + 1) % ScorePreviewComponent.LOADING_MESSAGES.length;
        this.cdr.detectChanges();
      });
    }, 1200);
  }

  private stopLoadingMessages(): void {
    if (this.loadingMessageTimer) {
      clearInterval(this.loadingMessageTimer);
      this.loadingMessageTimer = null;
    }
  }

  check(): void {
    if (this.selectedPlatform !== 'youtube') return;
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
    this.startLoadingMessages();
    // HttpClient is configured with withFetch() (app.config.ts) — fetch()
    // promise continuations aren't always reliably re-entered into
    // Angular's zone, so state set here can otherwise sit unrendered until
    // an unrelated zone-patched event (e.g. a click) forces a CD cycle.
    // Same class of bug already worked around elsewhere in this app
    // (influencer-registration.component.ts's post-submit handler).
    this.api.previewFromYoutubeUrl(url).subscribe({
      next: (result) => {
        this.ngZone.run(() => {
          this.stopLoadingMessages();
          this.result = result;
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.stopLoadingMessages();
          this.error = err?.error?.message || 'Could not check that channel. Please try again.';
          this.loading = false;
          this.cdr.detectChanges();
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

  ngOnDestroy(): void {
    this.stopLoadingMessages();
  }
}
