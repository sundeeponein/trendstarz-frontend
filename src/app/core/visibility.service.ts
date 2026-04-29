import { Injectable } from '@angular/core';
import { SessionService } from './session.service';

/**
 * ViewerTier represents the access level of the current viewer.
 *  - guest: not logged in
 *  - free:  logged in, no active premium
 *  - pro:   logged in with an active premium subscription
 */
export type ViewerTier = 'guest' | 'free' | 'pro';

/**
 * Centralized visibility rules used across the app to decide what UI sections,
 * fields and actions should be exposed to a given viewer when looking at an
 * Influencer or a Brand profile/card.
 *
 * Visibility matrix
 * -----------------
 *  Field / action            | Guest | Free | Pro
 *  --------------------------|-------|------|------
 *  Public profile basics     |  yes  | yes  | yes   (name, categories, location, platforms, tier, promo price)
 *  Promo / starting price    |  yes  | yes  | yes
 *  Engagement rate           |  no   | no   | yes
 *  Per-content-type pricing  |  no   | no   | yes
 *  Detailed insights         |  no   | no   | yes
 *  Contact (email/phone/wa)  |  no   | blur | yes   (free sees blurred placeholder)
 *  Follow button             |  no   | yes  | yes
 *  Brand social handles      |  no   | conditional* | conditional*
 *  Campaign invite quota     |  -    | 1    | 5
 *
 *  *Brand social handles are additionally gated server-side by
 *  `canViewBrandSocialMedia` (premium ↔ premium, or active campaign invite,
 *  or brand owner viewing themselves).
 */
@Injectable({ providedIn: 'root' })
export class VisibilityService {
  constructor(private session: SessionService) {}

  /** Resolves the current viewer's tier. */
  tier(): ViewerTier {
    const user = this.session.getUser();
    if (!user) return 'guest';
    return user.isPremium ? 'pro' : 'free';
  }

  isGuest(): boolean { return this.tier() === 'guest'; }
  isFree(): boolean { return this.tier() === 'free'; }
  isPro(): boolean { return this.tier() === 'pro'; }
  isLoggedIn(): boolean { return this.tier() !== 'guest'; }

  // ─── Profile / card field-level rules ────────────────────────────────────
  canViewPromotionalPrice(): boolean { return true; }
  canViewEngagementRate(): boolean { return this.isPro(); }
  canViewContentTypePrices(): boolean { return this.isPro(); }
  canViewDetailedInsights(): boolean { return this.isPro(); }

  /** Plain contact details (email / phone / WhatsApp). */
  canViewContact(): boolean { return this.isPro(); }
  /** Whether to render a blurred placeholder for contact rows. */
  shouldBlurContact(): boolean { return this.isFree(); }
  /** Whether to render the contact section at all (hidden for guests). */
  canSeeContactSection(): boolean { return this.isLoggedIn(); }

  // ─── Action-level rules ──────────────────────────────────────────────────
  canFollow(): boolean { return this.isLoggedIn(); }
  canSendCampaignInvite(): boolean { return this.isLoggedIn(); }

  /**
   * Maximum influencers a brand may invite per campaign based on plan.
   * Free brands: 1 invite per campaign. Premium brands: 5.
   */
  campaignInviteQuota(): number {
    if (!this.isLoggedIn()) return 0;
    return this.isPro() ? 5 : 1;
  }
}
