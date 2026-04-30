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

  postDate = '';
  selectedContentTypeKey = '';

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
  get statusLabel(): string {
    const s = this.status;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  get statusBadgeClass(): string {
    switch (this.status) {
      case 'accepted': return 'bg-success';
      case 'declined': return 'bg-secondary';
      case 'completed': return 'bg-purple text-white';
      case 'pending':
      case 'invited':
      default: return 'bg-info text-dark';
    }
  }

  get campaignTitle(): string { return this.campaign?.title || this.campaign?.campaignTitle || 'Campaign'; }
  get categories(): string[] {
    const c = this.campaign?.categories;
    return Array.isArray(c) ? c : [];
  }

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
    const c = this.campaign;
    if (Array.isArray(c?.platforms) && c.platforms.length) return c.platforms.join(', ');
    if (Array.isArray(c?.socialMedia) && c.socialMedia.length) {
      return c.socialMedia.map((sm: any) => this.platformLabel(sm.platform || '')).filter(Boolean).join(', ');
    }
    return '';
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

  get briefPreview(): string {
    const text = this.specialInstructions;
    if (!text) return '';
    return text.length > 140 ? `${text.slice(0, 140)}...` : text;
  }

  get brandName(): string {
    return this.brand?.brandName || this.brand?.businessName || this.brand?.name || 'Brand';
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
    if (this.contentTypeOptions.length && !this.selectedContentTypeKey) {
      this.validationError.emit('Please select what you will create.');
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
  }
}
