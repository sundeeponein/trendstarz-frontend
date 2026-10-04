import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { copyTextToClipboard } from '../referral-link.util';
import { buildWhatsAppLink } from '../whatsapp-messages.util';

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

  /**
   * Rendered server-side (GET /admin/campaigns/:id/share-messages) so this
   * text can never drift from what the automated WhatsApp send uses — see
   * trendstarz-backend/src/campaigns/campaign-alert-messages.ts.
   */
  @Input() openCampaignMessage = '';
  @Input() inviteOnlyMessage = '';
  @Input() postingReminderMessage = '';
  @Input() ownerApprovedMessage = '';
  @Input() ownerPhone = '';
  @Input() messagesLoading = false;

  /** The message templates are independent accordions within the body. */
  inviteMessageExpanded = false;
  openMessageExpanded = false;
  reminderMessageExpanded = false;
  approvedMessageExpanded = false;

  /** Mirrors CampaignDetailModalComponent.ACCEPTED_OR_LATER_STATUSES — a creator in any of these has accepted to work. */
  private static readonly ACCEPTED_OR_LATER_STATUSES = ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved'];

  get ownerApprovedWhatsAppLink(): string | null {
    return buildWhatsAppLink(this.ownerPhone, this.ownerApprovedMessage);
  }

  get inviteOnlyWhatsAppLink(): string | null {
    return buildWhatsAppLink(this.ownerPhone, this.inviteOnlyMessage);
  }

  get openCampaignWhatsAppLink(): string | null {
    return buildWhatsAppLink(this.ownerPhone, this.openCampaignMessage);
  }

  get postingReminderWhatsAppLink(): string | null {
    return buildWhatsAppLink(this.ownerPhone, this.postingReminderMessage);
  }

  get isOpenToAll(): boolean {
    return String(this.campaign?.campaignMode || '') === 'tier_filtered_open';
  }

  private get inviteProgress(): any[] {
    return Array.isArray(this.campaign?.inviteProgress) ? this.campaign.inviteProgress : [];
  }

  /** At least one creator has been sent an invite/selected by the host. */
  get hasSelectedInvite(): boolean {
    return this.inviteProgress.length > 0;
  }

  /** At least one creator has accepted and moved past the invite stage (accepted to work). */
  get hasAcceptedInvite(): boolean {
    return this.inviteProgress.some((row) =>
      CampaignAlertMessageComponent.ACCEPTED_OR_LATER_STATUSES.includes(String(row?.status || '').toLowerCase())
    );
  }

  get isActiveCampaign(): boolean {
    return String(this.campaign?.status || '').toLowerCase() === 'active';
  }

  /** Only relevant once the campaign is active and someone has actually accepted to work. */
  get showPostingReminder(): boolean {
    return this.isActiveCampaign && this.hasAcceptedInvite;
  }

  /** Only relevant for invite-only campaigns once the host has selected/invited creators. */
  get showInviteOnlyMessage(): boolean {
    return !this.isOpenToAll && this.hasSelectedInvite;
  }

  get showOpenToAllMessage(): boolean {
    return this.isOpenToAll;
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

  copyInviteOnlyMessage() {
    this.copyAlert.emit(this.inviteOnlyMessage);
  }

  copyOpenCampaignMessage() {
    this.copyAlert.emit(this.openCampaignMessage);
  }

  reminderCopied = false;
  private reminderCopiedTimer: any;

  copyReminderMessage(): void {
    copyTextToClipboard(this.postingReminderMessage);
    this.reminderCopied = true;
    clearTimeout(this.reminderCopiedTimer);
    this.reminderCopiedTimer = setTimeout(() => (this.reminderCopied = false), 2500);
  }

  approvedMessageCopied = false;
  private approvedMessageCopiedTimer: any;

  copyOwnerApprovedMessage(): void {
    copyTextToClipboard(this.ownerApprovedMessage);
    this.approvedMessageCopied = true;
    clearTimeout(this.approvedMessageCopiedTimer);
    this.approvedMessageCopiedTimer = setTimeout(() => (this.approvedMessageCopied = false), 2500);
  }
}
