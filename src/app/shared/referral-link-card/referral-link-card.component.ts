import { ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { copyTextToClipboard } from '../referral-link.util';
import { ReferralTargetRole, TrackingLinksApiService } from '../tracking-links/tracking-links-api.service';

/** Self-service "share your link" card. Fetches/creates a real tracked referral link for `role`
 *  and renders a copy-ready input. Used on User Settings and each role's own profile-view page. */
@Component({
  selector: 'app-referral-link-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './referral-link-card.component.html',
  styleUrls: ['./referral-link-card.component.scss'],
})
export class ReferralLinkCardComponent implements OnChanges {
  @Input({ required: true }) role!: ReferralTargetRole;

  referralLink = '';
  referralLinkCopied = false;
  loadError = false;

  constructor(
    private trackingLinksApi: TrackingLinksApiService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['role'] && this.role) {
      this.loadReferralLink();
    }
  }

  get roleLabel(): string {
    if (this.role === 'brand') return 'brands';
    if (this.role === 'photographer') return 'photographers';
    return 'influencers';
  }

  private loadReferralLink(): void {
    this.loadError = false;
    this.trackingLinksApi.getOrCreateReferralLink(this.role).subscribe({
      next: (link) => {
        this.referralLink = link.url;
        this.cd.detectChanges();
      },
      error: () => {
        // Previously this had no error handler at all, so a failure (e.g. the
        // stale-index bug that broke every referral link creation) rendered
        // as a silent empty box with nothing in the console pointing at why.
        this.loadError = true;
        this.cd.detectChanges();
      },
    });
  }

  copyReferralLink(): void {
    if (!this.referralLink) return;
    copyTextToClipboard(this.referralLink);
    this.referralLinkCopied = true;
    setTimeout(() => {
      this.referralLinkCopied = false;
      this.cd.detectChanges();
    }, 2000);
  }
}
