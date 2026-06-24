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

  lastCopiedType: 'open' | 'invite' | null = null;

  get isOpenToAll(): boolean {
    return String(this.campaign?.campaignMode || '') === 'tier_filtered_open';
  }

  get campaignNameLabel(): string {
    return String(this.campaign?.title || this.campaign?.campaignTitle || '').trim() || 'Campaign';
  }

  get locationLabel(): string {
    const values = [
      this.campaign?.venueCity,
      this.campaign?.city,
      this.campaign?.targetDistrict,
      this.campaign?.district,
      this.campaign?.venueDistrict,
      this.campaign?.location?.city,
      this.campaign?.location?.district,
      this.campaign?.targetState,
      this.campaign?.location?.state,
      this.campaign?.venueState,
      this.campaign?.state,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    return values[0] || 'Not specified';
  }

  get lastDateLabel(): string {
    const raw = this.campaign?.acceptanceDeadline || this.campaign?.endDate || this.campaign?.timelineEnd;
    const date = raw ? new Date(raw) : null;
    if (!date || isNaN(date.getTime())) return 'Not specified';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  get openCampaignMessage(): string {
    return [
      '🎉 New Collaboration Opportunity on TrendStarz',
      '',
      `📢 Campaign: ${this.campaignNameLabel}`,
      '',
      `📍 Location: ${this.locationLabel}`,
      `📅 Apply Before: ${this.lastDateLabel}`,
      '',
      'We are looking for creators to participate in this campaign.',
      '',
      '✅ Apply directly through TrendStarz:',
      'https://www.trendstarz.in',
      '',
      'Login → Campaigns → Apply',
      '',
      'Only verified creators are eligible.',
      '',
      '#TrendStarz #CreatorCollaboration #InfluencerMarketing',
    ].join('\n');
  }

  get inviteOnlyMessage(): string {
    return [
      "🎉 You're Invited to a Collaboration Opportunity",
      '',
      `📢 Campaign: ${this.campaignNameLabel}`,
      '',
      'Your profile matches the campaign requirements and you have been shortlisted.',
      '',
      `📍 Location: ${this.locationLabel}`,
      `📅 Respond Before: ${this.lastDateLabel}`,
      '',
      'Please login to TrendStarz to view campaign details and accept your invitation.',
      '',
      'https://www.trendstarz.in',
      '',
      'Thank you,',
      'TrendStarz Team',
    ].join('\n');
  }

  copyOpenCampaignMessage() {
    this.lastCopiedType = 'open';
    this.copyAlert.emit(this.openCampaignMessage);
  }

  copyInviteOnlyMessage() {
    this.lastCopiedType = 'invite';
    this.copyAlert.emit(this.inviteOnlyMessage);
  }
}
