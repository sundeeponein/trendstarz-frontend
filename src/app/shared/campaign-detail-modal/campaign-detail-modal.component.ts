import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule, DecimalPipe, FormsModule, RouterModule],
  templateUrl: './campaign-detail-modal.component.html',
  styleUrls: ['./campaign-detail-modal.component.scss']
})
export class CampaignDetailModalComponent {
  @Input() invite: any;
  @Input() visible = false;
  // Optional: platform/tier that the current influencer qualifies with for this campaign
  @Input() qualifyingPlatform?: string | null;
  @Input() qualifyingTier?: string | null;
  @Input() showDateInput = true;
  @Input() busy = false;
  @Input() set initialPostDate(v: string | undefined) {
    if (v) this.postDate = v;
  }
  @Input() set initialContentTypeKey(v: string | undefined) {
    if (v) this.selectedContentTypeKey = v;
  }

  @Output() close = new EventEmitter<void>();
  @Output() accept = new EventEmitter<CampaignAcceptPayload>();
  @Output() decline = new EventEmitter<CampaignDeclinePayload>();
  @Output() validationError = new EventEmitter<string>();

  postDate = '';
  selectedContentTypeKey = '';
  toastError = '';
  private toastTimer: any;

  private get campaign(): any {
    return this.invite?.campaign || this.invite?.campaignId || {};
  }
  private get brand(): any {
    return this.invite?.brand || this.invite?.brandId || {};
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
  get campaignStatus(): string { return (this.campaign?.status || '').toLowerCase(); }

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
  get hasVenueDetails(): boolean {
    return !!(this.venueName || this.venueAddress || this.venueCity || this.venueDistrict || this.venueState || this.venueMapUrl);
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
      for (const row of sm) {
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

  get platforms(): { platform: string }[] {
    const c = this.campaign;
    if (Array.isArray(c?.socialMedia) && c.socialMedia.length) {
      return c.socialMedia.map((sm: any) => ({ platform: sm.platform || '' }));
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

  get selectedContentTypeOption(): ContentTypeOption | undefined {
    if (!this.selectedContentTypeKey) return undefined;
    return this.contentTypeOptions.find((opt) => opt.key === this.selectedContentTypeKey);
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

  get checklistPlatformText(): string {
    const selected = this.selectedContentTypeOption;
    if (selected?.platform) return this.platformLabel(selected.platform);
    if (this.platforms.length > 0) return this.platformLabel(this.platforms[0].platform);
    return 'Not specified';
  }

  get checklistContentTypeText(): string {
    const selected = this.selectedContentTypeOption;
    if (selected?.contentType) return selected.contentType;
    if (this.contentTypeOptions.length > 0) return 'Select one before accepting';
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
    if (this.contentTypeOptions.length && !this.selectedContentTypeKey) {
      this.showToastError('Please select a content type before accepting.');
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

  onLogoError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
