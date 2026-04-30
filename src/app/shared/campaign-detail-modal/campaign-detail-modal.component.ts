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

  get campaignTypeLabel(): string {
    const m: Record<string, string> = {
      paid_collab: 'Paid Collab',
      product: 'Product / Barter',
      invite_location: 'Invite to Location',
      pay_to_join: 'Pay to Join',
    };
    const t = (this.campaign?.campaignType || '').toLowerCase();
    return m[t] || '';
  }

  get hasBudget(): boolean {
    const c = this.campaign;
    return !!(c?.budgetMin || c?.budgetMax || c?.budget);
  }
  get budgetText(): string {
    const c = this.campaign;
    const min = Number(c?.budgetMin ?? c?.budget ?? 0);
    const max = Number(c?.budgetMax ?? c?.budget ?? min);
    if (!min && !max) return '—';
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

  get deliverables(): string[] {
    const d = this.campaign?.deliverables;
    return Array.isArray(d) ? d : [];
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

  onAccept() {
    if (!this.inviteId) return;
    if (this.showDateInput && !this.postDate) {
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
