import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../shared/config.service';
import { environment } from '../../../environments/environment';
import { CampaignStatusBarComponent } from '../../shared/campaign-status-bar/campaign-status-bar.component';
import { AnalyticsService } from '../../core/analytics.service';
import { validateImageFile, compressImageFile, isOversizedAfterCompression, OVERSIZE_MESSAGE } from '../../shared/utils/image-upload.util';
import { ConfirmActionModalComponent } from '../../shared/components/confirm-action-modal/confirm-action-modal.component';

type PostType = 'reel' | 'video' | 'photo' | 'short' | 'story' | 'thread';

@Component({
  selector: 'app-campaign-submission',
  standalone: true,
  imports: [CommonModule, FormsModule, CampaignStatusBarComponent, ConfirmActionModalComponent],
  templateUrl: './campaign-submission.component.html',
  styleUrls: ['./campaign-submission.component.scss'],
})
export class CampaignSubmissionComponent implements OnInit, OnDestroy {
  inviteId = '';
  campaignId = '';
  campaignTitle = '';
  brandName = '';
  inviteStatus = '';

  postUrl = '';
  postType: PostType | '' = '';
  captionUsed = '';
  postScreenshotUrl = '';
  insightsScreenshotUrl = '';
  showStats = false;
  viewsCount: number | null = null;
  likesCount: number | null = null;
  commentsCount: number | null = null;
  sharesCount: number | null = null;
  reachCount: number | null = null;

  detectedPlatform = '';

  // All supported post types
  readonly allPostTypes: { key: PostType; label: string; platforms: string[] }[] = [
    { key: 'reel',   label: 'Reel',       platforms: ['instagram'] },
    { key: 'video',  label: 'Video',      platforms: ['youtube', 'facebook'] },
    { key: 'photo',  label: 'Post/Photo', platforms: ['instagram', 'facebook', 'twitter'] },
    { key: 'short',  label: 'Short',      platforms: ['youtube'] },
    { key: 'story',  label: 'Story',      platforms: ['instagram', 'facebook'] },
    { key: 'thread', label: 'Thread',     platforms: ['twitter'] },
  ];
  postTypes: { key: PostType; label: string; platforms: string[] }[] = [...this.allPostTypes];

  // Campaign platform info loaded from backend
  campaignType = '';
  campaignPlatforms: string[] = [];
  campaignSocialMedia: any[] = [];
  specialInstructions = '';
  acceptedPlatform = '';
  acceptedContentType = '';

  get isLocationCampaign(): boolean {
    return this.campaignType === 'invite_location';
  }

  private normalizeSubmissionStatus(rawStatus: string): string {
    const s = String(rawStatus || '').toLowerCase().trim();
    // For non-paid campaigns, acceptance maps directly to the Working stage.
    if (s === 'accepted' && this.campaignType !== 'paid_collab') {
      return 'payment_confirmed';
    }
    return s;
  }

  private resolveInviteDisplayStatus(invite: any): string {
    if (String(invite?.payoutStatus || '').toLowerCase() === 'paid') {
      return 'approved';
    }
    return this.normalizeSubmissionStatus(invite?.status || '');
  }

  screenshotUploading = false;
  insightsUploading = false;
  submitting = false;
  submitted = false;
  error = '';
  existingSubmission: any = null;
  submissionApprovalWaitHours = 24;
  submissionAutoCompleteGraceHours = 48;

  // Dispute response (Resubmit / Withdraw / Request Admin Review)
  disputeReportedAt: Date | null = null;
  disputeResolvedAt: Date | null = null;
  disputeAdminReviewRequestedAt: Date | null = null;
  // A plain "Report" (e.g. "not yet posted") — a note on top of the real status, not a
  // dispute. Distinct from the full Resubmit/Withdraw/Request-Admin-Review flow below,
  // which only applies once the invite is genuinely 'disputed'.
  reportedIssueReason = '';
  disputeResponseWaitHours = 12;
  disputeActionSubmitting = false;
  disputeActionError = '';
  showWithdrawConfirm = false;
  private disputeStatusInterval: any = null;

  // Insights timing lock
  selectedPostDate: Date | null = null;
  insightsUnlocksAt: Date | null = null;
  postingDeadlineMode: 'grace_24h' | 'strict' = 'grace_24h';
  insightsCountdown = '';
  startingWork = false;
  private countdownInterval: any = null;
  private reviewStatusInterval: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private config: ConfigService,
    private analytics: AnalyticsService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.inviteId = this.route.snapshot.paramMap.get('inviteId') || '';
    const nav = this.route.snapshot.queryParamMap;
    this.campaignTitle = nav.get('campaignTitle') || 'Campaign';
    this.brandName = nav.get('brandName') || '';
    this.inviteStatus = nav.get('inviteStatus') || 'working';

    this.config.getAppSettings().subscribe({
      next: (settings: any) => {
        const submissionHours = Number(settings?.submissionApprovalWaitHours);
        const autoCompleteHours = Number(settings?.submissionAutoCompleteGraceHours);
        const disputeHours = Number(settings?.disputeResponseWaitHours);
        this.submissionApprovalWaitHours = Number.isFinite(submissionHours) && submissionHours >= 0 ? submissionHours : 24;
        this.submissionAutoCompleteGraceHours = Number.isFinite(autoCompleteHours) && autoCompleteHours >= 0 ? autoCompleteHours : 48;
        this.disputeResponseWaitHours = Number.isFinite(disputeHours) && disputeHours >= 0 ? disputeHours : 12;
        this.cdr.markForCheck();
      },
      error: () => {
        this.submissionApprovalWaitHours = 24;
        this.submissionAutoCompleteGraceHours = 48;
      },
    });

    // Load invite + campaign info, then existing submission
    if (this.inviteId) {
      this.config.getInviteWithCampaign(this.inviteId).subscribe({
        next: (res: any) => {
          if (res?.invite?.selectedPostDate) {
            this.selectedPostDate = new Date(res.invite.selectedPostDate);
          }
          if (res?.invite?.insightsUnlocksAt) {
            this.insightsUnlocksAt = new Date(res.invite.insightsUnlocksAt);
            this.startCountdown();
          }
          const campaign = res?.campaign;
          this.campaignId = String(campaign?._id || campaign?.id || '');
          this.acceptedPlatform = String(res?.invite?.selectedPlatform || '').toLowerCase().trim();
          this.acceptedContentType = String(res?.invite?.selectedContentType || '').toLowerCase().trim();
          if (campaign) {
            this.campaignTitle = campaign.title || campaign.campaignTitle || this.campaignTitle;
            this.campaignType = campaign.campaignType || '';
            this.postingDeadlineMode = campaign.postingDeadlineMode === 'strict' ? 'strict' : 'grace_24h';
            // Sync real invite status from backend (overrides query param)
            // after campaign type is known so non-paid acceptance can be
            // represented as collaboration-confirmed on this page.
            if (res?.invite?.status || res?.invite?.payoutStatus) {
              this.inviteStatus = this.resolveInviteDisplayStatus(res.invite);
            }
            this.disputeReportedAt = res?.invite?.reportedIssue?.reportedAt
              ? new Date(res.invite.reportedIssue.reportedAt)
              : null;
            this.disputeResolvedAt = res?.invite?.reportedIssue?.resolvedAt
              ? new Date(res.invite.reportedIssue.resolvedAt)
              : null;
            this.disputeAdminReviewRequestedAt = res?.invite?.reportedIssue?.adminReviewRequestedAt
              ? new Date(res.invite.reportedIssue.adminReviewRequestedAt)
              : null;
            this.reportedIssueReason = String(res?.invite?.reportedIssue?.reason || '').trim();
            if (this.inviteStatus === 'disputed') this.startDisputeStatusTicker();
            // Collect platforms from socialMedia (enabled content types)
            this.campaignSocialMedia = campaign.socialMedia || [];
            this.campaignPlatforms = this.campaignSocialMedia
              .map((sm: any) => (sm.platform || '').toLowerCase())
              .filter(Boolean);
            if (!this.campaignPlatforms.length && campaign.platforms?.length) {
              this.campaignPlatforms = campaign.platforms.map((p: string) => p.toLowerCase());
            }
            this.specialInstructions = campaign.specialInstructions || '';
            // Filter post types to accepted invite selection first, fallback to campaign platforms.
            const acceptedTypeKey = this.mapContentTypeToPostType(this.acceptedContentType);
            if (this.acceptedPlatform && acceptedTypeKey) {
              this.postTypes = this.allPostTypes.filter(
                (pt) => pt.key === acceptedTypeKey && pt.platforms.includes(this.acceptedPlatform),
              );
              this.campaignPlatforms = [this.acceptedPlatform];
            } else if (this.acceptedPlatform) {
              this.postTypes = this.allPostTypes.filter((pt) => pt.platforms.includes(this.acceptedPlatform));
              this.campaignPlatforms = [this.acceptedPlatform];
            } else if (this.campaignPlatforms.length) {
              this.postTypes = this.allPostTypes.filter((pt) =>
                pt.platforms.some((p) => this.campaignPlatforms.includes(p)),
              );
            }
            if (!this.postTypes.length) this.postTypes = [...this.allPostTypes];
            if (this.postTypes.length === 1) this.postType = this.postTypes[0].key;
            this.tryStartWork();
            this.cdr.markForCheck();
          }
        },
        error: () => {}
      });

      this.config.getSubmissionByInvite(this.inviteId).subscribe({
        next: (res: any) => {
          if (res?.submission) {
            this.existingSubmission = res.submission;
            this.prefillFromSubmission(res.submission);
            this.startReviewStatusTicker();
          }
        },
        error: () => {}
      });
    }
  }

  prefillFromSubmission(s: any) {
    this.postUrl = s.postUrl || '';
    this.postType = s.postType || '';
    this.captionUsed = s.captionUsed || '';
    this.postScreenshotUrl = s.postScreenshotUrl || '';
    this.insightsScreenshotUrl = s.insightsScreenshotUrl || '';
    this.viewsCount = s.viewsCount ?? null;
    this.likesCount = s.likesCount ?? null;
    this.commentsCount = s.commentsCount ?? null;
    this.sharesCount = s.sharesCount ?? null;
    this.reachCount = s.reachCount ?? null;
    this.detectedPlatform = s.postPlatform || '';
    if (this.hasStatsDetails) this.showStats = true;
  }

  get hasSubmittedContent(): boolean {
    return this.hasPostDetails || this.hasProofDetails || this.hasStatsDetails;
  }

  get hasPostDetails(): boolean {
    return !!(this.postUrl || this.postType || this.captionUsed);
  }

  get hasProofDetails(): boolean {
    return !!(this.postScreenshotUrl || this.insightsScreenshotUrl);
  }

  get hasStatsDetails(): boolean {
    return [
      this.viewsCount,
      this.likesCount,
      this.commentsCount,
      this.sharesCount,
      this.reachCount,
    ].some((value) => value != null);
  }

  get selectedPostTypeLabel(): string {
    if (!this.postType) return '';
    return this.allPostTypes.find((item) => item.key === this.postType)?.label || this.postType;
  }

  resolveImageUrl(url: string): string {
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('/')) {
      return url;
    }
    return `/${url.replace(/^\/+/, '')}`;
  }

  onPostUrlChange() {
    this.detectedPlatform = this.detectPlatformFromUrl(this.postUrl);
  }

  platformIcon(): string {
    const p = this.detectedPlatform;
    if (p === 'instagram') return 'bi-instagram';
    if (p === 'youtube') return 'bi-youtube';
    if (p === 'twitter') return 'bi-twitter-x';
    if (p === 'tiktok') return 'bi-tiktok';
    if (p === 'facebook') return 'bi-facebook';
    return 'bi-link-45deg';
  }

  private mapContentTypeToPostType(contentType: string): PostType | '' {
    const normalized = String(contentType || '').toLowerCase().trim();
    if (!normalized) return '';
    if (normalized === 'reel' || normalized === 'reels') return 'reel';
    if (normalized === 'short' || normalized === 'shorts') return 'short';
    if (normalized === 'story' || normalized === 'stories') return 'story';
    if (normalized === 'post' || normalized === 'photo' || normalized === 'image') return 'photo';
    if (normalized === 'video') return 'video';
    if (normalized === 'thread' || normalized === 'tweet') return 'thread';
    return '';
  }

  private detectPlatformFromUrl(url: string): string {
    if (/instagram\.com/i.test(url)) return 'instagram';
    if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
    if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
    if (/tiktok\.com/i.test(url)) return 'tiktok';
    if (/facebook\.com/i.test(url)) return 'facebook';
    if (/linkedin\.com/i.test(url)) return 'linkedin';
    return 'other';
  }

  private normalizePlatformKey(platform: string): string {
    const p = String(platform || '').toLowerCase().trim();
    if (p === 'x') return 'twitter';
    return p;
  }

  formatSpecialInstructions(text: string): string {
    const raw = String(text || '').trim();
    if (!raw) return '';

    const headings = [
      'Dos:',
      "Don'ts:",
      'Must include:',
      'Must mention:',
      'Before the visit:',
      'During the visit:',
      'After the visit:',
      'Important Notes:',
    ];

    let formatted = raw;
    for (const heading of headings) {
      const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      formatted = formatted.replace(new RegExp(`\\s*${escaped}\\s*`, 'gi'), `\n${heading} `);
    }

    return formatted.replace(/\s*•\s*/g, '\n• ').trim();
  }

  async uploadImage(file: File, type: 'screenshot' | 'insights') {
    const validationError = validateImageFile(file);
    if (validationError) {
      this.error = validationError;
      return;
    }

    if (type === 'screenshot') this.screenshotUploading = true;
    else this.insightsUploading = true;

    try {
      let imageUrl = '';
      const compressedFile = await compressImageFile(file, 'screenshot');
      if (isOversizedAfterCompression(compressedFile)) {
        this.error = OVERSIZE_MESSAGE;
        return;
      }
      const fd = new FormData();
      fd.append('file', compressedFile);
      const res: any = await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/campaign-invites/${this.inviteId}/upload-image`, fd));
      imageUrl = res.data?.url || res.url;
      // Keep as relative path so Angular proxy serves it (avoids helmet CORP blocking)
      // Do NOT prepend http://localhost:3000 — the proxy handles /assets/local-images
      if (type === 'screenshot') {
        this.postScreenshotUrl = imageUrl;
      } else {
        this.insightsScreenshotUrl = imageUrl;
      }
    } catch (e) {
      this.error = 'Image upload failed. Please try again.';
    } finally {
      if (type === 'screenshot') this.screenshotUploading = false;
      else this.insightsUploading = false;
      this.cdr.markForCheck();
    }
  }

  onScreenshotChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.uploadImage(input.files[0], 'screenshot');
  }

  onInsightsChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.uploadImage(input.files[0], 'insights');
  }

  /** True only while the influencer still has an unused resubmission and hasn't asked for admin review. */
  get canResubmitDispute(): boolean {
    return this.inviteStatus === 'disputed'
      && !(this.existingSubmission?.resubmissionCount)
      && !this.disputeAdminReviewRequestedAt;
  }

  /** A plain report (e.g. "not yet posted") — informational only, no countdown/actions. */
  get hasOpenReportOnly(): boolean {
    return !!this.disputeReportedAt && !this.disputeResolvedAt && this.inviteStatus !== 'disputed';
  }

  get isReadOnly(): boolean {
    return ['submitted', 'completed', 'approved', 'disputed'].includes(this.inviteStatus) && !this.canResubmitDispute;
  }

  get isAwaitingPaymentConfirmation(): boolean {
    return this.campaignType === 'paid_collab' && this.inviteStatus === 'accepted';
  }

  get isCollaborationConfirmedReady(): boolean {
    return this.inviteStatus === 'payment_confirmed';
  }

  // Backward-compatible alias used by older template diagnostics/cache.
  get isCollaborationConfirmedWaitingStart(): boolean {
    return this.isCollaborationConfirmedReady;
  }

  get canEditSubmissionForm(): boolean {
    return !this.isReadOnly && (this.inviteStatus === 'payment_confirmed' || this.inviteStatus === 'working' || this.canResubmitDispute);
  }

  /** Deadline for the influencer to respond to an open dispute (Resubmit/Withdraw/Request Review). */
  get disputeRespondByAt(): Date | null {
    if (!this.disputeReportedAt) return null;
    return new Date(this.disputeReportedAt.getTime() + this.disputeResponseWaitHours * 60 * 60 * 1000);
  }

  /** "11h 34m"-style countdown to the auto-cancel deadline. */
  get disputeCountdownText(): string {
    const respondBy = this.disputeRespondByAt;
    if (!respondBy) return 'unavailable';
    return this.formatRemainingMs(respondBy.getTime() - Date.now());
  }

  private tryStartWork() {
    if (!this.inviteId || this.startingWork) return;
    if (this.inviteStatus !== 'payment_confirmed') return;

    this.startingWork = true;
    this.config.startInviteWork(this.inviteId).subscribe({
      next: (res: any) => {
        const rawStatus = String(res?.invite?.status || '').trim();
        this.inviteStatus = rawStatus ? this.normalizeSubmissionStatus(rawStatus) : 'working';
        this.cdr.markForCheck();
      },
      error: () => {
        this.startingWork = false;
      },
      complete: () => {
        this.startingWork = false;
      }
    });
  }

  get inviteStatusLabel(): string {
    const map: Record<string, string> = {
      accepted:          'Working',
      payment_confirmed: 'Confirmed — Start Work',
      working:           'Working',
      submitted:         'Submitted',
      completed:         'Post Approved',
      approved:          'Payout Released',
      disputed:          'Under Review',
    };
    const base = map[this.inviteStatus] || this.inviteStatus;
    if (this.inviteStatus === 'submitted' && this.existingSubmission?.isLate) {
      const days = this.existingSubmission.daysLate;
      return `Submitted Late (${days} day${days === 1 ? '' : 's'})`;
    }
    return base;
  }

  /** True while the post is submitted and still inside the 24h host-review window. */
  get isInAutoCompleteReviewPeriod(): boolean {
    if (this.inviteStatus !== 'submitted') return false;
    const unlockAt = this.submissionReviewUnlockAt;
    return !!unlockAt && Date.now() < unlockAt.getTime();
  }

  /** "23h 34m"-style countdown to when the 24h review window unlocks / auto-completes. */
  get submissionAutoCompleteCountdownText(): string {
    const unlockAt = this.submissionReviewUnlockAt;
    if (!unlockAt) return 'unavailable';
    return this.formatRemainingMs(unlockAt.getTime() - Date.now());
  }

  get inviteStageKey(): string {
    const normalized = String(this.inviteStatus || '').toLowerCase().trim();
    const stageMap: Record<string, string> = {
      pending: 'working',
      accepted: 'working',
      payment_confirmed: 'working',
      working: 'working',
      submitted: 'under_review',
      disputed: 'under_review',
      completed: 'completed',
      approved: 'payout_released',
    };
    return stageMap[normalized] || 'working';
  }

  get inviteStageIconClass(): string {
    const iconMap: Record<string, string> = {
      working: 'bi-play-circle-fill',
      submitted: 'bi-send-check-fill',
      under_review: 'bi-hourglass-split',
      completed: 'bi-check-circle-fill',
      payout_released: 'bi-cash-coin',
    };
    return iconMap[this.inviteStageKey] || 'bi-play-circle-fill';
  }

  get readOnlyStatusMessage(): string {
    if (this.inviteStatus === 'submitted') {
      return this.submissionReviewStatusMessage;
    }
    if (this.inviteStatus === 'completed') {
      return 'Your post was approved. Payout is pending for release.';
    }
    if (this.inviteStatus === 'approved') {
      return 'Payout has been released. Your submission is locked and cannot be edited.';
    }
    if (this.inviteStatus === 'disputed') {
      // isReadOnly is only true for 'disputed' once it's escalated to admin — either the
      // influencer explicitly asked for review, or the one allowed resubmission was also disputed.
      if (this.disputeAdminReviewRequestedAt) {
        return 'This dispute has been escalated to our support team for review. We\'ll update you once it\'s resolved.';
      }
      return 'The host raised a further issue after your resubmission. This is now with our support team for a final decision.';
    }
    return `This campaign has been ${this.inviteStatus}. Your submission is locked and cannot be edited.`;
  }

  get submissionPostedAt(): Date | null {
    const candidates = [
      this.existingSubmission?.submittedAt,
      this.existingSubmission?.createdAt,
      this.existingSubmission?.updatedAt,
    ];
    for (const value of candidates) {
      if (!value) continue;
      const dt = new Date(value);
      if (!Number.isNaN(dt.getTime())) return dt;
    }
    return null;
  }

  get submissionPostedAtText(): string {
    return this.formatDateTime(this.submissionPostedAt) || 'posted time unavailable';
  }

  get submissionReviewUnlockAt(): Date | null {
    const postedAt = this.submissionPostedAt;
    if (!postedAt) return null;
    return new Date(postedAt.getTime() + this.submissionApprovalWaitHours * 60 * 60 * 1000);
  }

  get submissionAutoCompleteAt(): Date | null {
    const unlockAt = this.submissionReviewUnlockAt;
    if (!unlockAt) return null;
    return new Date(unlockAt.getTime() + this.submissionAutoCompleteGraceHours * 60 * 60 * 1000);
  }

  /** Mirrors the backend's computeGraceDeadline exactly — pure duration arithmetic, no calendar/timezone math. */
  private get postingStrictDeadline(): Date | null {
    if (!this.selectedPostDate) return null;
    return new Date(this.selectedPostDate.getTime() + 24 * 60 * 60 * 1000);
  }

  get postingSubmissionClosesAt(): Date | null {
    const strict = this.postingStrictDeadline;
    if (!strict) return null;
    return this.postingDeadlineMode === 'strict' ? strict : new Date(strict.getTime() + 24 * 60 * 60 * 1000);
  }

  /** True once the selected posting date has passed but submission is still open (grace window). */
  get isPastPostingDateButStillOpen(): boolean {
    if (this.existingSubmission || !['payment_confirmed', 'working'].includes(this.inviteStatus)) return false;
    const strict = this.postingStrictDeadline;
    const closesAt = this.postingSubmissionClosesAt;
    if (!strict || !closesAt) return false;
    const now = Date.now();
    return now > strict.getTime() && now <= closesAt.getTime();
  }

  get postingDeadlineWarningText(): string {
    const closesAt = this.postingSubmissionClosesAt;
    const closesAtText = this.formatDateTime(closesAt) || 'the deadline';
    return `Your selected posting date has passed. You can still submit until ${closesAtText}. Late submissions may be rejected by the host.`;
  }

  /** Mirrors the backend's submitPost deadline check exactly (campaign-invites.service.ts) — if
   *  there's no selectedPostDate there's no deadline; otherwise submission closes at closesAt. */
  get isSubmissionWindowClosed(): boolean {
    const closesAt = this.postingSubmissionClosesAt;
    if (!closesAt) return false;
    return Date.now() > closesAt.getTime();
  }

  get submissionWindowClosedText(): string {
    const closesAtText = this.formatDateTime(this.postingSubmissionClosesAt) || 'the deadline';
    return `Submission window closed on ${closesAtText}. You can no longer submit for this collaboration.`;
  }

  get submissionReviewStatusMessage(): string {
    const unlockAt = this.submissionReviewUnlockAt;
    if (!unlockAt) {
      return 'Your post is submitted and now under review. Your submission is locked and cannot be edited.';
    }
    const waitText = this.formatRemainingMs(unlockAt.getTime() - Date.now());
    const autoText = this.formatDateTime(this.submissionAutoCompleteAt) || 'auto-complete time unavailable';
    if (waitText === 'now') {
      return `Posted on ${this.submissionPostedAtText}. Host review is open. If the host does not mark completed or raise an issue, this will auto-complete at ${autoText}.`;
    }
    return `Posted on ${this.submissionPostedAtText}. Host can mark completed or raise an issue in ${waitText}. If no response, this will auto-complete at ${autoText}.`;
  }

  private formatDateTime(value: Date | null): string {
    if (!value) return '';
    return value.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  private formatRemainingMs(ms: number): string {
    if (ms <= 0) return 'now';
    const totalMinutes = Math.max(1, Math.floor(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  canSubmit(): boolean {
    if (!this.canEditSubmissionForm) return false;
    if (this.isSubmissionWindowClosed) return false;
    // Location campaigns: postUrl still required, screenshot is optional
    if (this.isLocationCampaign) return !!this.postUrl.trim();
    // Paid/product campaigns: postUrl required; screenshot strongly recommended but optional
    return !!this.postUrl.trim();
  }

  submit() {
    if (this.submitting) return;

    if (!this.canSubmit()) {
      if (this.isReadOnly) {
        this.error = 'Submission is locked after posting and cannot be edited.';
      } else if (this.isCollaborationConfirmedReady) {
        this.error = 'You are in the Working stage. Add your post URL to submit your work.';
      } else if (this.isAwaitingPaymentConfirmation) {
        this.error = 'Payment verification is still in progress. You can start work once the status moves to Working.';
      } else {
        this.error = 'Post URL is required.';
      }
      return;
    }
    this.submitting = true;
    this.error = '';

    const payload: any = {
      postUrl: this.postUrl.trim(),
    };
    if (this.postScreenshotUrl) payload.postScreenshotUrl = this.postScreenshotUrl;

    const submittedPlatform = this.normalizePlatformKey(this.detectPlatformFromUrl(payload.postUrl));
    const acceptedPlatform = this.normalizePlatformKey(this.acceptedPlatform);
    if (acceptedPlatform && submittedPlatform !== 'other' && submittedPlatform !== acceptedPlatform) {
      this.error = `Please submit a ${this.acceptedPlatform} URL as per your accepted platform.`;
      this.submitting = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.postType) payload.postType = this.postType;
    if (this.captionUsed) payload.captionUsed = this.captionUsed;
    // Only include insights data once the 24h window has passed
    if (!this.insightsLocked) {
      if (this.insightsScreenshotUrl) payload.insightsScreenshotUrl = this.insightsScreenshotUrl;
      if (this.viewsCount != null) payload.viewsCount = this.viewsCount;
      if (this.likesCount != null) payload.likesCount = this.likesCount;
      if (this.commentsCount != null) payload.commentsCount = this.commentsCount;
      if (this.sharesCount != null) payload.sharesCount = this.sharesCount;
      if (this.reachCount != null) payload.reachCount = this.reachCount;
    }

    this.config.submitCampaignPost(this.inviteId, payload).subscribe({
      next: () => {
        const campaignId = String(this.campaignId || this.route.snapshot.queryParamMap.get('campaignId') || this.existingSubmission?.campaignId || '');
        if (campaignId) {
          this.analytics.trackCampaignCompleted({
            campaignId,
            creatorCount: 1,
            completionStage: 'content_delivered',
            inviteId: this.inviteId,
          });
        }
        this.submitted = true;
        this.submitting = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Submission failed. Please try again.';
        this.submitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  goBack() {
    this.router.navigate(['/influencer-dashboard']);
  }

  ngOnDestroy() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.reviewStatusInterval) clearInterval(this.reviewStatusInterval);
    if (this.disputeStatusInterval) clearInterval(this.disputeStatusInterval);
  }

  private startReviewStatusTicker() {
    if (this.reviewStatusInterval) return;
    this.reviewStatusInterval = setInterval(() => {
      if (this.inviteStatus !== 'submitted') {
        clearInterval(this.reviewStatusInterval);
        this.reviewStatusInterval = null;
        return;
      }
      this.cdr.markForCheck();
    }, 60000);
  }

  private startDisputeStatusTicker() {
    if (this.disputeStatusInterval) return;
    this.disputeStatusInterval = setInterval(() => {
      if (this.inviteStatus !== 'disputed') {
        clearInterval(this.disputeStatusInterval);
        this.disputeStatusInterval = null;
        return;
      }
      this.cdr.markForCheck();
    }, 60000);
  }

  scrollToResubmitForm(): void {
    document.getElementById('resubmit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  openWithdrawConfirm(): void {
    this.showWithdrawConfirm = true;
  }

  closeWithdrawConfirm(): void {
    if (this.disputeActionSubmitting) return;
    this.showWithdrawConfirm = false;
  }

  confirmWithdrawFromDispute(): void {
    if (this.disputeActionSubmitting) return;
    this.disputeActionSubmitting = true;
    this.disputeActionError = '';
    this.config.withdrawFromDispute(this.inviteId).subscribe({
      next: () => {
        this.disputeActionSubmitting = false;
        this.showWithdrawConfirm = false;
        this.inviteStatus = 'withdrawn';
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.disputeActionSubmitting = false;
        this.disputeActionError = err?.error?.message || 'Failed to withdraw. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  requestAdminReviewForDispute(): void {
    if (this.disputeActionSubmitting) return;
    this.disputeActionSubmitting = true;
    this.disputeActionError = '';
    this.config.requestAdminReviewForDispute(this.inviteId).subscribe({
      next: () => {
        this.disputeActionSubmitting = false;
        this.disputeAdminReviewRequestedAt = new Date();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.disputeActionSubmitting = false;
        this.disputeActionError = err?.error?.message || 'Failed to request admin review. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  // Returns true when insights (screenshot + metrics) are still locked
  get insightsLocked(): boolean {
    if (!this.insightsUnlocksAt) return false;
    return Date.now() < this.insightsUnlocksAt.getTime();
  }

  private startCountdown() {
    this.updateCountdown();
    this.countdownInterval = setInterval(() => {
      this.updateCountdown();
      if (!this.insightsLocked) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
      this.cdr.markForCheck();
    }, 60000); // refresh every minute
  }

  private updateCountdown() {
    if (!this.insightsUnlocksAt) { this.insightsCountdown = ''; return; }
    const diffMs = this.insightsUnlocksAt.getTime() - Date.now();
    if (diffMs <= 0) { this.insightsCountdown = ''; return; }
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    this.insightsCountdown = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}
