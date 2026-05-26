import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

export interface InvitePayoutDetails {
  upiId: string;
  mobile: string;
  accountHolderName: string;
}

export interface InviteAcceptPayload {
  inviteId: string;
  postDate?: string;
  platform?: string;
  contentType?: string;
  payout?: InvitePayoutDetails;
}

export interface InviteDeclinePayload {
  inviteId: string;
}

interface ContentTypeOption {
  key: string;
  label: string;
  platform: string;
  contentType: string;
  price: number;
}

@Component({
  selector: 'app-campaign-invite-card',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './campaign-invite-card.component.html',
  styleUrls: ['./campaign-invite-card.component.scss'],
})
export class CampaignInviteCardComponent {
  @Input() invite: any;
  @Input() busy = false;
  @Input() qualifyingPlatforms: string[] | null = null;
  @Input() influencerSocialMedia: Array<{ platform: string; tier: string }> | null = null;
  /** initial value for the post-date input (one-shot seed) */
  @Input() set initialPostDate(v: string | undefined) {
    if (v && !this.postDate) this.postDate = v;
  }
  @Input() set initialContentTypeKey(v: string | undefined) {
    if (v && !this.selectedContentTypeKey) this.selectedContentTypeKey = v;
  }
  /** Influencer's saved payout details (from profile). One-shot seed. */
  @Input() set initialPayout(v: InvitePayoutDetails | undefined | null) {
    if (!v) return;
    if (!this.payoutUpiId) this.payoutUpiId = v.upiId || '';
    if (!this.payoutMobile) this.payoutMobile = v.mobile || '';
    if (!this.payoutName) this.payoutName = v.accountHolderName || '';
  }

  @Output() postDateChange = new EventEmitter<string>();
  @Output() contentTypeChange = new EventEmitter<string>();
  @Output() accept = new EventEmitter<InviteAcceptPayload>();
  @Output() decline = new EventEmitter<InviteDeclinePayload>();
  @Output() view = new EventEmitter<any>();
  @Output() validationError = new EventEmitter<string>();
  /** Emits when the influencer clicks "Submit your post" */
  @Output() submitPost = new EventEmitter<void>();
  /** Emits when the influencer clicks "View Submission" */
  @Output() viewSubmission = new EventEmitter<void>();

  postDate = '';
  selectedContentTypeKey = '';
  logoErrored = false;

  // Payout details (where influencer wants to be paid)
  payoutUpiId = '';
  payoutMobile = '';
  payoutName = '';
  payoutEditing = false;

  togglePayoutEdit(ev?: Event) {
    if (ev) ev.stopPropagation();
    this.payoutEditing = !this.payoutEditing;
  }

  /** True for campaigns where the influencer receives money. */
  get needsPayoutDetails(): boolean {
    const t = (this.campaign?.campaignType || '').toLowerCase();
    // Influencer is paid in paid_collab, product (if any) and invite_location.
    // For pay_to_join the influencer pays the brand, so no payout details.
    return t !== 'pay_to_join';
  }

  get payoutSummary(): string {
    const parts: string[] = [];
    if (this.payoutUpiId) parts.push(this.payoutUpiId);
    if (this.payoutMobile) parts.push(this.payoutMobile);
    if (this.payoutName) parts.push(this.payoutName);
    return parts.join(' · ');
  }

  // ── Data accessors ─────────────────────────────────────────────
  private get campaign(): any { return this.invite?.campaign || this.invite?.campaignId || {}; }
  private get brand(): any { return this.invite?.brand || this.invite?.brandId || {}; }

  get inviteId(): string { return this.invite?._id || ''; }
  get status(): string { return (this.invite?.status || 'pending').toLowerCase(); }
  get isActionable(): boolean { return this.status === 'pending' || this.status === 'invited'; }

  // ── Unlock state (mirrors brand-side unlocked flag) ─────────────
  get isUnlocked(): boolean { return !!this.invite?.unlocked; }
  /** Show "Waiting for brand to unlock contact" once accepted but not unlocked. */
  get showWaitingUnlock(): boolean {
    const s = this.status;
    if (this.isUnlocked) return false;
    if (s === 'accepted' && this.campaignTypeKey === 'paid_collab') return false;
    return ['accepted', 'payment_confirmed', 'working', 'submitted'].includes(s);
  }

  // ── Payment-flow CTA logic ──────────────────────────────────────
  /** Paid collab + accepted = brand hasn't paid yet */
  get showPaymentAwaited(): boolean {
    return this.status === 'accepted' && this.campaignTypeKey === 'paid_collab';
  }
  /** Payment has been confirmed by TrendStarZ */
  get showPaymentConfirmed(): boolean {
    return this.status === 'payment_confirmed';
  }
  /** Show the submit-post button */
  get showSubmitCTA(): boolean {
    const s = this.status;
    if (s === 'submitted' || s === 'completed' || s === 'approved' || s === 'disputed') return false;
    if (s === 'payment_confirmed' || s === 'working') return true;
    // accepted + non-paid-collab can submit immediately
    if (s === 'accepted' && this.campaignTypeKey !== 'paid_collab') return true;
    return false;
  }
  /** Show view submission button */
  get showViewSubmission(): boolean {
    return ['submitted', 'completed', 'approved', 'disputed'].includes(this.status);
  }
  /** Reminder badge — only worth showing while invite still actionable. */
  get showReminderBadge(): boolean {
    const count = Number(this.invite?.remindersSent || 0);
    if (count <= 0) return false;
    return ['pending', 'invited', 'accepted', 'payment_confirmed', 'working'].includes(this.status);
  }
  get reminderCount(): number { return Number(this.invite?.remindersSent || 0); }

  // ── Brand-side fulfillment visibility (read-only on influencer card) ──
  get productFulfillment(): any { return this.invite?.productFulfillment || null; }
  get locationVisit(): any { return this.invite?.locationVisit || null; }
  get hasShippingInfo(): boolean {
    const pf = this.productFulfillment;
    if (!pf) return false;
    return !!(pf.trackingId || pf.courier || pf.shippedAt || pf.deliveredAt);
  }
  get hasVisitSchedule(): boolean {
    return !!(this.locationVisit && (this.locationVisit.scheduledAt || this.locationVisit.status === 'checked_in'));
  }

  get statusLabel(): string {
    const s = this.status;
    const labels: Record<string, string> = {
      pending:           'Pending',
      invited:           'Invited',
      accepted:          this.campaignTypeKey === 'paid_collab' ? 'Awaiting payment' : 'Accepted',
      payment_confirmed: 'Collaboration Confirmed — start work',
      working:           'In progress',
      submitted:         'Submitted',
      completed:         'Completed',
      disputed:          'Dispute open',
      withdrawn:         'Withdrawn',
      declined:          'Declined',
    };
    return labels[s] || (s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '));
  }
  get statusBadgeClass(): string {
    switch (this.status) {
      case 'accepted':          return 'bg-warning text-dark';
      case 'payment_confirmed': return 'bg-success';
      case 'working':           return 'bg-primary';
      case 'submitted':         return 'bg-info text-dark';
      case 'completed':         return 'bg-purple text-white';
      case 'disputed':          return 'bg-danger';
      case 'declined':
      case 'withdrawn':         return 'bg-secondary';
      case 'pending':
      case 'invited':
      default:                  return 'bg-info text-dark';
    }
  }

  get campaignTitle(): string { return this.campaign?.title || this.campaign?.campaignTitle || 'Campaign'; }
  get categories(): string[] {
    const c = this.campaign?.categories;
    return Array.isArray(c) ? c : [];
  }

  get campaignTypeKey(): string { return (this.campaign?.campaignType || '').toLowerCase(); }
  get campaignTypeLabel(): string {
    const m: Record<string, string> = {
      paid_collab: 'Paid Collab',
      product: 'Product / Barter',
      invite_location: 'Invite to Location',
      pay_to_join: 'Pay to Join',
    };
    return m[this.campaignTypeKey] || '';
  }
  get campaignTypeIcon(): string {
    const m: Record<string, string> = {
      paid_collab: 'bi-cash-coin',
      product: 'bi-box-seam',
      invite_location: 'bi-geo-alt-fill',
      pay_to_join: 'bi-ticket-perforated',
    };
    return m[this.campaignTypeKey] || 'bi-tag-fill';
  }
  get isInviteLocation(): boolean { return this.campaignTypeKey === 'invite_location'; }
  get isPayToJoin(): boolean { return this.campaignTypeKey === 'pay_to_join'; }
  get isProduct(): boolean { return this.campaignTypeKey === 'product'; }
  get isPaidCollab(): boolean { return this.campaignTypeKey === 'paid_collab'; }

  get inviteBenefits(): string { return (this.campaign?.inviteBenefits || '').trim(); }

  get productDescription(): string { return (this.campaign?.productDescription || '').trim(); }

  get productValueText(): string {
    const paise = Number(this.campaign?.productValue || 0);
    if (paise > 0) return `₹${Math.floor(paise / 100).toLocaleString('en-IN')}`;
    return '';
  }
  get productPaymentMode(): string { return String(this.campaign?.productPaymentMode || 'product_only'); }
  get productPaymentAmountText(): string {
    const paise = Number(this.campaign?.productPaymentAmount || 0);
    if (paise > 0) return `₹${Math.floor(paise / 100).toLocaleString('en-IN')}`;
    return '';
  }

  /** Headline compensation line: "Paid: ₹3000", "Product: Worth ₹2000 (+ ₹500 cash)", "Invite: Stay + food included". */
  get compensationText(): string {
    if (this.isPaidCollab) {
      return this.yourPayoutText ? `Paid: ${this.yourPayoutText}` : '';
    }
    if (this.isProduct) {
      const parts: string[] = [];
      if (this.productValueText) parts.push(`Worth ${this.productValueText}`);
      else parts.push('Barter');
      if (this.productPaymentMode === 'product_plus_payment' && this.productPaymentAmountText) {
        parts.push(`+ ${this.productPaymentAmountText} cash`);
      }
      return `Product: ${parts.join(' ')}`;
    }
    if (this.isInviteLocation) {
      return this.inviteBenefits ? `Invite: ${this.inviteBenefits}` : 'Invite to location';
    }
    return '';
  }
  get compensationIcon(): string {
    if (this.isPaidCollab) return 'bi-cash-coin';
    if (this.isProduct) return 'bi-box-seam';
    if (this.isInviteLocation) return 'bi-geo-alt-fill';
    return 'bi-tag-fill';
  }

  get venueShortText(): string {
    const c = this.campaign || {};
    const parts = [c.venueName, c.venueCity, c.venueDistrict, c.venueState].filter((p: string) => !!p);
    return parts.join(', ');
  }
  get venueFullAddress(): string {
    return (this.campaign?.venueAddress || '').trim();
  }
  get venueMapUrl(): string {
    return (this.campaign?.venueGoogleMapUrl || this.campaign?.venueMapUrl || '').trim();
  }
  get hasVenueDetails(): boolean { return !!(this.venueShortText || this.venueFullAddress || this.venueMapUrl || this.inviteBenefits); }

  get shootLocationType(): string {
    return String(this.campaign?.shootLocationType || '').trim();
  }
  get shootLocationTypeLabel(): string {
    const map: Record<string, string> = {
      studio: 'At photographer studio',
      indoor: 'Indoor shoot location',
      outdoor: 'Outdoor shoot location',
      client_location: 'At brand/client location',
      pickup_point: 'Pickup / collection point',
    };
    return map[this.shootLocationType] || this.shootLocationType;
  }
  get shootLocationAddress(): string {
    return String(this.campaign?.shootLocationAddress || '').trim();
  }
  get shootLocationMapUrl(): string {
    return String(this.campaign?.shootLocationMapUrl || '').trim();
  }
  get shootLocationNotes(): string {
    return String(this.campaign?.shootLocationNotes || '').trim();
  }
  get hasShootLocationDetails(): boolean {
    return !!(this.shootLocationTypeLabel || this.shootLocationAddress || this.shootLocationMapUrl || this.shootLocationNotes);
  }

  get payToJoinFeeText(): string {
    const paise = Number(this.campaign?.pricePerInfluencer || 0);
    if (paise > 0) return `₹${Math.floor(paise / 100).toLocaleString('en-IN')}`;
    return '';
  }
  get payToJoinBenefits(): string { return (this.campaign?.payToJoinBenefits || '').trim(); }

  get hasBudget(): boolean {
    const c = this.campaign;
    return !!this.yourPayoutText || !!this.campaignBudgetText;
  }

  get yourPayoutText(): string {
    const selected = this.selectedContentTypeOption;
    if (selected?.price) {
      return `₹${selected.price.toLocaleString('en-IN')}`;
    }
    const paise = Number(this.campaign?.pricePerInfluencer || 0);
    if (paise > 0) {
      const rupees = Math.floor(paise / 100);
      return `₹${rupees.toLocaleString('en-IN')}`;
    }
    return '';
  }

  get campaignBudgetText(): string {
    const c = this.campaign;
    const min = Number(c?.budgetMin ?? c?.budget ?? 0);
    const max = Number(c?.budgetMax ?? c?.budget ?? min);
    if (!min && !max) return '';
    if (min === max) return `₹${min.toLocaleString('en-IN')}`;
    return `₹${min.toLocaleString('en-IN')} — ₹${max.toLocaleString('en-IN')}`;
  }

  private get timelineRange(): { start?: string; end?: string } {
    const c = this.campaign;
    return {
      start: c?.timelineStart || c?.startDate,
      end: c?.timelineEnd || c?.endDate,
    };
  }
  get hasTimeline(): boolean { return !!(this.timelineRange.start || this.timelineRange.end); }
  get timelineText(): string {
    const { start, end } = this.timelineRange;
    if (!start && !end) return '—';
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
    if (start && end) return `${fmt(start)} — ${fmt(end)}`;
    return fmt(start || end!);
  }
  get minPostDate(): string { return (this.timelineRange.start || '').substring(0, 10); }
  get maxPostDate(): string { return (this.timelineRange.end || '').substring(0, 10); }

  get platformText(): string {
    const campaignMode = String(this.campaign?.campaignMode || '').toLowerCase();
    const isTierFiltered = campaignMode === 'tier_filtered_open' || !!this.campaign?.minInfluencerTier;
    if (this.isActionable && (isTierFiltered || this.hasMultiplePlatformChoices)) {
      if (this.qualifyingPlatformChoices.length) {
        return this.qualifyingPlatformChoices.map((platform) => this.platformLabel(platform)).join(', ');
      }
      // For tier-filtered campaigns, do not fall back to showing all campaign platforms
      // when the influencer doesn't qualify for any; show nothing instead.
      if (isTierFiltered) return '';
      const c = this.campaign;
      if (Array.isArray(c?.platforms) && c.platforms.length) return c.platforms.join(', ');
    }
    // Show locked/selected platform when available
    const selected = this.invite?.selectedPlatform;
    if (selected) return selected;
    const c = this.campaign;
    if (Array.isArray(c?.platforms) && c.platforms.length) return c.platforms.join(', ');
    if (Array.isArray(c?.socialMedia) && c.socialMedia.length) {
      return c.socialMedia.map((sm: any) => this.platformLabel(sm.platform || '')).filter(Boolean).join(', ');
    }
    return '';
  }

  get selectedOutputs(): string[] {
    const sm = this.campaign?.socialMedia;
    const campaignMode = String(this.campaign?.campaignMode || '').toLowerCase();
    const isTierFiltered = campaignMode === 'tier_filtered_open' || !!this.campaign?.minInfluencerTier;
    const qualifying = this.qualifyingPlatformKeySet;
    // If campaign is tier-filtered and influencer doesn't qualify for any platform,
    // do not show legacy deliverables — return empty list.
    if (isTierFiltered && qualifying.size === 0) return [];
    if (Array.isArray(sm) && sm.length) {
      const outputs: string[] = [];
      const locked = this.normalized(this.lockedPlatform);
      for (const row of sm) {
        const rowPlatform = this.normalized(row?.platform || '');
        if (locked && rowPlatform && rowPlatform !== locked) continue;
        if (!locked && qualifying.size && rowPlatform && !qualifying.has(rowPlatform)) continue;
        const platform = this.platformLabel(row?.platform || '');
        for (const ct of row?.contentTypes || []) {
          if (ct?.enabled) outputs.push(`${platform} ${ct.name}`);
        }
      }
      if (outputs.length) return outputs;
    }
    const legacy = this.campaign?.deliverables;
    return Array.isArray(legacy) ? legacy : [];
  }

  private normalized(v: string): string {
    return (v || '').toLowerCase().trim();
  }

  private get qualifyingPlatformChoices(): string[] {
    const explicitChoices = Array.isArray(this.qualifyingPlatforms) ? this.qualifyingPlatforms : [];
    const derivedChoices = explicitChoices.length ? explicitChoices : this.deriveTierQualifyingPlatforms();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const platform of derivedChoices) {
      const normalizedPlatform = this.normalized(platform);
      if (!normalizedPlatform || seen.has(normalizedPlatform)) continue;
      seen.add(normalizedPlatform);
      out.push(String(platform).trim());
    }
    return out;
  }

  private deriveTierQualifyingPlatforms(): string[] {
    const campaignMode = String(this.campaign?.campaignMode || '').toLowerCase();
    const isTierFiltered = campaignMode === 'tier_filtered_open' || !!this.campaign?.minInfluencerTier;
    if (!isTierFiltered) return [];
    const socials = Array.isArray(this.influencerSocialMedia) && this.influencerSocialMedia.length
      ? this.influencerSocialMedia
      : Array.isArray(this.invite?.influencerId?.socialMedia)
        ? this.invite.influencerId.socialMedia
        : [];
    if (!socials.length) return [];

    const tierOrder = ['Starter', 'Nano', 'Micro', 'Mid-Tier', 'Macro', 'Mega / Celebrity'];
    const requiredTier = String(this.campaign?.minInfluencerTier || '').trim();
    const requiredTierIndex = tierOrder.indexOf(requiredTier);
    if (requiredTier && requiredTierIndex === -1) return [];

    const campaignPlatforms = Array.isArray(this.campaign?.platforms) ? this.campaign.platforms : [];
    const allowedPlatforms = new Set(campaignPlatforms.map((platform: string) => this.normalized(platform)));

    return socials
      .filter((entry: any) => {
        const platformKey = this.normalized(entry?.platform || '');
        if (!platformKey) return false;
        if (allowedPlatforms.size && !allowedPlatforms.has(platformKey)) return false;
        if (requiredTierIndex === -1) return true;
        return tierOrder.indexOf(String(entry?.tier || '').trim()) === requiredTierIndex;
      })
      .map((entry: any) => String(entry?.platform || '').trim())
      .filter(Boolean);
  }

  private get qualifyingPlatformKeySet(): Set<string> {
    return new Set(this.qualifyingPlatformChoices.map((platform) => this.normalized(platform)));
  }

  private get hasMultiplePlatformChoices(): boolean {
    const sm = this.campaign?.socialMedia;
    if (!Array.isArray(sm) || !sm.length) return false;
    const qualifying = this.qualifyingPlatformKeySet;
    const platforms = new Set<string>();
    for (const row of sm) {
      const platform = String(row?.platform || '').trim();
      if (!platform) continue;
      if (qualifying.size && !qualifying.has(this.normalized(platform))) continue;
      const hasEnabled = Array.isArray(row?.contentTypes) && row.contentTypes.some((ct: any) => !!ct?.enabled);
      if (hasEnabled) platforms.add(this.normalized(platform));
    }
    return platforms.size > 1;
  }

  get lockedPlatform(): string {
    const campaignMode = String(this.campaign?.campaignMode || '').toLowerCase();
    if (this.isActionable && (campaignMode === 'tier_filtered_open' || this.hasMultiplePlatformChoices)) return '';
    return String(this.invite?.selectedPlatform || '').trim();
  }

  isOptionSelectable(opt: ContentTypeOption): boolean {
    if (!this.lockedPlatform) return true;
    return this.normalized(opt.platform) === this.normalized(this.lockedPlatform);
  }

  get contentTypeOptions(): ContentTypeOption[] {
    const sm = this.campaign?.socialMedia;
    if (!Array.isArray(sm) || !sm.length) return [];
    const out: ContentTypeOption[] = [];
    for (const row of sm) {
      const platform = row.platform || '';
      for (const ct of row.contentTypes || []) {
        if (ct.enabled) {
          out.push({
            key: `${platform}::${ct.name}`,
            platform,
            contentType: ct.name,
            price: Number(ct.price) || 0,
            label: `${this.platformLabel(platform)} · ${ct.name}`,
          });
        }
      }
    }
    return out;
  }

  get selectableContentTypeOptions(): ContentTypeOption[] {
    const qualifying = this.qualifyingPlatformKeySet;
    return this.contentTypeOptions.filter((opt) => {
      if (!this.isOptionSelectable(opt)) return false;
      if (!this.lockedPlatform && qualifying.size) {
        return qualifying.has(this.normalized(opt.platform));
      }
      return true;
    });
  }

  /** UI options shown to influencer; for tier-locked invites we show only relevant platform choices. */
  get displayContentTypeOptions(): ContentTypeOption[] {
    const campaignMode = String(this.campaign?.campaignMode || '').toLowerCase();
    const isTierFiltered = campaignMode === 'tier_filtered_open' || !!this.campaign?.minInfluencerTier;
    const qualifying = this.qualifyingPlatformKeySet;
    if (isTierFiltered && qualifying.size === 0) {
      // If a campaign requires an exact tier but we couldn't determine
      // any qualifying platform for this influencer, do not show
      // content-type options (prevents showing irrelevant platforms).
      return [];
    }
    return this.lockedPlatform || qualifying.size
      ? this.selectableContentTypeOptions
      : this.contentTypeOptions;
  }

  get selectedContentTypeOption(): ContentTypeOption | undefined {
    if (!this.selectedContentTypeKey) return undefined;
    return this.selectableContentTypeOptions.find((opt) => opt.key === this.selectedContentTypeKey);
  }

  get selectedPayoutHint(): string {
    const selected = this.selectedContentTypeOption;
    if (selected?.price) {
      return `Selected payout: ₹${selected.price.toLocaleString('en-IN')}`;
    }
    return this.yourPayoutText ? `Payout: ${this.yourPayoutText}` : '';
  }

  get specialInstructions(): string {
    return (this.campaign?.specialInstructions || '').trim();
  }

  get briefPreview(): string {
    const text = this.specialInstructions;
    if (!text) return '';
    return text.length > 140 ? `${text.slice(0, 140)}...` : text;
  }

  /** Whether this invite was sent by a photographer/creator (collaboration) rather than a standard brand */
  get isCollabInvite(): boolean {
    return (this.brand?.role === 'photographer') || (this.campaign?.createdByRole === 'photographer');
  }
  /** Human-readable invite type shown as a badge on the card header */
  get inviteTypeLabel(): string {
    return this.isCollabInvite ? 'Collaboration' : 'Brand Campaign';
  }
  get inviteTypeIcon(): string {
    return this.isCollabInvite ? 'bi-camera-reels' : 'bi-megaphone';
  }

  get brandName(): string {
    return this.brand?.brandName || this.brand?.businessName || this.brand?.name || 'Brand';
  }
  get brandInitial(): string { return (this.brandName || '?')[0].toUpperCase(); }

  /** Brand contact details — only populated by backend when invite.unlocked === true */
  get brandEmail(): string { return this.brand?.email || ''; }
  get brandPhone(): string { return this.brand?.phoneNumber || ''; }
  get brandLogo(): string | null {
    const b = this.brand;
    let url: string | null = null;
    if (Array.isArray(b?.brandLogo) && b.brandLogo.length) url = b.brandLogo[0]?.url || null;
    else if (typeof b?.brandLogo === 'string') url = b.brandLogo;
    url = url || b?.logoUrl || b?.profileImage || b?.logo || null;
    return this.normalizeImage(url);
  }

  // ── Helpers ─────────────────────────────────────────────────
  platformIcon(p: string): string {
    const m: Record<string, string> = {
      instagram: 'bi-instagram',
      youtube: 'bi-youtube',
      twitter: 'bi-twitter-x',
      x: 'bi-twitter-x',
      tiktok: 'bi-tiktok',
      facebook: 'bi-facebook',
      linkedin: 'bi-linkedin',
    };
    return m[(p || '').toLowerCase()] || 'bi-share';
  }
  platformLabel(p: string): string {
    const m: Record<string, string> = {
      instagram: 'Instagram',
      youtube: 'YouTube',
      twitter: 'X / Twitter',
      x: 'X / Twitter',
      tiktok: 'TikTok',
      facebook: 'Facebook',
      linkedin: 'LinkedIn',
    };
    return m[(p || '').toLowerCase()] || p;
  }

  private normalizeImage(url: string | null): string | null {
    if (!url) return null;
    if (/^https?:\/\//.test(url)) return url;
    if (url.startsWith('/assets/')) {
      const api = environment.apiBaseUrl || '';
      const backend = api.replace(/\/api\/?$/, '');
      return backend ? backend + url : url;
    }
    return url;
  }

  // ── Event handlers ─────────────────────────────────────────
  onCardClick() { this.view.emit(this.invite); }
  onView(ev: Event) { ev.stopPropagation(); this.view.emit(this.invite); }
  onActionsClick(ev: Event) { ev.stopPropagation(); }

  selectContentType(key: string) {
    const option = this.contentTypeOptions.find((opt) => opt.key === key);
    if (!option || !this.isOptionSelectable(option)) return;
    this.selectedContentTypeKey = key;
    this.contentTypeChange.emit(key);
  }

  onPostDateChange(v: string) {
    this.postDate = v;
    this.postDateChange.emit(v);
  }

  onAccept(ev: Event) {
    ev.stopPropagation();
    if (!this.inviteId) return;
    if (!this.postDate) {
      this.validationError.emit('Please select a posting date before accepting.');
      return;
    }
    if (this.selectableContentTypeOptions.length && !this.selectedContentTypeKey) {
      this.validationError.emit('Please select what you will create.');
      return;
    }
    if (this.selectedContentTypeKey && !this.selectedContentTypeOption) {
      this.validationError.emit(
        this.lockedPlatform
          ? `Please choose a content option only for ${this.platformLabel(this.lockedPlatform)}.`
          : 'Please select a valid content option.'
      );
      return;
    }
    const [platform, contentType] = this.selectedContentTypeKey
      ? this.selectedContentTypeKey.split('::')
      : [undefined, undefined];

    // Require at least one payout channel for campaigns where the
    // influencer will be paid.
    if (this.needsPayoutDetails) {
      const upi = (this.payoutUpiId || '').trim();
      const mobile = (this.payoutMobile || '').trim();
      if (!upi && !mobile) {
        this.payoutEditing = true;
        this.validationError.emit(
          'Please add a UPI ID or mobile number where you want to receive payment.',
        );
        return;
      }
    }

    const payout: InvitePayoutDetails | undefined = this.needsPayoutDetails
      ? {
          upiId: (this.payoutUpiId || '').trim(),
          mobile: (this.payoutMobile || '').trim(),
          accountHolderName: (this.payoutName || '').trim(),
        }
      : undefined;

    this.accept.emit({
      inviteId: this.inviteId,
      postDate: this.postDate || undefined,
      platform,
      contentType,
      payout,
    });
  }

  onDecline(ev: Event) {
    ev.stopPropagation();
    if (!this.inviteId) return;
    this.decline.emit({ inviteId: this.inviteId });
  }

  onLogoError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
    this.logoErrored = true;
  }
}
