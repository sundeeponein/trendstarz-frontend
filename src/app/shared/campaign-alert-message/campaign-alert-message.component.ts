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
  reminderMessageExpanded = false;
  approvedMessageExpanded = false;

  get ownerApprovedWhatsAppLink(): string | null {
    return buildWhatsAppLink(this.ownerPhone, this.ownerApprovedMessage);
  }

  get relevantWhatsAppLink(): string | null {
    return buildWhatsAppLink(this.ownerPhone, this.relevantMessage);
  }

  get postingReminderWhatsAppLink(): string | null {
    return buildWhatsAppLink(this.ownerPhone, this.postingReminderMessage);
  }

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
