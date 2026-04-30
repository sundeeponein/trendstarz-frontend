import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';

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

  influencerSignupParams = {
    source: 'how-it-works',
    audience: 'influencer',
  };

  brandSignupParams = {
    source: 'how-it-works',
    audience: 'brand',
  };

  influencerCampaignParams = {
    source: 'how-it-works-activation',
    audience: 'influencer',
  };

  brandCampaignParams = {
    source: 'how-it-works-activation',
    audience: 'brand',
  };

  private readonly sub: Subscription;

  constructor(
    private readonly session: SessionService,
    private readonly route: ActivatedRoute,
  ) {
    this.user = this.session.getUser();
    this.role = this.resolveRole(this.user);
    this.audienceMode = this.resolveAudience(this.route.snapshot.data?.['audience']);

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
}
