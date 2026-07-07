import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { copyTextToClipboard } from '../referral-link.util';
import { normalizeTierLabel, TIER_DESC_MAP } from '../tiers.constants';

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

  /** Mirrors campaign-detail-modal's ACCEPTED_OR_LATER_STATUSES — anyone who accepted, regardless of pipeline stage since. */
  private static readonly ACCEPTED_OR_LATER_STATUSES = ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved'];

  get requiredCreatorsCount(): number {
    return Number(this.campaign?.maxInfluencers || this.campaign?.inviteSlots || 0) || 0;
  }

  get acceptedCreatorsCount(): number {
    const rows = Array.isArray(this.campaign?.inviteProgress) ? this.campaign.inviteProgress : [];
    return rows.filter((row: any) =>
      CampaignAlertMessageComponent.ACCEPTED_OR_LATER_STATUSES.includes(String(row?.status || '').toLowerCase()),
    ).length;
  }

  get slotsRemainingCount(): number {
    return Math.max(this.requiredCreatorsCount - this.acceptedCreatorsCount, 0);
  }

  /** Open-to-all campaigns can restrict who's eligible to apply by a minimum tier. Empty when no tier restriction is set. */
  get minTierLabel(): string {
    const raw = String(this.campaign?.minInfluencerTier || '').trim();
    if (!raw) return '';
    const normalized = normalizeTierLabel(raw);
    const range = TIER_DESC_MAP[normalized.toLowerCase()] || '';
    return range ? `${normalized} (${range} followers)` : normalized;
  }

  /** The two message templates are independent accordions within the body. */
  inviteMessageExpanded = false;
  reminderMessageExpanded = false;

  get isOpenToAll(): boolean {
    return String(this.campaign?.campaignMode || '') === 'tier_filtered_open';
  }

  /** Once active/completed, this is the message that actually went out; before that, it's just a preview of what will be sent. */
  get isApprovedStatus(): boolean {
    return ['active', 'completed'].includes(String(this.campaign?.status || '').toLowerCase());
  }

  get statusHeaderText(): string {
    return this.isApprovedStatus ? 'Campaign Status: Approved ✅' : 'Campaign Status: Pending Review';
  }

  get shareHelpText(): string {
    return this.isApprovedStatus
      ? 'Share the right WhatsApp message with creators below.'
      : 'Preview only — these messages become ready to share once this campaign is approved.';
  }

  get shareSectionTitle(): string {
    return this.isApprovedStatus ? 'Ready to Share' : 'Preview — Ready to Share Once Approved';
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

  get startDateLabel(): string {
    const raw = this.campaign?.timelineStart || this.campaign?.startDate;
    const date = raw ? new Date(raw) : null;
    if (!date || isNaN(date.getTime())) return 'Not specified';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  get endDateLabel(): string {
    const raw = this.campaign?.timelineEnd || this.campaign?.endDate;
    const date = raw ? new Date(raw) : null;
    if (!date || isNaN(date.getTime())) return 'Not specified';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  get openCampaignMessage(): string {
    const tierLine = this.minTierLabel ? [`🏆 Minimum Tier: ${this.minTierLabel}`] : [];
    return [
      '🎉 New Collaboration Opportunity on TrendStarz',
      '',
      `📢 Campaign: ${this.campaignNameLabel}`,
      '',
      `📍 Location: ${this.locationLabel}`,
      `📅 Apply Before: ${this.lastDateLabel}`,
      '',
      ...tierLine,
      `👥 Required Creators: ${this.requiredCreatorsCount}`,
      `✅ Accepted: ${this.acceptedCreatorsCount}`,
      `🔥 Slots Remaining: ${this.slotsRemainingCount}`,
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
      "🎉 You've received a new collaboration invitation on TrendStarz",
      '',
      `📢 Campaign: ${this.campaignNameLabel}`,
      '',
      'Your profile matches the campaign requirements and you have been shortlisted.',
      '',
      `📍 Location: ${this.locationLabel}`,
      `📅 Respond Before: ${this.lastDateLabel}`,
      '',
      `👥 Required Creators: ${this.requiredCreatorsCount}`,
      `✅ Accepted: ${this.acceptedCreatorsCount}`,
      `🔥 Slots Remaining: ${this.slotsRemainingCount}`,
      '',
      'Please login to TrendStarz to view campaign details and accept your invitation.',
      '',
      'https://www.trendstarz.in',
      '',
      'Thank you,',
      'TrendStarz Team',
    ].join('\n');
  }

  /** Only the message matching this campaign's actual access mode is shown — never both at once. */
  get relevantMessage(): string {
    return this.isOpenToAll ? this.openCampaignMessage : this.inviteOnlyMessage;
  }

  get relevantMessageLabel(): string {
    return this.isOpenToAll ? 'Open Campaign Message' : 'Invite Only Message';
  }

  get relevantCopyButtonLabel(): string {
    return this.isOpenToAll ? 'Copy Open Campaign Message' : 'Copy Invite Only Message';
  }

  copyRelevantMessage() {
    this.copyAlert.emit(this.relevantMessage);
  }

  /** Applies to both invite-only and open-to-all campaigns alike — it's a posting-window nudge, not an invitation. */
  get postingReminderMessage(): string {
    return [
      '📅 Reminder: Your TrendStarz campaign',
      '',
      'Hi,',
      '',
      'Your collaboration is scheduled to begin.',
      '',
      `Campaign: ${this.campaignNameLabel}`,
      `📆 Posting Window: ${this.startDateLabel} – ${this.endDateLabel}`,
      '',
      `👥 Required Creators: ${this.requiredCreatorsCount}`,
      `✅ Accepted: ${this.acceptedCreatorsCount}`,
      `🔥 Slots Remaining: ${this.slotsRemainingCount}`,
      '',
      'Please review the campaign resources, caption, hashtags, and promotion link before posting.',
      '',
      'Login to TrendStarz:',
      'https://www.trendstarz.in',
      '',
      'Thank you,',
      'TrendStarz Team',
    ].join('\n');
  }

  reminderCopied = false;
  private reminderCopiedTimer: any;

  copyReminderMessage(): void {
    copyTextToClipboard(this.postingReminderMessage);
    this.reminderCopied = true;
    clearTimeout(this.reminderCopiedTimer);
    this.reminderCopiedTimer = setTimeout(() => (this.reminderCopied = false), 2500);
  }
}
