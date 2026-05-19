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

type PostType = 'reel' | 'video' | 'photo' | 'short' | 'story' | 'thread';

@Component({
  selector: 'app-campaign-submission',
  standalone: true,
  imports: [CommonModule, FormsModule, CampaignStatusBarComponent],
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

  screenshotUploading = false;
  insightsUploading = false;
  submitting = false;
  submitted = false;
  error = '';
  existingSubmission: any = null;

  // Insights timing lock
  selectedPostDate: Date | null = null;
  insightsUnlocksAt: Date | null = null;
  insightsCountdown = '';
  private countdownInterval: any = null;

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

    // Load invite + campaign info, then existing submission
    if (this.inviteId) {
      this.config.getInviteWithCampaign(this.inviteId).subscribe({
        next: (res: any) => {
          // Sync real invite status from backend (overrides query param)
          if (res?.invite?.status) {
            this.inviteStatus = res.invite.status;
          }
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
            this.campaignType = campaign.campaignType || '';
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
    if (type === 'screenshot') this.screenshotUploading = true;
    else this.insightsUploading = true;

    try {
      let imageUrl = '';
      const fd = new FormData();
      fd.append('file', file);
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

  get isReadOnly(): boolean {
    return ['completed', 'approved', 'disputed'].includes(this.inviteStatus);
  }

  get inviteStatusLabel(): string {
    const map: Record<string, string> = {
      accepted:          'Accepted',
      payment_confirmed: 'Payment Confirmed',
      working:           'In Progress',
      submitted:         'Work Submitted',
      approved:          'Approved',
      completed:         'Completed',
      disputed:          'Disputed',
    };
    return map[this.inviteStatus] || this.inviteStatus;
  }

  canSubmit(): boolean {
    if (this.isReadOnly) return false;
    // Location campaigns: postUrl still required, screenshot is optional
    if (this.isLocationCampaign) return !!this.postUrl.trim();
    // Paid/product campaigns: postUrl required; screenshot strongly recommended but optional
    return !!this.postUrl.trim();
  }

  submit() {
    if (!this.canSubmit()) {
      this.error = 'Post URL and screenshot are required.';
      return;
    }
    this.submitting = true;
    this.error = '';

    const payload: any = {
      postUrl: this.postUrl.trim(),
      postScreenshotUrl: this.postScreenshotUrl,
    };

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
