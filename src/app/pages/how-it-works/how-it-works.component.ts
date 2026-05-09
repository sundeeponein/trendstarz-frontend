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
  audienceMode: 'all' | 'influencer' | 'brand' = 'all';
  routeBasePath = '/how-it-works';
  routeSource = 'how-it-works';

  get pageEyebrow(): string {
    return this.routeBasePath === '/features' ? 'Features' : 'How It Works';
  }

  influencerSignupParams = {
    source: this.routeSource,
    audience: 'influencer',
  };

  brandSignupParams = {
    source: this.routeSource,
    audience: 'brand',
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
  ): 'all' | 'influencer' | 'brand' {
    if (audience === 'influencer' || audience === 'brand') return audience;
    return 'all';
  }

  private resolveBasePath(path: string | undefined): string {
    if (path?.startsWith('features')) return '/features';
    return '/how-it-works';
  }
}
