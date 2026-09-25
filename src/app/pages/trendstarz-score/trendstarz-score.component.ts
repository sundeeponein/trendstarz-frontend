import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { AnalyticsService } from '../../core/analytics.service';
import { SessionService } from '../../core/session.service';
import { FaqAccordionComponent, FaqAccordionItem } from '../../shared/components/faq-accordion/faq-accordion.component';
import { ScorePreviewComponent } from '../../shared/score-preview/score-preview.component';
import { CollaborationScoreApiService, CollaborationScoreWeights } from '../../services/collaboration-score-api.service';
import { CollaborationScoreUiUtilsService } from '../../services/collaboration-score-ui-utils.service';
import { ConfigService } from '../../shared/config.service';
import { formatMilestoneCount } from '../../shared/utils/platform-stats.util';

interface AudienceCard {
  role: string;
  icon: string;
  tint: 'orange' | 'blue' | 'purple' | 'gray';
  benefits: string[];
}

interface WorkflowStep {
  icon: string;
  label: string;
  text: string;
}

interface ScoreComponentCard {
  icon: string;
  title: string;
  description: string;
  weightKey: keyof CollaborationScoreWeights;
  tone: 'rose' | 'indigo' | 'amber' | 'teal' | 'orange';
}

interface ScoreLevelCard {
  range: string;
  label: string;
  stage: string;
  icon: string;
  tint: 'gray' | 'blue' | 'orange' | 'green';
  text: string;
  unlockPrefix: 'Unlocks' | 'Good fit';
  unlockIcon: string;
  unlock: string;
  highlight?: boolean;
}

interface ComparisonRow {
  label: string;
  followersOnly: string;
  trendScore: string;
}

type PlatformKey = 'instagram' | 'youtube' | 'facebook' | 'linkedin' | 'twitter';

interface PlatformSupportRow {
  key: PlatformKey;
  platform: string;
  icon: string;
  preview: string;
  signals: string;
  connection: string;
  connectionTone: 'required' | 'optional' | 'muted';
  /** Needs a Meta (Instagram/Facebook) app connection to be live. */
  needsMeta?: boolean;
  /** No verified data source yet — always "Coming soon". */
  selfReportedOnly?: boolean;
}

/**
 * Educational marketing page for the Collaboration Score feature — NOT the
 * audit results page. Real scores only ever render post-audit, on the
 * user's own dashboard; this page never computes or displays a real score,
 * only a static illustrative example in the hero.
 */
@Component({
  selector: 'app-trendstarz-score',
  standalone: true,
  imports: [CommonModule, RouterModule, FaqAccordionComponent, ScorePreviewComponent],
  templateUrl: './trendstarz-score.component.html',
  styleUrls: ['./trendstarz-score.component.scss'],
})
export class TrendstarzScoreComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('platformsSection') platformsSectionRef?: ElementRef<HTMLElement>;

  private readonly isBrowser: boolean;
  private platformSectionObserver?: IntersectionObserver;

  // Illustrative example only, shown in the hero — never a real audit result.
  readonly heroExampleScore = 82;
  /** Same tier helper as the rest of the app, so the example's label follows the live thresholds. */
  get heroExampleTier(): string {
    return this.scoreUi.scoreTierLabel(this.heroExampleScore);
  }
  /** Example breakdown for the hero card — illustrative, matches the five score components below. */
  readonly heroExampleBars = [
    { label: 'Profile Completion', value: 92 },
    { label: 'Content Quality', value: 84 },
    { label: 'Posting Consistency', value: 78 },
    { label: 'Professional Branding', value: 80 },
    { label: 'Campaign Readiness', value: 76 },
  ];

  readonly comparisonRows: ComparisonRow[] = [
    { label: 'Profile completeness', followersOnly: 'Not checked', trendScore: 'Scored' },
    { label: 'Content quality', followersOnly: 'Not checked', trendScore: 'Scored' },
    { label: 'Posting consistency', followersOnly: 'Not checked', trendScore: 'Scored' },
    { label: 'Campaign readiness', followersOnly: 'Guesswork', trendScore: 'Clear badge' },
  ];

  readonly audienceCards: AudienceCard[] = [
    {
      role: 'Influencers',
      icon: 'bi-camera-reels-fill',
      tint: 'orange',
      benefits: ['Build stronger creator profiles', 'Improve collaboration readiness', 'Attract more campaigns'],
    },
    {
      role: 'Photographers',
      icon: 'bi-camera-fill',
      tint: 'blue',
      benefits: ['Showcase creative work', 'Improve portfolio visibility', 'Connect with influencers'],
    },
    {
      role: 'Videographers',
      icon: 'bi-camera-video-fill',
      tint: 'purple',
      benefits: ['Demonstrate production quality', 'Grow collaboration opportunities'],
    },
    {
      role: 'Brands',
      icon: 'bi-briefcase-fill',
      tint: 'gray',
      benefits: ['Discover quality creators', 'Compare profiles consistently', 'Make hiring decisions faster'],
    },
  ];

  readonly workflowSteps: WorkflowStep[] = [
    { icon: 'bi-person-plus-fill', label: 'Register', text: 'Create a free influencer or photographer account.' },
    { icon: 'bi-card-checklist', label: 'Add Profile Information', text: 'Fill in your bio, categories, pricing and portfolio.' },
    { icon: 'bi-link-45deg', label: 'Connect Platforms', text: 'Link YouTube, Instagram or Facebook so we can read your public data.' },
    { icon: 'bi-speedometer2', label: 'Generate Your TrendScore', text: 'Get your score out of 100 with a breakdown of each component.' },
    { icon: 'bi-arrow-up-circle-fill', label: 'Improve Your Profile', text: 'Follow your top improvements and re-check as you grow.' },
    { icon: 'bi-trophy-fill', label: 'Get Better Opportunities', text: 'Stronger profiles stand out when brands search and invite.' },
  ];

  // Descriptions mirror collaboration-score-rules.service.ts (backend) — keep them in sync.
  readonly scoreComponents: ScoreComponentCard[] = [
    {
      icon: 'bi-person-vcard',
      title: 'Profile Completion',
      weightKey: 'profileCompletion',
      tone: 'rose',
      description: 'How complete your TrendStarz profile is — the same completion percentage you see on your profile. Filling in every section maxes it out.',
    },
    {
      icon: 'bi-play-btn',
      title: 'Content Quality',
      weightKey: 'contentQuality',
      tone: 'indigo',
      description: 'Engagement on your recent posts (likes and comments relative to views), blended with an AI review of your captions and content when available.',
    },
    {
      icon: 'bi-calendar3',
      title: 'Posting Consistency',
      weightKey: 'postingConsistency',
      tone: 'amber',
      description: 'How recently and how evenly you post. A steady rhythm lifts your score; going 60+ days without posting pulls it down.',
    },
    {
      icon: 'bi-award',
      title: 'Professional Branding',
      weightKey: 'professionalBranding',
      tone: 'teal',
      description: 'A clear profile photo, a descriptive bio, niche categories and published prices — plus a portfolio for photo/videographers.',
    },
    {
      icon: 'bi-hand-thumbs-up',
      title: 'Campaign Readiness',
      weightKey: 'campaignReadiness',
      tone: 'orange',
      description: 'Whether your account meets every requirement to take paid campaigns: verified details, UPI payout set up, and no open high-priority flags on your profile.',
    },
  ];

  /** Defaults from collaboration-score-settings.default.json; replaced by the live admin settings when they load. */
  scoreWeights: CollaborationScoreWeights = {
    profileCompletion: 15,
    contentQuality: 25,
    postingConsistency: 20,
    professionalBranding: 20,
    campaignReadiness: 20,
  };

  /**
   * Level bands come from the admin badge thresholds (Collaboration Score
   * Settings) — the same numbers the backend uses to award Campaign Ready and
   * TrendStarz Recommended — so this page never promises a different cut-off.
   */
  get scoreLevels(): ScoreLevelCard[] {
    const t = this.scoreUi.scoreThresholds;
    const range = (from: number, to: number) => (to >= 100 ? `${from}–100` : `${from}–${to}`);
    // "Unlocks" only for things the score really switches on (badges, sort order);
    // campaign types aren't score-gated, so those are phrased as a "Good fit".
    return [
      {
        range: range(0, t.partiallyReadyMinScore - 1), label: 'Needs Improvement', stage: 'Foundation stage',
        icon: 'bi-sliders', tint: 'gray',
        text: 'Key profile details are missing, posting is irregular, or recent content gets little engagement.',
        unlockPrefix: 'Unlocks', unlockIcon: 'bi-list-check', unlock: 'Your personal top-3 improvement checklist',
      },
      {
        range: range(t.partiallyReadyMinScore, t.campaignReadyMinScore - 1), label: 'Growing', stage: 'Rising talent',
        icon: 'bi-graph-up-arrow', tint: 'blue',
        text: 'A solid base with an active audience. Partially campaign-ready — consistency and branding will lift you further.',
        unlockPrefix: 'Good fit', unlockIcon: 'bi-gift', unlock: 'Product collaborations & gifting campaigns',
      },
      {
        range: range(t.campaignReadyMinScore, t.trendstarzRecommendedMinScore - 1), label: 'Campaign Ready', stage: 'Paid-collab ready',
        icon: 'bi-patch-check', tint: 'orange', highlight: true,
        text: 'Complete profile, steady posting and everything set up to take paid brand collaborations, including UPI payouts.',
        unlockPrefix: 'Unlocks', unlockIcon: 'bi-cash-coin', unlock: 'Campaign Ready badge on your search card',
      },
      {
        range: range(t.trendstarzRecommendedMinScore, 100), label: 'TrendStarz Recommended', stage: 'Top-rated profiles',
        icon: 'bi-award', tint: 'green',
        text: 'A standout, campaign-ready profile that scores strongly across all five dimensions.',
        unlockPrefix: 'Unlocks', unlockIcon: 'bi-stars', unlock: 'Recommended badge & top spot in the “Recommended” sort',
      },
    ];
  }

  // Mirrors the backend collectors (collaboration-score/collectors) — list only data they actually read.
  private readonly allPlatforms: PlatformSupportRow[] = [
    {
      key: 'instagram', platform: 'Instagram', icon: 'bi-instagram', preview: 'After sign-up',
      signals: 'Followers, likes & comments on recent posts, posting rhythm',
      connection: 'Required for a verified score', connectionTone: 'required', needsMeta: true,
    },
    {
      key: 'youtube', platform: 'YouTube', icon: 'bi-youtube', preview: 'Free — public channel URL',
      signals: 'Subscribers, views, likes & comments on recent videos, titles & descriptions, upload rhythm',
      connection: 'Optional', connectionTone: 'optional',
    },
    {
      key: 'facebook', platform: 'Facebook', icon: 'bi-facebook', preview: 'After sign-up',
      signals: 'Page followers, likes & comments on recent posts, posting rhythm',
      connection: 'Required (Facebook Page)', connectionTone: 'required', needsMeta: true,
    },
    {
      key: 'linkedin', platform: 'LinkedIn', icon: 'bi-linkedin', preview: 'Not yet',
      signals: 'Self-reported followers & average engagement (not verified)',
      connection: 'Not available yet', connectionTone: 'muted', selfReportedOnly: true,
    },
    {
      // No collector exists yet — listed only as a planned platform, with no date promised.
      key: 'twitter', platform: 'Twitter / X', icon: 'bi-twitter-x', preview: 'Not yet',
      signals: 'Not collected yet — planned',
      connection: 'Not available yet', connectionTone: 'muted', selfReportedOnly: true,
    },
  ];

  /** Live platform switches from Collaboration Score Settings. Rows default to shown, but
   *  Meta platforms default to not-live so a failed request never over-claims "Live". */
  private platformsEnabled: Record<PlatformKey, boolean> = { instagram: true, youtube: true, facebook: true, linkedin: true, twitter: true };
  private metaConfigured = false;

  /** Live count for the closing banner ("150+"); empty below 50 so a small number is never shown. */
  verifiedCreatorsLabel = '';

  hireCreators(): void {
    this.router.navigate(['/search'], { queryParams: { tab: 'influencers' } });
  }

  get platformSupport(): PlatformSupportRow[] {
    return this.allPlatforms.filter((p) => this.platformsEnabled[p.key] !== false);
  }

  platformStatus(row: PlatformSupportRow): { label: string; live: boolean } {
    if (row.selfReportedOnly) return { label: 'Coming soon', live: false };
    if (row.needsMeta && !this.metaConfigured) return { label: 'Connect coming soon', live: false };
    return { label: 'Live', live: true };
  }

  readonly faqs: FaqAccordionItem[] = [
    {
      question: 'What is TrendScore?',
      answer:
        'TrendScore is a marketplace quality score that helps creators understand their collaboration readiness and helps brands discover profiles worth working with — based on multiple quality indicators, not follower count alone.',
    },
    {
      question: "Why can't Instagram be checked using only a profile URL?",
      answer:
        "Instagram's official API does not support looking up another account's public data without that account's own authorization. Connecting your account gives TrendStarZ permission to read the data needed for an accurate score.",
    },
    {
      question: 'Do brands see my detailed report?',
      answer:
        'No. Brands only see whether you are TrendStarZ Recommended, Campaign Ready, verified, and your overall score — never your improvement recommendations or full report.',
    },
    {
      question: 'Do I need to connect all my accounts?',
      answer:
        'No. You can connect just the platforms you use most. Each connected platform improves accuracy, but a single connected or supported platform is enough to generate a score.',
    },
    {
      question: 'Can I update my score later?',
      answer:
        'Yes. You can re-analyze your profile at any time as you improve it or connect more platforms, so your score always reflects your current profile.',
    },
  ];

  /** Future-ready — stay hidden until an admin feature-flag system exists to gate them. */
  readonly futureFeaturesEnabled = false;

  constructor(
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly router: Router,
    private readonly session: SessionService,
    private readonly analytics: AnalyticsService,
    private readonly scoreApi: CollaborationScoreApiService,
    private readonly scoreUi: CollaborationScoreUiUtilsService,
    private readonly config: ConfigService,
    private readonly cd: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.title.setTitle('TrendScore by TrendStarz | Measure Your Collaboration Readiness');
    this.meta.updateTag({
      name: 'description',
      content:
        'Discover your TrendScore to understand your collaboration readiness, improve your creator profile, and attract more brand opportunities.',
    });
    if (this.isBrowser) {
      this.scoreApi.getPlatformFlags().subscribe({
        next: (flags) => {
          if (flags?.scoreWeights) this.scoreWeights = flags.scoreWeights;
          if (flags?.platformsEnabled) this.platformsEnabled = { ...this.platformsEnabled, ...flags.platformsEnabled };
          this.metaConfigured = flags?.metaConfigured === true;
          this.scoreUi.setThresholds(flags?.scoreThresholds);
        },
        error: () => {}, // keep the defaults
      });
      this.config.getPlatformStats().subscribe((stats) => {
        const n = stats?.verifiedInfluencers || 0;
        this.verifiedCreatorsLabel = n >= 50 ? formatMilestoneCount(n) : '';
        this.cd.markForCheck();
        setTimeout(() => this.cd.detectChanges(), 0); // fetch-backed HttpClient can resolve outside a CD cycle
      });
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || !this.platformsSectionRef || typeof IntersectionObserver === 'undefined') return;
    this.platformSectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.analytics.trackTrendstarzScorePlatformSectionViewed();
            this.platformSectionObserver?.disconnect();
          }
        });
      },
      { threshold: 0.4 },
    );
    this.platformSectionObserver.observe(this.platformsSectionRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.platformSectionObserver?.disconnect();
  }

  /** stroke-dasharray for a 0–100 score on the r=52 ring. */
  ringDash(score: number): string {
    const circumference = 2 * Math.PI * 52;
    return `${(Math.max(0, Math.min(100, score)) / 100) * circumference} ${circumference}`;
  }

  scrollToHowItWorks(): void {
    if (!this.isBrowser) return;
    document.getElementById('how-trendstarz-score-works')?.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Not logged in → the anonymous score-check page (/audit). Logged in →
   * the creator's own dashboard, which already shows their real
   * Collaboration Score card. (A unified /dashboard/trendstarz-score page
   * is planned separately and not part of this pass.)
   */
  checkMyScore(): void {
    const token = this.session.getToken();
    const user = this.session.getUser();
    const loggedIn = !!token && !!user;

    // Anonymous visitors: the free check is on this page — scroll to it rather than leaving.
    const inPageCheck = !loggedIn && this.isBrowser ? document.getElementById('score-check') : null;
    if (inPageCheck) {
      this.analytics.trackTrendstarzScoreCheckClicked({ loggedIn, destination: '#score-check' });
      inPageCheck.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    let destination = '/audit';
    if (loggedIn) {
      const role = String(user.role || '').toLowerCase();
      if (role === 'brand') destination = '/brand-dashboard';
      else if (role === 'photographer') destination = '/photographer-dashboard';
      else destination = '/influencer-dashboard';
    }

    this.analytics.trackTrendstarzScoreCheckClicked({ loggedIn, destination });
    this.router.navigate([destination]);
  }

  onFaqToggled(event: { index: number; question: string }): void {
    this.analytics.trackTrendstarzScoreFaqExpanded({ question: event.question });
  }
}
