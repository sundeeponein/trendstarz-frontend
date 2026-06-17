import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { SessionService } from '../../core/session.service';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { UserAvatarComponent } from '../components/user-avatar/user-avatar.component';
import { OfferTrailComponent } from '../offer-trail/offer-trail.component';

export interface CampaignAcceptPayload {
  inviteId: string;
  postDate?: string;
  platform?: string;
  contentType?: string;
  responseType?: 'accept' | 'counter';
  counterAmount?: number;
  counterMessage?: string;
  payout?: { upiId?: string; mobile?: string; accountHolderName?: string };
}

export interface CampaignDeclinePayload {
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
  selector: 'app-campaign-detail-modal',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, RouterModule, UserAvatarComponent, OfferTrailComponent],
  templateUrl: './campaign-detail-modal.component.html',
  styleUrls: ['./campaign-detail-modal.component.scss']
})
export class CampaignDetailModalComponent implements OnChanges {
  @Input() invite: any;
  @Input() visible = false;
  // Optional: platform/tier that the current influencer qualifies with for this campaign
  @Input() qualifyingPlatform?: string | null;
  @Input() qualifyingTier?: string | null;
  @Input() showDateInput = true;
  @Input() busy = false;
  @Input() adminReview = false;
  @Input() adminInviteProgressLoading = false;
  @Input() adminCanApprove = true;
  @Input() adminCanRequestChanges = true;
  @Input() adminCanReject = true;
  @Input() set initialPostDate(v: string | undefined) {
    if (v) this.postDate = v;
  }
  @Input() set initialContentTypeKey(v: string | undefined) {
    if (v) this.selectedContentTypeKey = v;
  }
  @Input() set initialPayout(v: { upiId?: string; mobile?: string; accountHolderName?: string } | undefined | null) {
    if (!v) return;
    if (!this.payoutUpiId) this.payoutUpiId = v.upiId || '';
    if (!this.payoutMobile) this.payoutMobile = v.mobile || '';
    if (!this.payoutName) this.payoutName = v.accountHolderName || '';
  }

  @Output() close = new EventEmitter<void>();
  @Output() accept = new EventEmitter<CampaignAcceptPayload>();
  @Output() decline = new EventEmitter<CampaignDeclinePayload>();
  @Output() approve = new EventEmitter<void>();
  @Output() requestChanges = new EventEmitter<void>();
  @Output() reject = new EventEmitter<void>();
  @Output() validationError = new EventEmitter<string>();

  postDate = '';
  selectedContentTypeKey = '';
  counterEditing = false;
  counterAmountInput: number | null = null;
  counterReasonInput = '';
  adminInviteStatusFilter = 'all';
  toastError = '';
  private toastTimer: any;
  payoutUpiId = '';
  payoutMobile = '';
  payoutName = '';
  payoutEditing = false;

  get needsPayoutDetails(): boolean {
    return (this.campaign?.campaignType || '').toLowerCase() !== 'pay_to_join';
  }

  get payoutSummaryText(): string {
    const parts: string[] = [];
    if (this.payoutUpiId) parts.push(this.payoutUpiId);
    if (this.payoutMobile) parts.push(this.payoutMobile);
    if (this.payoutName) parts.push(this.payoutName);
    return parts.join(' · ');
  }

  togglePayoutEdit() {
    this.payoutEditing = !this.payoutEditing;
  }
  // Previously used to delay pointer-events; removed now that modal mounts immediately.

  constructor(private cdr: ChangeDetectorRef, private session: SessionService) {}

  /** Platforms the signed-in user has in their profile (normalized set) */
  private get userSocialPlatformKeySet(): Set<string> {
    const set = new Set<string>();
    try {
      const user = this.session.getUser();
      const candidates = (user?.socialMedia || user?.profile?.socialMedia || []);
      if (Array.isArray(candidates)) {
        for (const sm of candidates) {
          const p = String((sm && (sm.platform || sm.name)) || '').trim().toLowerCase();
          if (p) set.add(p);
        }
      }
    } catch {
      // ignore and return empty set
    }
    return set;
  }

  userHasPlatform(platform: string): boolean {
    if (!platform) return false;
    const set = this.userSocialPlatformKeySet;
    if (!set.size) return false;
    return set.has(this.normalized(platform));
  }

  get missingPlatforms(): Array<{ platform: string; label: string }> {
    const c = this.campaign;
    const src = Array.isArray(c?.socialMedia) && c.socialMedia.length ? c.socialMedia : (Array.isArray(c?.platforms) ? c.platforms.map((p: any) => ({ platform: p })) : []);
    const list: string[] = (Array.isArray(src) ? src.map((r: any) => (typeof r === 'string' ? r : r.platform || r.name || '')).filter(Boolean) : []);
    const unique = Array.from(new Set(list.map((p) => this.normalized(p))));
    const missing: Array<{ platform: string; label: string }> = [];
    for (const p of unique) {
      if (!this.userHasPlatform(p)) {
        missing.push({ platform: p, label: this.platformLabel(p) });
      }
    }
    return missing;
  }

  get profileEditLink(): any[] {
    try {
      const user = this.session.getUser() || {};
      const role = String(user.role || user.userType || '').toLowerCase();
      if (role.includes('influencer')) return ['/influencer-profile'];
      if (role.includes('photographer')) return ['/photographer-profile'];
      if (role.includes('brand')) return ['/brand-profile'];
    } catch {
      // ignore
    }
    return ['/influencer-profile'];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['invite'] || changes['adminInviteProgressLoading'] || changes['visible']) {
      this.cdr.detectChanges();
    }
  }

  get campaign(): any {
    return this.invite?.campaign || this.invite?.campaignId || {};
  }
  private get brand(): any {
    return this.invite?.brand || this.invite?.brandId || {};
  }

  get campaignImageUrls(): string[] {
    const c = this.campaign || {};
    const candidates: unknown[] = [];
    if (typeof c?.image?.url === 'string') candidates.push(c.image.url);
    if (typeof c?.image === 'string') candidates.push(c.image);
    if (Array.isArray(c?.images)) candidates.push(...c.images);
    if (Array.isArray(c?.galleryImages)) candidates.push(...c.galleryImages);

    const urls: string[] = [];
    for (const item of candidates) {
      if (typeof item === 'string' && item.trim()) {
        urls.push(item.trim());
        continue;
      }
      if (item && typeof item === 'object') {
        const maybeUrl = String((item as any)?.url || (item as any)?.src || '').trim();
        if (maybeUrl) urls.push(maybeUrl);
      }
    }
    return Array.from(new Set(urls));
  }

  get campaignImageUrl(): string {
    return this.campaignImageUrls[0] || '';
  }

  onCampaignImgError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  get inviteId(): string { return this.invite?._id || ''; }

  get counterOfferStatus(): string {
    return String(this.invite?.counterOffer?.status || '').toLowerCase();
  }
  get isPending(): boolean {
    const s = String(this.invite?.status || '').toLowerCase();
    return (s === 'pending' || s === 'invited' || (s === 'counter_sent' && this.counterOfferStatus === 'brand_sent'))
      && this.campaignStatus !== 'completed';
  }
  get statusKey(): string { return (this.invite?.status || 'pending').toLowerCase(); }

  get statusFooterLabel(): string {
    const s = this.invite?.status;
    if (!s || s === 'pending' || s === 'invited') return 'Pending Approval';
    if (s === 'counter_sent' && this.counterOfferStatus === 'brand_sent') return 'Revised Offer Pending';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  get dateContextNoun(): 'posting' | 'visiting' {
    return this.isInviteLocation ? 'visiting' : 'posting';
  }

  get dateInputTitle(): string {
    return this.isInviteLocation ? 'Select visiting date' : 'Select posting date';
  }

  get dateChecklistLabel(): string {
    return this.isInviteLocation ? 'Visiting window' : 'Posting window';
  }

  get dateHistoryLabel(): string {
    return this.isInviteLocation ? 'Visit date' : 'Post date';
  }

  get campaignTitle(): string {
    return this.campaign?.title || this.campaign?.campaignTitle || 'Campaign';
  }
  get campaignDescription(): string { return this.campaign?.description || ''; }
  /** Description cleaned of literal "undefined" / empty strings, formatted for display */
  get campaignDescriptionSafe(): string {
    const raw = String(this.campaignDescription || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw === 'undefined' || raw === 'null') return '';
    return this.campaignDescriptionFormatted;
  }
  get campaignDescriptionFormatted(): string {
    const raw = String(this.campaignDescription || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw === 'undefined' || raw === 'null') return '';
    const withHeadings = raw.replace(
      /\s*(What we expect:|Content Guidelines:|Deliverables:|Timeline:|Payment:|Important Notes:)/gi,
      '\n$1'
    );
    const withBullets = withHeadings.replace(/\s*•\s*/g, '\n• ');
    return withBullets.replace(/\n{2,}/g, '\n').trim();
  }
  get campaignStatus(): string { return (this.campaign?.status || '').toLowerCase(); }

  get campaignModerationNote(): string {
    return String(this.campaign?.moderationNote || '').trim();
  }

  get campaignTypeKey(): string {
    return (this.campaign?.campaignType || '').toLowerCase();
  }

  get campaignTypeLabel(): string {
    const m: Record<string, string> = {
      paid_collab: 'Paid Collab',
      product: 'Product Collab',
      invite_location: 'Invite to Location',
      pay_to_join: 'Pay to Join',
    };
    return m[this.campaignTypeKey] || '';
  }

  get isInviteLocation(): boolean { return this.campaignTypeKey === 'invite_location'; }
  get isPayToJoin(): boolean { return this.campaignTypeKey === 'pay_to_join'; }
  get isProduct(): boolean { return this.campaignTypeKey === 'product'; }
  get isPaidCollab(): boolean { return this.campaignTypeKey === 'paid_collab'; }

  get isInviteCampaign(): boolean {
    return !!this.invite || this.isInviteLocation || this.isPaidCollab || this.isProduct;
  }

  get showInvitePlatformSections(): boolean {
    return this.isInviteCampaign && this.allCampaignPlatforms.length > 0;
  }

  get isUnlocked(): boolean { return !!this.invite?.unlocked; }

  private get isLocationPaymentConfirmed(): boolean {
    const paymentConfirmedOrLater = ['payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed']
      .includes(this.statusKey);
    if (paymentConfirmedOrLater) return true;
    return this.isUnlocked && ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed']
      .includes(this.statusKey);
  }

  get canRevealExactVenueDetails(): boolean {
    return this.isLocationPaymentConfirmed;
  }

  get canRevealExactShootLocation(): boolean {
    return this.isLocationPaymentConfirmed;
  }

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
  get productSummary(): string {
    const parts: string[] = [];
    if (this.productValueText) parts.push(`Worth ${this.productValueText}`);
    if (this.productPaymentMode === 'product_plus_payment' && this.productPaymentAmountText) {
      parts.push(`+ ${this.productPaymentAmountText} cash`);
    } else if (this.productPaymentMode === 'product_only' && this.productValueText) {
      parts.push('(Product only)');
    }
    return parts.join(' ');
  }

  get venueName(): string { return (this.campaign?.venueName || '').trim(); }
  get venueAddress(): string { return (this.campaign?.venueAddress || '').trim(); }
  get venueCity(): string { return (this.campaign?.venueCity || '').trim(); }
  get venueDistrict(): string { return (this.campaign?.venueDistrict || '').trim(); }
  get venueState(): string { return (this.campaign?.venueState || '').trim(); }
  get venueMapUrl(): string { return (this.campaign?.venueGoogleMapUrl || this.campaign?.venueMapUrl || '').trim(); }
  get venueCityState(): string {
    const parts = [this.venueCity, this.venueDistrict, this.venueState].filter(Boolean);
    return parts.join(', ');
  }
  get venueDistrictState(): string {
    const parts = [this.venueDistrict, this.venueState].filter(Boolean);
    if (parts.length) return parts.join(', ');
    return this.venueCityState;
  }
  get venuePreviewText(): string {
    return this.venueDistrictState;
  }
  get hasVenueDetails(): boolean {
    return !!(this.venueName || this.venueAddress || this.venueCity || this.venueDistrict || this.venueState || this.venueMapUrl);
  }

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

  get payToJoinBenefits(): string { return (this.campaign?.payToJoinBenefits || '').trim(); }
  get payToJoinInstructions(): string { return (this.campaign?.payToJoinInstructions || '').trim(); }
  get hasPayToJoinDetails(): boolean { return !!(this.payToJoinBenefits || this.payToJoinInstructions); }

  get hasBudget(): boolean {
    return !!this.yourPayoutText || !!this.campaignBudgetText;
  }

  get yourPayoutText(): string {
    const status = this.statusKey;
    const acceptedOrLater = ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed']
      .includes(status);
    if (acceptedOrLater) {
      const agreedPaise = Number(this.invite?.agreedAmountPaise || 0);
      const agreedRupees = Number(this.invite?.agreedAmount || 0);
      if (agreedPaise > 0) {
        const rupees = Math.floor(agreedPaise / 100);
        return `₹${rupees.toLocaleString('en-IN')}`;
      }
      if (agreedRupees > 0) {
        return `₹${agreedRupees.toLocaleString('en-IN')}`;
      }
    }

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
    if (min > 0 || max > 0) {
      if (min > 0 && max > 0 && min !== max) return `₹${min.toLocaleString('en-IN')} — ₹${max.toLocaleString('en-IN')}`;
      return `₹${(min || max).toLocaleString('en-IN')}`;
    }

    const paise = Number(c?.pricePerInfluencer || c?.estimatedBudget || c?.amount || 0);
    if (paise > 0) return `₹${Math.floor(paise / 100).toLocaleString('en-IN')}`;

    const inviteProgress = Array.isArray(c?.inviteProgress) ? c.inviteProgress : [];
    for (const row of inviteProgress) {
      const rowPaise = Number(
        row?.agreedAmountPaise
          || row?.campaignAmountPaise
          || row?.counterOfferedAmountPaise
          || row?.counterRequestedAmountPaise
          || 0,
      );
      if (rowPaise > 0) return `₹${Math.floor(rowPaise / 100).toLocaleString('en-IN')}`;

      const rowRupees = Number(
        row?.agreedAmount
          || row?.counterOfferedAmount
          || row?.counterRequestedAmount
          || 0,
      );
      if (rowRupees > 0) return `₹${rowRupees.toLocaleString('en-IN')}`;
    }

    return '';
  }

  private get timelineRange(): { start?: string; end?: string } {
    const c = this.campaign;
    return {
      start: c?.timelineStart || c?.startDate,
      end: c?.timelineEnd || c?.endDate,
    };
  }
  get timelineText(): string {
    const { start, end } = this.timelineRange;
    if (!start && !end) return '—';
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (start && end) return `${fmt(start)} — ${fmt(end)}`;
    return fmt(start || end!);
  }
  get timelineYearText(): string {
    const { start, end } = this.timelineRange;
    const d = end || start;
    if (!d) return '';
    return String(new Date(d).getFullYear());
  }
  get minPostDate(): string { return (this.timelineRange.start || '').substring(0, 10); }
  get maxPostDate(): string { return (this.timelineRange.end || '').substring(0, 10); }

  get slots(): number {
    return Number(this.campaign?.maxInfluencers || 0) || 0;
  }

  get selectedOutputs(): string[] {
    const sm = this.campaign?.socialMedia;
    if (Array.isArray(sm) && sm.length) {
      const outputs: string[] = [];
      const locked = this.normalized(this.lockedPlatform);
      const qualifying = this.qualifyingPlatformKeySet;
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

  get deliverables(): string[] {
    const raw = this.campaign?.deliverables;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item: unknown) => String(item || '').trim())
      .filter(Boolean);
  }


  get lockedPlatform(): string {
    return String(this.invite?.selectedPlatform || '').trim();
  }

  isOptionSelectable(opt: ContentTypeOption): boolean {
    if (!this.lockedPlatform) return true;
    return this.normalized(opt.platform) === this.normalized(this.lockedPlatform);
  }

  get platforms(): { platform: string }[] {
    const c = this.campaign;
    if (Array.isArray(c?.socialMedia) && c.socialMedia.length) {
      const list = c.socialMedia.map((sm: any) => ({ platform: sm.platform || '' }));
      const qualifying = this.qualifyingPlatformKeySet;
      if (!this.lockedPlatform && qualifying.size) {
        const filteredByQual = list.filter((p: any) => qualifying.has(this.normalized(p.platform)));
        return filteredByQual.length ? filteredByQual : [];
      }
      if (!this.lockedPlatform) return list;
      const locked = this.normalized(this.lockedPlatform);
      const filtered = list.filter((p: any) => this.normalized(p.platform) === locked);
      return filtered.length ? filtered : list;
    }
    if (Array.isArray(c?.platforms) && c.platforms.length) {
      const list = c.platforms.map((p: string) => ({ platform: p }));
      if (!this.lockedPlatform) return list;
      const locked = this.normalized(this.lockedPlatform);
      const filtered = list.filter((p: any) => this.normalized(p.platform) === locked);
      return filtered.length ? filtered : list;
    }
    return [];
  }

  /** All campaign platforms without any filtering (for display only) */
  get allCampaignPlatforms(): { platform: string }[] {
    const c = this.campaign;
    if (Array.isArray(c?.socialMedia) && c.socialMedia.length) {
      return c.socialMedia
        .map((sm: any) => ({ platform: sm.platform || '' }))
        .filter((p: { platform: string }) => p.platform);
    }
    if (Array.isArray(c?.platforms) && c.platforms.length) {
      return c.platforms.map((p: string) => ({ platform: p }));
    }
    return [];
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
      if (!this.lockedPlatform && qualifying.size) return qualifying.has(this.normalized(opt.platform));
      return true;
    });
  }

  /** UI options shown to influencer; for tier-locked invites we show only relevant platform choices. */
  get displayContentTypeOptions(): ContentTypeOption[] {
    // Return campaign-provided options (respecting locked/qualifying constraints).
    return this.lockedPlatform || this.qualifyingPlatformKeySet.size
      ? this.selectableContentTypeOptions
      : this.contentTypeOptions;
  }

  get showHostRequestedPlatforms(): boolean {
    return this.displayContentTypeOptions.length > 0;
  }

  get hostRequestedPlatformsNote(): string {
    return this.isPending
      ? 'Choose only one option before accepting.'
      : 'These platforms were requested by the host for this campaign. Update your profile to receive more matching campaigns.';
  }

  /** Options the signed-in user can actually select (has that platform in profile) */
  get availableContentTypeOptions(): ContentTypeOption[] {
    const opts = this.displayContentTypeOptions || [];
    const userSet = this.userSocialPlatformKeySet;
    if (!userSet.size) return opts; // if user has no platforms recorded, keep all selectable
    return opts.filter((opt) => userSet.has(this.normalized(opt.platform)));
  }

  get matchingPlatforms(): { platform: string }[] {
    const seen = new Set<string>();
    return this.availableContentTypeOptions
      .map((opt) => ({ platform: opt.platform }))
      .filter((entry) => {
        const key = this.normalized(entry.platform);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  get hasMatchingPlatforms(): boolean {
    return this.matchingPlatforms.length > 0;
  }

  /** List of unique platforms user has that match campaign */
  get matchingPlatformsList(): string[] {
    const seen = new Set<string>();
    const platforms: string[] = [];
    for (const p of this.matchingPlatforms) {
      const norm = this.normalized(p.platform);
      if (!seen.has(norm)) {
        seen.add(norm);
        platforms.push(p.platform);
      }
    }
    return platforms;
  }

  /** Options present in campaign but user doesn't have the platform (show disabled) */
  get unavailableContentTypeOptions(): ContentTypeOption[] {
    const opts = this.displayContentTypeOptions || [];
    const userSet = this.userSocialPlatformKeySet;
    if (!userSet.size) return [];
    return opts.filter((opt) => !userSet.has(this.normalized(opt.platform)));
  }

  private normalized(v: string): string {
    return (v || '').toLowerCase().trim();
  }

  private get qualifyingPlatformKeySet(): Set<string> {
    const set = new Set<string>();
    if (this.qualifyingPlatform) set.add(this.normalized(this.qualifyingPlatform));
    return set;
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

  get hasValidCounterAmount(): boolean {
    const amount = Number(this.counterAmountInput || 0);
    return Number.isFinite(amount) && amount > 0;
  }

  get hasUsedCounterOffer(): boolean {
    const status = String(this.invite?.counterOffer?.status || '').toLowerCase();
    return status === 'sent' || status === 'brand_sent' || status === 'accepted' || status === 'declined';
  }

  get canSendCounterOffer(): boolean {
    return this.isPending && !this.hasUsedCounterOffer;
  }

  get isPhotographerCollabFlow(): boolean {
    const ownerType = String(this.campaign?.ownerType || this.campaign?.createdByRole || '').toLowerCase();
    const requestKind = String(this.campaign?.requestKind || '').toLowerCase();
    const brandRole = String(this.brand?.role || '').toLowerCase();
    return ownerType === 'photographer' || requestKind === 'photographer_collaboration' || brandRole === 'photographer';
  }

  get counterReasonOptions(): string[] {
    if (this.isPhotographerCollabFlow) {
      return [
        'Travel effort',
        'Editing effort',
        'Equipment setup',
        'Long shoot duration',
        'Outdoor location effort',
        'Additional revisions',
      ];
    }
    if (this.campaignTypeKey === 'invite_location') {
      return [
        'Travel effort',
        'Event duration',
        'Equipment requirement',
        'Outdoor shoot effort',
        'Long shoot hours',
        'Editing effort',
        'Additional deliverables',
      ];
    }
    return [
      'Higher editing effort',
      'Long-form content',
      'Usage rights',
      'Tight deadline',
      'Additional revisions',
      'Audience reach',
      'Custom creative requirement',
    ];
  }

  get selectedCounterReason(): string {
    const reason = String(this.counterReasonInput || '').trim();
    return this.counterReasonOptions.includes(reason) ? reason : '';
  }

  get counterReasonText(): string {
    return String(this.invite?.counterOffer?.message || '').trim();
  }

  get counterHintText(): string {
    if (!this.hasValidCounterAmount) return '';
    return `Counter offer: ₹${Number(this.counterAmountInput || 0).toLocaleString('en-IN')}`;
  }

  private formatInr(value: number): string {
    const safe = Number(value || 0);
    if (!Number.isFinite(safe) || safe <= 0) return '₹0';
    return `₹${safe.toLocaleString('en-IN')}`;
  }


  get specialInstructions(): string {
    return (this.campaign?.specialInstructions || '').trim();
  }

  get minInfluencerTier(): string {
    return (this.campaign?.minInfluencerTier || '').trim();
  }

  get campaignAccessModeLabel(): string {
    return this.campaign?.campaignMode === 'tier_filtered_open' ? 'Open to all' : 'Invite only';
  }

  get campaignAccessDetailText(): string {
    const details: string[] = [];
    if (this.campaign?.campaignMode === 'tier_filtered_open') {
      if (this.minInfluencerTier) details.push(`Tier: ${this.minInfluencerTier}`);
      const location = [
        String(this.campaign?.targetDistrict || this.campaign?.venueDistrict || '').trim(),
        String(this.campaign?.targetState || this.campaign?.venueState || '').trim(),
      ].filter(Boolean).join(', ');
      if (location) details.push(`Location: ${location}`);
      const categories = Array.isArray(this.campaign?.categories)
        ? this.campaign.categories.map((item: any) => String(item || '').trim()).filter(Boolean)
        : [];
      if (categories.length) details.push(`Categories: ${categories.join(', ')}`);
    }
    return details.join(' | ');
  }

  get adminInviteProgress(): any[] {
    if (!this.adminReview) return [];
    const rows = this.campaign?.inviteProgress;
    return Array.isArray(rows) ? rows : [];
  }

  get hasAdminInviteProgress(): boolean {
    return this.adminInviteProgress.length > 0;
  }

  get filteredAdminInviteProgress(): any[] {
    if (this.adminInviteStatusFilter === 'all') return this.adminInviteProgress;
    if (this.adminInviteStatusFilter === 'actionable') {
      const actionable = new Set(['accepted', 'payment_confirmed', 'working', 'submitted']);
      return this.adminInviteProgress.filter((row) => actionable.has(this.adminInviteStatusKey(row?.status)));
    }
    return this.adminInviteProgress.filter(
      (row) => this.adminInviteStatusKey(row?.status) === this.adminInviteStatusFilter,
    );
  }

  get adminInviteProgressSummary(): Array<{ key: string; label: string; count: number }> {
    const counts = new Map<string, number>();
    for (const row of this.adminInviteProgress) {
      const key = this.adminInviteStatusKey(row?.status);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const order = [
      'pending',
      'invited',
      'accepted',
      'working',
      'submitted',
      'completed',
      'withdrawn',
      'declined',
      'rejected',
      'disputed',
      'payment_confirmed',
      'other',
    ];
    return order
      .filter((k) => counts.has(k))
      .map((key) => ({
        key,
        label: this.adminInviteStatusLabel(key),
        count: counts.get(key) || 0,
      }));
  }

  get adminInviteFilterOptions(): Array<{ key: string; label: string; count: number }> {
    const actionable = new Set(['accepted', 'payment_confirmed', 'working', 'submitted']);
    const actionableCount = this.adminInviteProgress.filter((row) =>
      actionable.has(this.adminInviteStatusKey(row?.status)),
    ).length;
    const options = [{ key: 'all', label: 'All', count: this.adminInviteProgress.length }];
    if (actionableCount > 0) {
      options.push({ key: 'actionable', label: 'Actionable', count: actionableCount });
    }
    options.push(...this.adminInviteProgressSummary);
    return options;
  }

  setAdminInviteStatusFilter(status: string): void {
    this.adminInviteStatusFilter = String(status || 'all').trim().toLowerCase() || 'all';
  }

  adminInviteStatusKey(status: unknown): string {
    const key = String(status || '').trim().toLowerCase();
    if (!key) return 'pending';
    return key;
  }

  adminInviteStatusLabel(status: unknown): string {
    const key = this.adminInviteStatusKey(status);
    const labels: Record<string, string> = {
      pending: 'Pending',
      invited: 'Invited',
      accepted: 'Working',
      payment_confirmed: 'Working',
      working: 'Working',
      submitted: 'Under Review',
      completed: 'Completed',
      approved: 'Payout Released',
      withdrawn: 'Withdrawn',
      declined: 'Declined',
      rejected: 'Rejected',
      disputed: 'Under Review',
      other: 'Other',
    };
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  adminInviteParticipantRoleLabel(role: unknown): string {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'photographer') return 'Photographer';
    return 'Influencer';
  }

  get checklistPlatformText(): string {
    const selected = this.selectedContentTypeOption;
    if (selected?.platform) return this.platformLabel(selected.platform);
    if (this.platforms.length > 0) return this.platformLabel(this.platforms[0].platform);
    return 'Not specified';
  }

  get checklistContentTypeText(): string {
    const selected = this.selectedContentTypeOption;
    if (selected?.contentType) return selected.contentType;
    if (this.selectableContentTypeOptions.length > 0) return 'Select one before accepting';
    return 'As discussed with brand';
  }

  get checklistSubmissionDeadlineText(): string {
    if (!this.maxPostDate) return 'Campaign timeline end';
    return new Date(this.maxPostDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  get hasChecklistLocationInfo(): boolean {
    return this.hasShootLocationDetails || this.hasVenueDetails || !!(this.campaign?.targetState || this.campaign?.targetDistrict);
  }

  get checklistLocationText(): string {
    if (this.hasShootLocationDetails) {
      const base = this.shootLocationTypeLabel || 'Shoot location';
      if (this.canRevealExactShootLocation) {
        const parts = [base, this.shootLocationAddress].filter(Boolean);
        return parts.join(' - ');
      }
      const area = this.venuePreviewText || [
        String(this.campaign?.targetDistrict || '').trim(),
        String(this.campaign?.targetState || '').trim(),
      ].filter(Boolean).join(', ');
      return area ? `${base} - ${area}` : base;
    }
    if (this.hasVenueDetails) {
      if (this.canRevealExactVenueDetails) {
        const venueParts = [this.venueName, this.venueAddress, this.venueCityState].filter(Boolean);
        return venueParts.join(' - ') || 'Venue details provided';
      }
      return this.venuePreviewText || 'Venue details unlock after payment confirmation';
    }
    const state = String(this.campaign?.targetState || '').trim();
    const district = String(this.campaign?.targetDistrict || '').trim();
    if (state || district) return [district, state].filter(Boolean).join(', ');
    return 'No fixed location (remote/online)';
  }

  get brandName(): string {
    return this.brand?.brandName || this.brand?.businessName || this.brand?.name || '';
  }
  get brandInitial(): string { return (this.brandName || '?')[0].toUpperCase(); }
  get brandLogo(): string | null {
    const b = this.brand;
    let url: string | null = null;
    if (Array.isArray(b?.brandLogo) && b.brandLogo.length) url = b.brandLogo[0]?.url || null;
    else if (typeof b?.brandLogo === 'string') url = b.brandLogo;
    url = url || b?.logoUrl || b?.profileImage || b?.logo || null;
    return this.normalizeImage(url);
  }
  get brandTagline(): string {
    const b = this.brand;
    if (b?.tagline) return b.tagline;
    if (Array.isArray(b?.categories) && b.categories.length) return b.categories.join(' · ');
    return '';
  }
  get brandLocation(): string {
    const loc = this.brand?.location;
    if (!loc) return '';
    if (loc.district && loc.state) return `${loc.district}, ${loc.state}`;
    return loc.state || loc.district || '';
  }
  get brandWebsite(): string { return this.brand?.website || ''; }
  get brandWebsiteHref(): string {
    const raw = String(this.brandWebsite || '').trim();
    if (!raw) return '';
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
    if (raw.startsWith('//')) return `https:${raw}`;
    return `https://${raw}`;
  }
  get brandProfileLink(): any[] | null {
    const slug = this.brand?.brandUsername || this.brand?.brandName;
    return slug ? ['/brand', slug] : null;
  }

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
  platformColor(p: string): string {
    const m: Record<string, string> = {
      instagram: '#c4377b',
      youtube: '#ff0033',
      twitter: '#1a1a1a',
      x: '#1a1a1a',
      tiktok: '#1a1a1a',
      facebook: '#1877f2',
      linkedin: '#0a66c2',
    };
    return m[(p || '').toLowerCase()] || '#444';
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

  onClose() { this.close.emit(); }

  private showToastError(msg: string) {
    this.toastError = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastError = ''; }, 4000);
  }

  onAccept() {
    if (!this.inviteId) return;
    if (this.showDateInput && !this.postDate) {
      this.showToastError(`Please select a ${this.dateContextNoun} date before accepting.`);
      return;
    }
    if (this.selectableContentTypeOptions.length && !this.selectedContentTypeKey) {
      this.showToastError('Please select a content type before accepting.');
      return;
    }
    if (this.selectedContentTypeKey && !this.selectedContentTypeOption) {
      this.showToastError(
        this.lockedPlatform
          ? `Please choose a content option only for ${this.platformLabel(this.lockedPlatform)}.`
          : 'Please select a valid content type.'
      );
      return;
    }
    if (this.needsPayoutDetails) {
      const upi = (this.payoutUpiId || '').trim();
      const mobile = (this.payoutMobile || '').trim();
      if (!upi && !mobile) {
        this.payoutEditing = true;
        this.showToastError('Please add a UPI ID or mobile number (GPay/PhonePe) to receive payment.');
        return;
      }
    }
    this.toastError = '';
    const [platform, contentType] = this.selectedContentTypeKey
      ? this.selectedContentTypeKey.split('::')
      : [undefined, undefined];
    const payout = this.needsPayoutDetails ? {
      upiId: (this.payoutUpiId || '').trim(),
      mobile: (this.payoutMobile || '').trim(),
      accountHolderName: (this.payoutName || '').trim(),
    } : undefined;
    this.accept.emit({
      inviteId: this.inviteId,
      postDate: this.postDate || undefined,
      platform,
      contentType,
      responseType: 'accept',
      payout,
    });
  }

  onToggleCounter() {
    this.counterEditing = !this.counterEditing;
    if (!this.counterEditing) {
      this.counterAmountInput = null;
      this.counterReasonInput = '';
    }
    this.toastError = '';
  }

  onSendCounter() {
    if (!this.inviteId) return;
    if (!this.canSendCounterOffer) {
      this.showToastError('Counter offer already used for this invite. You can accept or decline.');
      return;
    }
    if (this.showDateInput && !this.postDate) {
      this.showToastError(`Please select a ${this.dateContextNoun} date before sending a counter offer.`);
      return;
    }
    if (this.selectableContentTypeOptions.length && !this.selectedContentTypeKey) {
      this.showToastError('Please select a content type before sending a counter offer.');
      return;
    }
    if (this.selectedContentTypeKey && !this.selectedContentTypeOption) {
      this.showToastError(
        this.lockedPlatform
          ? `Please choose a content option only for ${this.platformLabel(this.lockedPlatform)}.`
          : 'Please select a valid content type.'
      );
      return;
    }
    if (!this.hasValidCounterAmount) {
      this.showToastError('Please enter a valid counter amount.');
      return;
    }
    this.toastError = '';
    const [platform, contentType] = this.selectedContentTypeKey
      ? this.selectedContentTypeKey.split('::')
      : [undefined, undefined];
    const payout = this.needsPayoutDetails ? {
      upiId: (this.payoutUpiId || '').trim(),
      mobile: (this.payoutMobile || '').trim(),
      accountHolderName: (this.payoutName || '').trim(),
    } : undefined;
    this.accept.emit({
      inviteId: this.inviteId,
      postDate: this.postDate || undefined,
      platform,
      contentType,
      responseType: 'counter',
      counterAmount: Number(this.counterAmountInput || 0),
      counterMessage: this.selectedCounterReason || undefined,
      payout,
    });
  }

  onDecline() {
    if (!this.inviteId) return;
    this.decline.emit({ inviteId: this.inviteId });
  }

  onAdminApprove() {
    this.approve.emit();
  }

  onAdminRequestChanges() {
    this.requestChanges.emit();
  }

  onAdminReject() {
    this.reject.emit();
  }

  onLogoError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

}
