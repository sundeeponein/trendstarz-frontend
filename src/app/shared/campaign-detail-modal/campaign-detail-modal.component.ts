import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { UserAvatarComponent } from '../components/user-avatar/user-avatar.component';

export interface CampaignAcceptPayload {
  inviteId: string;
  postDate?: string;
  platform?: string;
  contentType?: string;
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
  imports: [CommonModule, DecimalPipe, FormsModule, RouterModule, UserAvatarComponent],
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

  @Output() close = new EventEmitter<void>();
  @Output() accept = new EventEmitter<CampaignAcceptPayload>();
  @Output() decline = new EventEmitter<CampaignDeclinePayload>();
  @Output() approve = new EventEmitter<void>();
  @Output() requestChanges = new EventEmitter<void>();
  @Output() reject = new EventEmitter<void>();
  @Output() validationError = new EventEmitter<string>();

  postDate = '';
  selectedContentTypeKey = '';
  adminInviteStatusFilter = 'all';
  toastError = '';
  private toastTimer: any;
  // Previously used to delay pointer-events; removed now that modal mounts immediately.

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['invite'] || changes['adminInviteProgressLoading'] || changes['visible']) {
      this.cdr.detectChanges();
    }
  }

  private get campaign(): any {
    return this.invite?.campaign || this.invite?.campaignId || {};
  }
  private get brand(): any {
    return this.invite?.brand || this.invite?.brandId || {};
  }

  get campaignImageUrl(): string {
    return this.campaign?.image?.url || '';
  }

  onCampaignImgError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  get inviteId(): string { return this.invite?._id || ''; }

  get isPending(): boolean { return this.invite?.status === 'pending'; }
  get statusKey(): string { return (this.invite?.status || 'pending').toLowerCase(); }

  get statusFooterLabel(): string {
    const s = this.invite?.status;
    if (!s || s === 'pending') return 'Pending Approval';
    return s.charAt(0).toUpperCase() + s.slice(1);
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
      product: 'Product / Barter',
      invite_location: 'Invite to Location',
      pay_to_join: 'Pay to Join',
    };
    return m[this.campaignTypeKey] || '';
  }

  get isInviteLocation(): boolean { return this.campaignTypeKey === 'invite_location'; }
  get isPayToJoin(): boolean { return this.campaignTypeKey === 'pay_to_join'; }
  get isProduct(): boolean { return this.campaignTypeKey === 'product'; }
  get isPaidCollab(): boolean { return this.campaignTypeKey === 'paid_collab'; }

  get isUnlocked(): boolean { return !!this.invite?.unlocked; }

  private get isLocationPaymentConfirmed(): boolean {
    return ['payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed'].includes(this.statusKey);
  }

  get canRevealExactVenueDetails(): boolean {
    return this.isUnlocked && this.isLocationPaymentConfirmed;
  }

  get canRevealExactShootLocation(): boolean {
    return this.isUnlocked && this.isLocationPaymentConfirmed;
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
    return this.lockedPlatform || this.qualifyingPlatformKeySet.size
      ? this.selectableContentTypeOptions
      : this.contentTypeOptions;
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

  get specialInstructions(): string {
    return (this.campaign?.specialInstructions || '').trim();
  }

  get minInfluencerTier(): string {
    return (this.campaign?.minInfluencerTier || '').trim();
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
      accepted: 'Accepted',
      payment_confirmed: 'Payment Confirmed',
      working: 'Working',
      submitted: 'Submitted',
      completed: 'Completed',
      withdrawn: 'Withdrawn',
      declined: 'Declined',
      rejected: 'Rejected',
      disputed: 'Disputed',
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
      this.showToastError('Please select a posting date before accepting.');
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
    this.toastError = '';
    const [platform, contentType] = this.selectedContentTypeKey
      ? this.selectedContentTypeKey.split('::')
      : [undefined, undefined];
    this.accept.emit({
      inviteId: this.inviteId,
      postDate: this.postDate || undefined,
      platform,
      contentType,
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
