import { AfterViewChecked, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { SessionService } from '../../core/session.service';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { UserAvatarComponent } from '../components/user-avatar/user-avatar.component';
import { OfferTrailComponent } from '../offer-trail/offer-trail.component';
import { buildAdminOfferTrailText, buildAdminOfferTotalText } from '../offer-trail.util';
import { CampaignAlertMessageComponent } from '../campaign-alert-message/campaign-alert-message.component';
import { campaignIdLabel, copyTextToClipboard } from '../referral-link.util';
import { TrackingLinksApiService, TrackingLink } from '../tracking-links/tracking-links-api.service';
import { PromoLinkCardComponent } from '../promo-link-card/promo-link-card.component';

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
  imports: [CommonModule, DecimalPipe, FormsModule, RouterModule, UserAvatarComponent, OfferTrailComponent, CampaignAlertMessageComponent, PromoLinkCardComponent],
  templateUrl: './campaign-detail-modal.component.html',
  styleUrls: ['./campaign-detail-modal.component.scss']
})
export class CampaignDetailModalComponent implements OnChanges, AfterViewChecked {
  @ViewChild('workflowTrack') private workflowTrackRef?: ElementRef<HTMLElement>;
  private _workflowScrolled = false;

  @Input() invite: any;
  @Input() visible = false;
  // Optional: platform/tier that the current influencer qualifies with for this campaign
  @Input() qualifyingPlatform?: string | null;
  @Input() qualifyingPlatforms?: string[] | null;
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
  @Output() forceComplete = new EventEmitter<string>();
  @Output() cancelParticipation = new EventEmitter<string>();
  @Output() validationError = new EventEmitter<string>();
  @Output() viewSubmission = new EventEmitter<void>();
  @Output() confirmReceipt = new EventEmitter<void>();

  // Emergency admin overrides — collapsed by default; both require a reason.
  showEmergencyAdminPanel = false;
  emergencyActionReason = '';

  // Ready-to-share WhatsApp message preview (visible before and after approval).
  alertMessageCopied = false;
  payoutMessageCopiedInviteId = '';
  payoutMessagePreviewItem: any = null;
  private alertMessageCopiedTimer: any;
  private payoutMessageCopiedTimer: any;

  copyAdminAlertMessage(message: string): void {
    const text = String(message || '').trim();
    if (!text) return;
    const done = () => {
      this.alertMessageCopied = true;
      this.cdr.detectChanges();
      clearTimeout(this.alertMessageCopiedTimer);
      this.alertMessageCopiedTimer = setTimeout(() => {
        this.alertMessageCopied = false;
        this.cdr.detectChanges();
      }, 2500);
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this.fallbackCopyAlertMessage(text, done));
      return;
    }
    this.fallbackCopyAlertMessage(text, done);
  }

  copyPaymentReleaseMessage(item: any): void {
    const text = this.paymentReleaseMessage(item);
    if (!text) return;
    const inviteId = String(item?.inviteId || item?._id || '');
    const done = () => {
      this.payoutMessageCopiedInviteId = inviteId;
      this.cdr.detectChanges();
      clearTimeout(this.payoutMessageCopiedTimer);
      this.payoutMessageCopiedTimer = setTimeout(() => {
        this.payoutMessageCopiedInviteId = '';
        this.cdr.detectChanges();
      }, 2500);
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this.fallbackCopyAlertMessage(text, done));
      return;
    }
    this.fallbackCopyAlertMessage(text, done);
  }

  openPaymentReleaseMessage(item: any, ev?: Event): void {
    ev?.stopPropagation();
    this.payoutMessagePreviewItem = item || null;
    this.cdr.detectChanges();
  }

  closePaymentReleaseMessage(): void {
    this.payoutMessagePreviewItem = null;
    this.cdr.detectChanges();
  }

  paymentReleaseMessage(item: any): string {
    const amount = this.adminInvitePayoutAmountText(item);
    const campaignName = this.campaignTitle;
    return [
      `Your payment of ${amount} for the "${campaignName}" campaign has been released successfully.`,
      '',
      `${this.adminInviteHostPaymentRefLabel(item)}: ${this.adminInviteHostPaymentRef(item)}`,
      `${this.adminInvitePayoutRefLabel(item)}: ${this.adminInvitePayoutTransactionId(item)}`,
      '',
      'Thank you for collaborating with TrendStarz!',
    ].join('\n');
  }

  private fallbackCopyAlertMessage(text: string, done: () => void): void {
    if (typeof document === 'undefined') return;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    done();
  }

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

  constructor(
    private cdr: ChangeDetectorRef,
    private session: SessionService,
    private trackingLinksApi: TrackingLinksApiService,
  ) {}

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
      this._workflowScrolled = false;
      this.cdr.detectChanges();
    }
  }

  ngAfterViewChecked(): void {
    if (!this._workflowScrolled && this.visible) {
      this._centerActiveWorkflowStep();
    }
  }

  private _centerActiveWorkflowStep(): void {
    const track = this.workflowTrackRef?.nativeElement;
    if (!track) return;
    const active = track.querySelector('.cdm-workflow__step--current') as HTMLElement | null;
    if (!active) return;
    const scrollLeft = active.offsetLeft - track.offsetWidth / 2 + active.offsetWidth / 2;
    track.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    this._workflowScrolled = true;
  }

  get campaign(): any {
    return this.invite?.campaign || this.invite?.campaignId || {};
  }
  private get brand(): any {
    return this.invite?.brand || this.invite?.brandId || {};
  }

  private static readonly PROMOTION_URL_TYPE_LABELS: Record<string, string> = {
    website: 'Website',
    app_store: 'App Store',
    play_store: 'Play Store',
    instagram: 'Instagram Profile',
    facebook: 'Facebook Page',
    youtube: 'YouTube Channel',
    whatsapp: 'WhatsApp Link',
    other: 'Link',
  };

  get resourcePromotionUrl(): string { return String(this.campaign?.promotionUrl || '').trim(); }
  get resourcePromotionUrlTypeLabel(): string {
    const type = String(this.campaign?.promotionUrlType || '').trim().toLowerCase();
    return CampaignDetailModalComponent.PROMOTION_URL_TYPE_LABELS[type] || 'Link';
  }
  get resourceSuggestedCaption(): string { return String(this.campaign?.suggestedCaption || '').trim(); }
  get resourceHashtags(): string { return String(this.campaign?.hashtags || '').trim(); }
  get resourceImages(): { url: string; public_id: string }[] {
    return Array.isArray(this.campaign?.resourceImages) ? this.campaign.resourceImages : [];
  }
  get hasCampaignResources(): boolean {
    return !!(
      this.resourcePromotionUrl ||
      this.resourceSuggestedCaption ||
      this.resourceHashtags ||
      this.resourceImages.length
    );
  }

  resourceCaptionCopied = false;
  resourceHashtagsCopied = false;
  private resourceCopyTimer: any;

  copyResourceCaption(): void { this.copyResourceText(this.resourceSuggestedCaption, 'caption'); }
  copyResourceHashtags(): void { this.copyResourceText(this.resourceHashtags, 'hashtags'); }

  private copyResourceText(text: string, kind: 'caption' | 'hashtags'): void {
    if (!text) return;
    copyTextToClipboard(text);
    this.resourceCaptionCopied = kind === 'caption';
    this.resourceHashtagsCopied = kind === 'hashtags';
    this.cdr.detectChanges();
    clearTimeout(this.resourceCopyTimer);
    this.resourceCopyTimer = setTimeout(() => {
      this.resourceCaptionCopied = false;
      this.resourceHashtagsCopied = false;
      this.cdr.detectChanges();
    }, 2000);
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

  private static readonly ACCEPTED_OR_LATER_STATUSES = ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved'];

  get isAcceptedOrLater(): boolean {
    return CampaignDetailModalComponent.ACCEPTED_OR_LATER_STATUSES.includes(this.statusKey);
  }

  private trackedLinkCache = new Map<string, TrackingLink>();
  private trackedLinkFetching = new Set<string>();

  private trackedLinkFor(inviteId: string): TrackingLink | null {
    if (!inviteId) return null;
    const cached = this.trackedLinkCache.get(inviteId);
    if (cached) return cached;

    if (!this.trackedLinkFetching.has(inviteId)) {
      this.trackedLinkFetching.add(inviteId);
      this.trackingLinksApi.getOrCreateTrackingLink(inviteId).subscribe({
        next: (res) => {
          this.trackedLinkCache.set(inviteId, res);
          this.trackedLinkFetching.delete(inviteId);
          this.cdr.detectChanges();
        },
        error: () => this.trackedLinkFetching.delete(inviteId),
      });
    }
    return null;
  }

  /** Tracked promo link, unique to the signed-in creator viewing their own invite. */
  get generatedPromotionLink(): string {
    if (!this.resourcePromotionUrl) return '';
    return this.trackedLinkFor(String(this.invite?._id || ''))?.url || '';
  }

  /** Tracked promo link for a specific creator, used in the admin roster table. */
  adminInviteTaggedPromotionLink(item: any): string {
    if (!this.resourcePromotionUrl) return '';
    return this.trackedLinkFor(String(item?.inviteId || ''))?.url || '';
  }

  /** Click count for the admin roster's compact tracking-link display. */
  adminInviteTrackedLinkClicks(item: any): number {
    return this.trackedLinkFor(String(item?.inviteId || ''))?.clickCount ?? 0;
  }

  adminInviteShowsPromotionLink(item: any): boolean {
    return !!this.resourcePromotionUrl
      && CampaignDetailModalComponent.ACCEPTED_OR_LATER_STATUSES.includes(this.adminInviteStatusKey(item?.status));
  }

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

  get campaignIdLabel(): string {
    return campaignIdLabel(this.campaign);
  }

  get payoutTypeTags(): string[] {
    const tags: string[] = [];
    if (this.campaignTypeLabel) tags.push(this.campaignTypeLabel);
    const term = String(this.campaign?.paymentTerm || '').trim();
    if (term) tags.push(term);
    else if (this.isPaidCollab || this.isInviteLocation) tags.push('Net-30');
    return tags;
  }

  get activeDurationDays(): number {
    const c = this.campaign;
    const start = c?.timelineStart || c?.startDate;
    const end = c?.timelineEnd || c?.endDate;
    if (!start || !end) return 0;
    return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  }

  get primaryPlatform(): string {
    return this.allCampaignPlatforms[0]?.platform || '';
  }

  get primaryContentTypeLabel(): string {
    const sm = this.campaign?.socialMedia;
    if (!Array.isArray(sm)) return '';
    for (const row of sm) {
      for (const ct of row?.contentTypes || []) {
        if (ct?.enabled) return ct.name || '';
      }
    }
    return '';
  }

  get canRevealBrandContact(): boolean {
    return ['payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed'].includes(this.statusKey);
  }

  get brandEmail(): string {
    return String(this.brand?.email || this.brand?.contactEmail || this.campaign?.brandContactEmail || '').trim();
  }

  get brandPhone(): string {
    const b = this.brand;
    return String(
      b?.phoneNumber || b?.mobile || b?.contactMobile || b?.phone || b?.contactPhone || this.campaign?.brandContactPhone || ''
    ).trim();
  }

  get brandResponseRate(): string {
    const rate = Number(this.brand?.responseRate || 0);
    if (!rate) return '';
    if (rate >= 90) return `Very High (${rate}%)`;
    if (rate >= 70) return `High (${rate}%)`;
    if (rate >= 50) return `Medium (${rate}%)`;
    return `Low (${rate}%)`;
  }

  get showViewSubmission(): boolean {
    return ['submitted', 'completed', 'approved'].includes(this.statusKey);
  }

  get showConfirmReceipt(): boolean {
    return this.isProduct && this.statusKey === 'working';
  }

  get showPayoutPendingInfo(): boolean {
    return this.statusKey === 'approved' || this.statusKey === 'completed';
  }

  get venueImageUrl(): string {
    return String(this.campaign?.venuePhoto || this.campaign?.venueImage || this.campaignImageUrl || '').trim();
  }

  get venueLocationLabel(): string {
    return this.venueCityState || this.venueDistrictState || '';
  }

  /** True when the influencer actually sent a counter offer (price was negotiated) */
  get hasCounterOfferFlow(): boolean {
    const status = String(this.invite?.counterOffer?.status || '').toLowerCase();
    return status === 'sent' || status === 'brand_sent' || status === 'accepted'
      || Number(this.invite?.counterOffer?.requestedAmount || 0) > 0
      || Number(this.invite?.counterOffer?.offeredAmount || 0) > 0;
  }

  private buildInviteContext(): any {
    return {
      ...this.invite,
      campaign: this.campaign,
      campaignAmountPaise: Number(
        this.invite?.campaignAmountPaise || this.campaign?.pricePerInfluencer || this.campaign?.amount || 0,
      ),
    };
  }

  get userNegotiationTrailText(): string {
    if (this.adminReview || !this.hasCounterOfferFlow) return '';
    return buildAdminOfferTrailText(this.buildInviteContext());
  }

  get userNegotiationTotalText(): string {
    if (this.adminReview || !this.hasCounterOfferFlow) return '';
    const t = buildAdminOfferTotalText(this.buildInviteContext());
    return t.startsWith('No price change') ? '' : t;
  }

  get deliverableRows(): Array<{ platform: string; contentType: string; price: number }> {
    const sm = this.campaign?.socialMedia;
    if (!Array.isArray(sm)) return [];
    const rows: Array<{ platform: string; contentType: string; price: number }> = [];
    for (const row of sm) {
      for (const ct of row?.contentTypes || []) {
        if (ct?.enabled) {
          rows.push({ platform: row.platform || '', contentType: ct.name || '', price: Number(ct.price) || 0 });
        }
      }
    }
    return rows;
  }
  get campaignDescription(): string { return this.campaign?.description || ''; }
  /** Description cleaned of literal "undefined" / empty strings, formatted for display */
  get campaignDescriptionSafe(): string {
    const raw = String(this.campaignDescription || '').trim();
    if (!raw || raw === 'undefined' || raw === 'null') return '';
    return this.campaignDescriptionFormatted;
  }
  get campaignDescriptionFormatted(): string {
    return this.formatBriefText(this.campaignDescription);
  }

  get campaignScript(): string { return this.campaign?.script || ''; }
  /** Script cleaned of literal "undefined" / empty strings, formatted for display */
  get campaignScriptSafe(): string {
    const raw = String(this.campaignScript || '').trim();
    if (!raw || raw === 'undefined' || raw === 'null') return '';
    return this.campaignScriptFormatted;
  }
  get campaignScriptFormatted(): string {
    return this.formatBriefText(this.campaignScript);
  }

  /** Only creators (influencer/photographer) see the "adapt to your own style" tip — not the brand previewing their own campaign. */
  get isCreatorViewer(): boolean {
    const role = String(this.session.getUser()?.role || '').toLowerCase();
    return role.includes('influencer') || role.includes('photographer');
  }

  private formatBriefText(value: string): string {
    const raw = String(value || '').trim();
    if (!raw || raw === 'undefined' || raw === 'null') return '';
    const headings = '(What we expect:|Content Guidelines:|Deliverables:|Timeline:|Payment:|Important Notes:)';
    return raw
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(new RegExp(`([^\\n])\\s*${headings}`, 'gi'), '$1\n$2')
      .replace(/([^\n])\s*•\s*/g, '$1\n• ')
      .replace(/(^|\n)\s*•\s*/g, '$1• ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  get campaignStatus(): string { return (this.campaign?.status || '').toLowerCase(); }

  /** "Completion Status" shown to admin in place of the old Mark Complete button — completion is the host's call (or the auto-complete cron / an emergency override), never a direct admin click. */
  get completionStatusLabel(): string {
    const status = this.campaignStatus;
    if (status === 'completed') {
      const by = String(this.campaign?.completedBy || '').toLowerCase();
      if (by === 'auto') return 'Auto Completed';
      if (by === 'admin') return 'Completed (Admin Override)';
      return 'Completed by Host';
    }
    if (status === 'cancelled') return 'Cancelled (Admin Override)';
    if (status === 'active') return 'Waiting for Host Review';
    return '';
  }

  get completionStatusClass(): string {
    const status = this.campaignStatus;
    if (status === 'completed') return 'is-completed';
    if (status === 'cancelled') return 'is-cancelled';
    return 'is-waiting';
  }

  /** Emergency overrides only make sense on a live campaign — not draft/pending/already-closed ones. */
  get canShowEmergencyAdminAction(): boolean {
    return this.adminReview && this.campaignStatus === 'active';
  }

  get isEmergencyReasonValid(): boolean {
    return this.emergencyActionReason.trim().length >= 10;
  }

  toggleEmergencyAdminPanel(): void {
    this.showEmergencyAdminPanel = !this.showEmergencyAdminPanel;
  }

  closeEmergencyAdminPanel(): void {
    this.showEmergencyAdminPanel = false;
    this.emergencyActionReason = '';
  }

  onForceComplete(): void {
    if (!this.isEmergencyReasonValid) return;
    this.forceComplete.emit(this.emergencyActionReason.trim());
    this.emergencyActionReason = '';
    this.showEmergencyAdminPanel = false;
  }

  onCancelParticipation(): void {
    if (!this.isEmergencyReasonValid) return;
    this.cancelParticipation.emit(this.emergencyActionReason.trim());
    this.emergencyActionReason = '';
    this.showEmergencyAdminPanel = false;
  }

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
    if (this.isPending && (this.isTierFilteredCampaign || this.hasMultiplePlatformChoices)) return '';
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

  /** Campaign platforms that have at least one enabled content type (for YOU MATCH section) */
  get campaignPlatformsWithDeliverables(): { platform: string }[] {
    const withCt = new Set(this.contentTypeOptions.map(opt => this.normalized(opt.platform)));
    if (!withCt.size) return this.allCampaignPlatforms; // fallback: show all if no ct data
    return this.allCampaignPlatforms.filter(p => withCt.has(this.normalized(p.platform)));
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

  private get isTierFilteredCampaign(): boolean {
    const campaignMode = String(this.campaign?.campaignMode || '').toLowerCase();
    return campaignMode === 'tier_filtered_open'
      || (campaignMode !== 'invite_only' && !!String(this.campaign?.minInfluencerTier || '').trim());
  }

  private get qualifyingPlatformKeySet(): Set<string> {
    const set = new Set<string>();
    if (!this.isTierFilteredCampaign) return set;
    if (this.qualifyingPlatform) set.add(this.normalized(this.qualifyingPlatform));
    for (const p of this.qualifyingPlatforms || []) {
      if (p) set.add(this.normalized(p));
    }
    return set;
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
    return this.formatBriefText(this.campaign?.specialInstructions || '');
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

  get campaignWorkflowSteps(): Array<{ label: string; doneLabel?: string; done: boolean; current: boolean }> {
    const status = String(this.campaign?.status || '').toLowerCase();
    const statuses = this.adminInviteProgress.map((r: any) => String(r?.status || '').toLowerCase());
    const isActive = ['active', 'completed'].includes(status);
    const isDone = status === 'completed';
    const hasAccepted = statuses.some((s: string) => ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved'].includes(s));
    const hasPaymentConfirmed = statuses.some((s: string) => ['payment_confirmed', 'working', 'submitted', 'completed', 'approved'].includes(s));
    const hasWorking = statuses.some((s: string) => ['working', 'submitted', 'completed', 'approved'].includes(s));
    const hasSubmitted = statuses.some((s: string) => ['submitted', 'approved'].includes(s));
    return [
      { label: 'Created', done: true, current: false },
      { label: 'Awaiting Admin Approval', doneLabel: 'Admin Approved', done: isActive, current: !isDone && !isActive },
      { label: 'Awaiting Acceptance', doneLabel: 'Accepted', done: hasAccepted, current: !isDone && isActive && !hasAccepted },
      { label: 'Awaiting Payment', doneLabel: 'Payment Confirmed', done: hasPaymentConfirmed, current: !isDone && hasAccepted && !hasPaymentConfirmed },
      { label: 'Awaiting Work', doneLabel: 'Working', done: hasWorking, current: !isDone && hasPaymentConfirmed && !hasWorking },
      { label: 'Awaiting Submission', doneLabel: 'Submitted', done: hasSubmitted, current: !isDone && hasWorking && !hasSubmitted },
      { label: 'Awaiting Completion', doneLabel: 'Completed', done: isDone, current: !isDone && hasSubmitted },
    ];
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
      payment_confirmed: 'Confirmed — Start Work',
      working: 'Working',
      submitted: 'Submitted',
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
    if (this.platforms.length > 1) {
      return this.platforms.map(p => this.platformLabel(p.platform)).join(', ');
    }
    if (this.platforms.length === 1) return this.platformLabel(this.platforms[0].platform);
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

  onViewSubmission() { this.viewSubmission.emit(); }
  onConfirmReceipt() { this.confirmReceipt.emit(); }

  adminInviteOfferTrailText(item: any): string {
    return buildAdminOfferTrailText({
      ...item,
      campaign: this.campaign,
      campaignAmountPaise: Number(
        item?.campaignAmountPaise || this.campaign?.pricePerInfluencer || this.campaign?.amount || 0,
      ),
    });
  }

  adminInviteOfferTotalText(item: any): string {
    return buildAdminOfferTotalText({
      ...item,
      campaign: this.campaign,
      campaignAmountPaise: Number(
        item?.campaignAmountPaise || this.campaign?.pricePerInfluencer || this.campaign?.amount || 0,
      ),
    });
  }

  adminInviteWorkingFromDate(item: any): string {
    const status = String(item?.status || '').toLowerCase();
    const isWorkConfirmed = ['payment_confirmed', 'working', 'submitted', 'approved', 'completed', 'disputed'].includes(status);
    const d = item?.paymentConfirmedAt
      || (status === 'payment_confirmed' ? item?.updatedAt : null)
      || (isWorkConfirmed ? item?.acceptedAt : null);
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  adminInviteAcceptedAtText(item: any): string {
    const d = item?.acceptedAt;
    if (!d) return '';
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  adminInviteAcceptedDeliverableText(item: any): string {
    const platform = this.platformLabel(String(item?.selectedPlatform || ''));
    const contentType = String(item?.selectedContentType || '').trim();
    if (!platform && !contentType) return '';

    const amountPaise = Number(item?.agreedAmountPaise || 0);
    const amountRupees = amountPaise > 0 ? amountPaise / 100 : Number(item?.agreedAmount || 0);
    const parts = [platform, contentType].filter(Boolean);
    if (amountRupees > 0) {
      parts.push(`₹${amountRupees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
    }
    return parts.join(' · ');
  }

  adminInviteUpdatedAtText(item: any): string {
    const d = item?.updatedAt || item?.acceptedAt || item?.createdAt;
    if (!d) return '';
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  adminInviteSubmittedAtText(item: any): string {
    const d = item?.submittedAt;
    if (!d) return '';
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  adminInvitePostApprovedAtText(item: any): string {
    const d = item?.postApprovedAt;
    if (!d) return '';
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  adminInvitePayoutDateText(item: any): string {
    const d = item?.payoutDate;
    if (!d) return '';
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  adminInvitePayoutAmountText(item: any): string {
    const paise = Number(
      item?.payoutAmountPaise
        || item?.agreedAmountPaise
        || item?.campaignAmountPaise
        || item?.counterOfferedAmountPaise
        || item?.counterRequestedAmountPaise
        || 0,
    );
    if (paise > 0) {
      const rupees = paise / 100;
      return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    }

    const rupees = Number(
      item?.agreedAmount
        || item?.counterOfferedAmount
        || item?.counterRequestedAmount
        || 0,
    );
    if (rupees > 0) {
      return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    }
    return '₹0';
  }

  adminInvitePayoutTransactionId(item: any): string {
    const payoutGateway = String(item?.payoutGatewayProvider || 'manual_upi').toLowerCase();
    if (payoutGateway === 'razorpayx') {
      return String(item?.payoutUtr || item?.payoutTransferId || item?.transactionId || 'Not recorded').trim() || 'Not recorded';
    }
    return String(item?.payoutUtr || item?.payoutTransferId || item?.transactionId || 'Not recorded').trim() || 'Not recorded';
  }

  adminInviteHostPaymentRefLabel(item: any): string {
    return String(item?.paymentGateway || '').toLowerCase() === 'razorpay'
      ? 'Host paid Razorpay ref'
      : 'Host paid UTR';
  }

  adminInviteHostPaymentRef(item: any): string {
    if (String(item?.paymentGateway || '').toLowerCase() === 'razorpay') {
      return String(
        item?.hostPaymentGatewayPaymentId
          || item?.gatewayPaymentId
          || item?.hostPaymentGatewayOrderId
          || item?.gatewayOrderId
          || 'Not recorded',
      ).trim() || 'Not recorded';
    }
    return String(item?.hostPaymentUtr || item?.utrNumber || 'Not recorded').trim() || 'Not recorded';
  }

  adminInvitePayoutRefLabel(item: any): string {
    return String(item?.payoutGatewayProvider || 'manual_upi').toLowerCase() === 'razorpayx'
      ? 'Admin to user Razorpay ref'
      : 'Admin to user payout UTR';
  }

  adminInvitePayoutStatusLabel(item: any): string {
    const status = String(item?.payoutStatus || '').toLowerCase();
    if (status === 'paid') return 'Paid';
    if (status === 'processing') return 'Payout processing';
    if (status === 'frozen') return 'Payout frozen (dispute)';
    if (status === 'skipped') return 'Payout skipped';
    if (status === 'pending') return 'Payout pending';
    return '';
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
