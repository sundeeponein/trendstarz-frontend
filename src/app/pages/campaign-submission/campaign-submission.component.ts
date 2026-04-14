import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../shared/config.service';
import { environment } from '../../../environments/environment';
import { CampaignStatusBarComponent } from '../../shared/campaign-status-bar/campaign-status-bar.component';

type PostType = 'reel' | 'video' | 'photo' | 'short' | 'story' | 'thread';

@Component({
  selector: 'app-campaign-submission',
  standalone: true,
  imports: [CommonModule, FormsModule, CampaignStatusBarComponent],
  templateUrl: './campaign-submission.component.html',
  styleUrls: ['./campaign-submission.component.scss'],
})
export class CampaignSubmissionComponent implements OnInit {
  inviteId = '';
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
  postTypes: { key: PostType; label: string }[] = [
    { key: 'reel', label: 'Reel' },
    { key: 'video', label: 'Video' },
    { key: 'photo', label: 'Post/Photo' },
    { key: 'short', label: 'Short' },
    { key: 'story', label: 'Story' },
    { key: 'thread', label: 'Thread' },
  ];

  screenshotUploading = false;
  insightsUploading = false;
  submitting = false;
  submitted = false;
  error = '';
  existingSubmission: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private config: ConfigService,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.inviteId = this.route.snapshot.paramMap.get('inviteId') || '';
    const nav = this.route.snapshot.queryParamMap;
    this.campaignTitle = nav.get('campaignTitle') || 'Campaign';
    this.brandName = nav.get('brandName') || '';
    this.inviteStatus = nav.get('inviteStatus') || 'working';

    // Load existing submission if any
    if (this.inviteId) {
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
    if (this.viewsCount || this.likesCount) this.showStats = true;
  }

  onPostUrlChange() {
    const url = this.postUrl;
    if (/instagram\.com/i.test(url)) this.detectedPlatform = 'instagram';
    else if (/youtube\.com|youtu\.be/i.test(url)) this.detectedPlatform = 'youtube';
    else if (/twitter\.com|x\.com/i.test(url)) this.detectedPlatform = 'twitter';
    else if (/tiktok\.com/i.test(url)) this.detectedPlatform = 'tiktok';
    else if (/facebook\.com/i.test(url)) this.detectedPlatform = 'facebook';
    else this.detectedPlatform = '';
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

  async uploadImage(file: File, type: 'screenshot' | 'insights') {
    const preset = environment.cloudinaryUploadPreset;
    const cloud = environment.cloudinaryCloudName;
    const url = `https://api.cloudinary.com/v1_1/${cloud}/image/upload`;

    if (type === 'screenshot') this.screenshotUploading = true;
    else this.insightsUploading = true;

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', preset);
      fd.append('folder', 'campaign_submissions');

      const res: any = await this.http.post(url, fd).toPromise();
      if (type === 'screenshot') {
        this.postScreenshotUrl = res.secure_url;
      } else {
        this.insightsScreenshotUrl = res.secure_url;
      }
    } catch (e) {
      this.error = 'Image upload failed. Please try again.';
    } finally {
      if (type === 'screenshot') this.screenshotUploading = false;
      else this.insightsUploading = false;
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

  canSubmit(): boolean {
    return !!this.postUrl.trim() && !!this.postScreenshotUrl;
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
    if (this.postType) payload.postType = this.postType;
    if (this.captionUsed) payload.captionUsed = this.captionUsed;
    if (this.insightsScreenshotUrl) payload.insightsScreenshotUrl = this.insightsScreenshotUrl;
    if (this.viewsCount != null) payload.viewsCount = this.viewsCount;
    if (this.likesCount != null) payload.likesCount = this.likesCount;
    if (this.commentsCount != null) payload.commentsCount = this.commentsCount;
    if (this.sharesCount != null) payload.sharesCount = this.sharesCount;
    if (this.reachCount != null) payload.reachCount = this.reachCount;

    this.config.submitCampaignPost(this.inviteId, payload).subscribe({
      next: () => {
        this.submitted = true;
        this.submitting = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Submission failed. Please try again.';
        this.submitting = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/influencer-dashboard']);
  }
}
