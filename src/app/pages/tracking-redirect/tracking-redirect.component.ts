import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TrackingLinksApiService } from '../../shared/tracking-links/tracking-links-api.service';

const FALLBACK_URL = 'https://www.trendstarz.in/';

@Component({
  selector: 'app-tracking-redirect',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracking-redirect.component.html',
  styleUrls: ['./tracking-redirect.component.scss'],
})
export class TrackingRedirectComponent implements OnInit {
  failed = false;

  constructor(
    private route: ActivatedRoute,
    private trackingLinksApi: TrackingLinksApiService,
  ) {}

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code') || '';
    if (!code) {
      this.goToFallback();
      return;
    }
    this.trackingLinksApi.resolveTrackingLink(code).subscribe({
      next: (res) => {
        if (res?.destinationUrl) {
          window.location.replace(res.destinationUrl);
        } else {
          this.goToFallback();
        }
      },
      error: () => this.goToFallback(),
    });
  }

  private goToFallback(): void {
    this.failed = true;
    window.location.replace(FALLBACK_URL);
  }
}
