import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { AnalyticsService } from '../../core/analytics.service';
import { SessionService } from '../../core/session.service';
import { FaqAccordionComponent, FaqAccordionItem } from '../../shared/components/faq-accordion/faq-accordion.component';

interface WhyCard {
  icon: string;
  title: string;
  description: string;
}

interface AudienceCard {
  role: string;
  icon: string;
  tint: 'orange' | 'blue' | 'purple' | 'gray';
  benefits: string[];
}

interface WorkflowStep {
  icon: string;
  label: string;
}

interface ScoreComponentCard {
  icon: string;
  title: string;
  description: string;
}

interface ScoreLevelCard {
  range: string;
  label: string;
  tint: 'gray' | 'blue' | 'orange' | 'green';
}

interface PlatformSupportRow {
  platform: string;
  icon: string;
  preview: string;
  connected: string;
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
  imports: [CommonModule, RouterModule, FaqAccordionComponent],
  templateUrl: './trendstarz-score.component.html',
  styleUrls: ['./trendstarz-score.component.scss'],
})
export class TrendstarzScoreComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('platformsSection') platformsSectionRef?: ElementRef<HTMLElement>;

  private readonly isBrowser: boolean;
  private platformSectionObserver?: IntersectionObserver;

  // Illustrative example only, shown in the hero — never a real audit result.
  readonly heroExampleScore = 82;
  readonly heroExampleTier = 'Campaign Ready';

  readonly audienceList = ['Influencers', 'Photographers', 'Videographers', 'Brands'];

  readonly whyCards: WhyCard[] = [
    {
      icon: 'bi-briefcase-fill',
      title: 'Get More Brand Opportunities',
      description: 'Understand how your profile appears to brands.',
    },
    {
      icon: 'bi-graph-up-arrow',
      title: 'Improve Your Profile',
      description: 'Receive actionable recommendations to strengthen your public presence.',
    },
    {
      icon: 'bi-shield-check',
      title: 'Build Marketplace Trust',
      description: 'Profiles with stronger quality indicators are easier for brands to evaluate.',
    },
    {
      icon: 'bi-stars',
      title: 'Stand Out',
      description: 'Increase your visibility inside the TrendStarZ marketplace.',
    },
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
    { icon: 'bi-person-plus-fill', label: 'Register' },
    { icon: 'bi-card-checklist', label: 'Add Profile Information' },
    { icon: 'bi-link-45deg', label: 'Connect Supported Platforms' },
    { icon: 'bi-speedometer2', label: 'Generate TrendStarZ Score' },
    { icon: 'bi-arrow-up-circle-fill', label: 'Improve Profile' },
    { icon: 'bi-trophy-fill', label: 'Receive Better Collaboration Opportunities' },
  ];

  readonly scoreComponents: ScoreComponentCard[] = [
    { icon: 'bi-person-check-fill', title: 'Profile Completion', description: 'How complete and informative your public profile is.' },
    { icon: 'bi-image-fill', title: 'Content Quality', description: 'The strength and consistency of your recent content.' },
    { icon: 'bi-calendar3', title: 'Posting Consistency', description: 'How regularly you publish across your platforms.' },
    { icon: 'bi-award-fill', title: 'Professional Branding', description: 'How ready your presence looks for brand partnerships.' },
    { icon: 'bi-rocket-takeoff-fill', title: 'Campaign Readiness', description: 'Overall readiness to take on paid collaborations.' },
  ];

  readonly scoreLevels: ScoreLevelCard[] = [
    { range: '0–49', label: 'Needs Improvement', tint: 'gray' },
    { range: '50–74', label: 'Growing', tint: 'blue' },
    { range: '75–89', label: 'Campaign Ready', tint: 'orange' },
    { range: '90–100', label: 'TrendStarZ Recommended', tint: 'green' },
  ];

  readonly platformSupport: PlatformSupportRow[] = [
    { platform: 'YouTube', icon: 'bi-youtube', preview: 'Yes (Public URL)', connected: 'Optional' },
    { platform: 'Instagram', icon: 'bi-instagram', preview: 'No', connected: 'Required' },
    { platform: 'Facebook', icon: 'bi-facebook', preview: 'No', connected: 'Required' },
    { platform: 'LinkedIn', icon: 'bi-linkedin', preview: 'Coming Soon', connected: 'Coming Soon' },
  ];

  readonly faqs: FaqAccordionItem[] = [
    {
      question: 'What is TrendStarZ Score?',
      answer:
        'TrendStarZ Score is a marketplace quality score that helps creators understand their collaboration readiness and helps brands discover profiles worth working with — based on multiple quality indicators, not follower count alone.',
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
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.title.setTitle('TrendStarZ Score | Measure Your Collaboration Readiness');
    this.meta.updateTag({
      name: 'description',
      content:
        'Discover your TrendStarZ Score to understand your collaboration readiness, improve your creator profile, and attract more brand opportunities.',
    });
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
