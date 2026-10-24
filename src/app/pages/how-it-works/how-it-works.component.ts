import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { FlowHelpModalService } from '../../shared/components/flow-help-modal/flow-help-modal.service';

type UserRole = 'influencer' | 'brand' | 'admin' | 'guest';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
})
export class HowItWorksComponent implements OnDestroy {
  user: any = null;
  role: UserRole = 'guest';
  audienceMode: 'all' | 'influencer' | 'brand' | 'photographer' = 'all';
  routeBasePath = '/how-it-works';
  routeSource = 'how-it-works';

  get pageEyebrow(): string {
    return this.routeBasePath === '/features' ? 'Features' : 'How It Works';
  }

  readonly dealLifecycleSteps = [
    {
      icon: 'bi-megaphone-fill',
      tint: 'peach',
      title: 'Brand Offers',
      description: 'A lifestyle brand offers Rs 3,000 for a dedicated reel and story set.',
      status: 'Initiated',
    },
    {
      icon: 'bi-tag-fill',
      tint: 'blue',
      title: 'Influencer Accepts',
      description: 'The creator reviews terms, portfolio match, and clicks "Accept Offer".',
      status: 'Agreed',
    },
    {
      icon: 'bi-check-circle-fill',
      tint: 'purple',
      title: 'Done',
      description: 'Content is uploaded, brand approves, and payment is released instantly.',
      status: 'Completed',
    },
  ];

  influencerSignupParams = {
    source: this.routeSource,
    audience: 'influencer',
  };

  brandSignupParams = {
    source: this.routeSource,
    audience: 'brand',
  };

  photographerSignupParams = {
    source: this.routeSource,
    audience: 'photographer',
  };

  influencerCampaignParams = {
    source: `${this.routeSource}-activation`,
    audience: 'influencer',
  };

  brandCampaignParams = {
    source: `${this.routeSource}-activation`,
    audience: 'brand',
  };

  private readonly sub: Subscription;

  constructor(
    private readonly session: SessionService,
    private readonly route: ActivatedRoute,
    readonly flowHelp: FlowHelpModalService,
  ) {
    this.user = this.session.getUser();
    this.role = this.resolveRole(this.user);
    this.audienceMode = this.resolveAudience(this.route.snapshot.data?.['audience']);
    this.routeBasePath = this.resolveBasePath(this.route.snapshot.routeConfig?.path);
    this.routeSource = this.routeBasePath === '/features' ? 'features' : 'how-it-works';
    this.influencerSignupParams.source = this.routeSource;
    this.brandSignupParams.source = this.routeSource;
    this.influencerCampaignParams.source = `${this.routeSource}-activation`;
    this.brandCampaignParams.source = `${this.routeSource}-activation`;

    this.sub = this.session.user$.subscribe((user) => {
      this.user = user;
      this.role = this.resolveRole(user);
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private resolveRole(user: any): UserRole {
    if (!user?.role) return 'guest';
    if (user.role === 'influencer') return 'influencer';
    if (user.role === 'brand') return 'brand';
    return 'admin';
  }

  private resolveAudience(
    audience: unknown,
  ): 'all' | 'influencer' | 'brand' | 'photographer' {
    if (
      audience === 'influencer' ||
      audience === 'brand' ||
      audience === 'photographer'
    ) {
      return audience;
    }
    return 'all';
  }

  private resolveBasePath(path: string | undefined): string {
    if (path?.startsWith('features')) return '/features';
    return '/how-it-works';
  }
}
