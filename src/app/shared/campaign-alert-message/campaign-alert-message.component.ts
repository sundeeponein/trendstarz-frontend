import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-campaign-alert-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './campaign-alert-message.component.html',
  styleUrls: ['./campaign-alert-message.component.scss'],
})
export class CampaignAlertMessageComponent {
  @Input() campaign: any | null = null;
  @Input() copied = false;
  @Output() copyAlert = new EventEmitter<string>();

  get isOpenToAll(): boolean {
    return String(this.campaign?.campaignMode || '') === 'tier_filtered_open';
  }

  get accessLabel(): string {
    return this.isOpenToAll ? 'Open To All Creators' : 'Invite Only Campaign';
  }

  get shouldPostToCommunity(): boolean {
    return this.isOpenToAll;
  }

  get whatsappAlertLabel(): string {
    return this.isOpenToAll ? 'WhatsApp Community Alert' : 'WhatsApp Direct / Individual Alert';
  }

  get whatsappHelpText(): string {
    return this.isOpenToAll
      ? 'Open to all campaigns can be shared with the WhatsApp community.'
      : 'Invite-only campaigns should be copied to selected users directly by admin/support.';
  }

  get alertMessage(): string {
    return [
      '🚀 New Campaign Available',
      '',
      `Requirement Type: ${this.requirementType}`,
      '',
      `Location: ${this.locationLabel}`,
      `Category: ${this.categoryLabel}`,
      '',
      `Eligible: ${this.eligibleLabel}`,
      '',
      this.accessLabel,
      '',
      'Login to TrendStarz to View Details & Apply',
      '',
      'www.trendstarz.in',
    ].join('\n');
  }

  get requirementType(): string {
    const value = String(
      this.campaign?.campaignType ||
        this.campaign?.requestKind ||
        this.campaign?.type ||
        '',
    ).toLowerCase();
    if (value.includes('product')) return 'Product Collab';
    if (value.includes('event')) return 'Event Invite';
    if (value.includes('store') || value.includes('visit')) return 'Store Visit';
    if (value.includes('collab') || value.includes('paid') || value.includes('campaign')) return 'Paid Collab';
    return 'Paid Collab';
  }

  get locationLabel(): string {
    const values = [
      this.campaign?.venueCity,
      this.campaign?.city,
      this.campaign?.district,
      this.campaign?.venueDistrict,
      this.campaign?.location?.city,
      this.campaign?.location?.district,
      this.campaign?.location?.state,
      this.campaign?.venueState,
      this.campaign?.state,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    return values[0] || 'Online';
  }

  get categoryLabel(): string {
    return this.firstReadable([
      this.campaign?.category,
      this.campaign?.categories,
      this.campaign?.targetCategories,
      this.campaign?.brand?.categories,
    ], 'Lifestyle');
  }

  get eligibleLabel(): string {
    return this.firstReadable([
      this.campaign?.eligibleTiers,
      this.campaign?.targetTiers,
      this.campaign?.creatorTiers,
      this.campaign?.minInfluencerTier,
      this.campaign?.minimumTier,
    ], 'Nano | Starter | Rising | Professional');
  }

  onCopy() {
    this.copyAlert.emit(this.alertMessage);
  }

  private firstReadable(values: unknown[], fallback: string): string {
    for (const value of values) {
      const readable = this.readableValue(value);
      if (readable) return readable;
    }
    return fallback;
  }

  private readableValue(value: unknown): string {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.readableValue(item))
        .filter(Boolean)
        .join(' | ');
    }
    if (value && typeof value === 'object') {
      const record = value as any;
      return String(record.label || record.name || record.title || record.value || '').trim();
    }
    return String(value || '').trim();
  }
}
