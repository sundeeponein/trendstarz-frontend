import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from '../../config.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-influencer-profile-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './influencer-profile-view.component.html',
  styleUrls: []
})

export class InfluencerProfileViewComponent implements OnInit {
  influencer: any;
  loading = true;
  error = '';

  onImgError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith('assets/default-profile.png')) {
      img.src = 'assets/default-profile.png';
    }
  }

  get displayImage(): string {
    return this.influencer?.profileImage || this.influencer?.profileImages?.[0]?.url || 'assets/default-profile.png';
  }

  constructor(private route: ActivatedRoute, private config: ConfigService, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const username = params.get('username');
      this.influencer = null;
      this.error = '';
      this.loading = true;
      if (username) {
        this.config.getInfluencerByUsername(username).subscribe({
          next: (data) => {
            console.log('Influencer API response:', data);
            if (!data) {
              this.error = 'Influencer not found.';
              this.influencer = null;
            } else {
              this.influencer = data;
            }
            this.loading = false;
            this.cd.detectChanges();
          },
          error: (err) => {
            console.error('Influencer API error:', err);
            this.error = 'Could not load influencer profile.';
            this.loading = false;
            this.cd.detectChanges();
          }
        });
      } else {
        this.error = 'No influencer username provided.';
        this.loading = false;
        this.cd.detectChanges();
      }
    });
  }
}
