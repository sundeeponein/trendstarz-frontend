import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CollaborationScoreApiService, CollaborationScorePreview } from '../../services/collaboration-score-api.service';
import { CollaborationScoreUiUtilsService } from '../../services/collaboration-score-ui-utils.service';

type PlatformId = 'instagram' | 'facebook' | 'youtube' | 'linkedin';
type RoleId = 'influencer' | 'photographer' | 'brand';

interface RoleOption {
  id: RoleId;
  emoji: string;
  name: string;
  sub: string;
  perkTitle: string;
  perk: string;
  cta: string;
}

/** Illustrative report per role — always labelled "Example" in the UI, never a real result. */
interface SampleReport {
  heading: string;
  score: number;
  bars: Array<{ label: string; value: string; pct: number; hot?: boolean }>;
  footLabel: string;
  footValue: string;
}

@Component({
  selector: 'app-score-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './score-preview.component.html',
  styleUrls: ['./score-preview.component.scss'],
})
export class ScorePreviewComponent implements OnInit, OnDestroy {
  /** The home page shows the four trust cards under the check; the TrendScore page has its own sections. */
  @Input() showTrustCards = true;

  readonly roles: RoleOption[] = [
    {
      id: 'influencer',
      emoji: '🌟',
      name: 'Influencer',
      sub: 'Content Creator',
      perkTitle: 'Creator perk',
      perk: 'Scores your content quality, posting consistency and profile completeness, and after sign-up suggests a fair Reel / post rate in ₹.',
      cta: 'Create Free Influencer Account',
    },
    {
      id: 'photographer',
      emoji: '📸',
      name: 'Photographer',
      sub: 'Photo / Video Artist',
      perkTitle: 'Visual artist perk',
      perk: 'Rates your portfolio, profile completeness and campaign readiness, and shows what to improve before brands review you.',
      cta: 'Create Free Photographer Account',
    },
    {
      id: 'brand',
      emoji: '🏢',
      name: 'Brand',
      sub: 'Hiring Creators',
      perkTitle: 'Brand perk',
      perk: 'Brands don\'t need a score — compare creators by TrendScore, Campaign Ready status and verification before you invite them.',
      cta: 'Create Free Brand Account',
    },
  ];
  selectedRole: RoleId | null = null;

  private static readonly SAMPLES: Record<RoleId | 'none', SampleReport> = {
    none: {
      heading: 'Sample score report',
      score: 86,
      bars: [
        { label: 'Content Quality', value: '88 / 100', pct: 88 },
        { label: 'Campaign Readiness', value: 'Campaign Ready', pct: 82, hot: true },
      ],
      footLabel: 'Suggested rate',
      footValue: '₹8,000 – ₹15,000 / Reel',
    },
    influencer: {
      heading: 'Sample creator report',
      score: 86,
      bars: [
        { label: 'Posting Consistency', value: '90 / 100', pct: 90 },
        { label: 'Campaign Readiness', value: 'Campaign Ready', pct: 82, hot: true },
      ],
      footLabel: 'Suggested rate',
      footValue: '₹8,000 – ₹15,000 / Reel',
    },
    photographer: {
      heading: 'Sample portfolio report',
      score: 81,
      bars: [
        { label: 'Portfolio Strength', value: '84 / 100', pct: 84 },
        { label: 'Profile Completeness', value: 'Complete', pct: 95, hot: true },
      ],
      footLabel: 'Suggested starting price',
      footValue: '₹12,000 / shoot',
    },
    brand: {
      heading: 'What brands see on a creator',
      score: 86,
      bars: [
        { label: 'Verified by TrendStarz', value: 'Yes', pct: 100 },
        { label: 'Campaign Readiness', value: 'Campaign Ready', pct: 82, hot: true },
      ],
      footLabel: 'Detailed report',
      footValue: 'Private to the creator',
    },
  };

  get activeRole(): RoleOption | null {
    return this.roles.find((r) => r.id === this.selectedRole) || null;
  }

  get sample(): SampleReport {
    return ScorePreviewComponent.SAMPLES[this.selectedRole || 'none'];
  }

  selectRole(id: RoleId): void {
    this.selectedRole = id;
  }

  /** stroke-dasharray for a 0–100 score on the r=52 ring. */
  ringDash(score: number): string {
    const circumference = 2 * Math.PI * 52;
    const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference;
    return `${filled} ${circumference}`;
  }

  readonly platforms: Array<{ id: PlatformId; name: string; icon: string }> = [
    { id: 'instagram', name: 'Instagram', icon: 'bi bi-instagram' },
    { id: 'youtube', name: 'YouTube', icon: 'bi bi-youtube' },
    { id: 'facebook', name: 'Facebook', icon: 'bi bi-facebook' },
    { id: 'linkedin', name: 'LinkedIn', icon: 'bi bi-linkedin' },
  ];
  // Claims here must stay true to how the platform works today — e.g. payments
  // are held and released on work approval, but there is no bot/authenticity audit.
  readonly trustItems: Array<{ icon: string; tone: 'teal' | 'orange' | 'indigo' | 'amber'; title: string; text: string }> = [
    {
      icon: 'bi-patch-check',
      tone: 'teal',
      title: 'Verified Profiles',
      text: 'Reviewed and approved by the TrendStarz team, with email and mobile verified, before the badge appears.',
    },
    {
      icon: 'bi-cash-stack',
      tone: 'orange',
      title: 'Transparent Pricing',
      text: 'Creators show their starting rates upfront, so brands know costs before reaching out.',
    },
    {
      icon: 'bi-shield-check',
      tone: 'indigo',
      title: 'Protected Payments',
      text: 'Brand payments are held by TrendStarz and released to the creator once the brand approves the work.',
    },
    {
      icon: 'bi-hand-thumbs-up',
      tone: 'amber',
      title: 'Built for Growing Brands',
      text: 'From D2C startups to local businesses, brands find and hire creators directly.',
    },
  ];

  // Optimistic default (all enabled) until the real flags load, so tabs
  // don't flash away right after render — an admin-disabled platform stays
  // visible for at most one HTTP round-trip, never permanently mis-hidden.
  platformsEnabled: Record<PlatformId, boolean> = { instagram: true, facebook: true, youtube: true, linkedin: true };
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
    'Calculating TrendStarz Score...',
  ];
  loadingMessageIndex = 0;
  private loadingMessageTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly api: CollaborationScoreApiService,
    private readonly router: Router,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    public readonly ui: CollaborationScoreUiUtilsService,
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

  get visiblePlatforms(): Array<{ id: PlatformId; name: string; icon: string }> {
    return this.platforms.filter((p) => this.platformsEnabled[p.id]);
  }

  get selectedPlatformName(): string {
    return this.platforms.find((p) => p.id === this.selectedPlatform)?.name || '';
  }

  ngOnInit(): void {
    this.api.getPlatformFlags().subscribe({
      next: (res) => {
        this.platformsEnabled = res.platformsEnabled;
        // The tab a visitor is currently on may have just been disabled —
        // fall back to the first one still visible rather than leaving them
        // stranded on a tab that no longer renders.
        if (!this.platformsEnabled[this.selectedPlatform]) {
          this.selectedPlatform = this.visiblePlatforms[0]?.id ?? this.selectedPlatform;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        // Fetch failed — keep the optimistic all-enabled default rather than
        // hiding every platform because of an unrelated network hiccup.
      },
    });
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

  registerAs(role: 'influencer' | 'photographer' | 'brand'): void {
    this.router.navigate([`/register-${role}`]);
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
