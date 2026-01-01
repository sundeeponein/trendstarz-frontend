import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResolvePlatformPipe } from '../../pipes/resolve-platform.pipe';

@Component({
  selector: 'app-influencer-user-card',
  standalone: true,
  imports: [CommonModule, ResolvePlatformPipe],
  templateUrl: './influencer-user-card.component.html'
})
export class InfluencerUserCardComponent {
  @Input() profileImage: string = '';
  @Input() profileImages: any[] = [];
  @Input() name = '';
  @Input() username = '';
  @Input() email = '';
  @Input() phoneNumber = '';
  @Input() categories: string[] = [];
  @Input() location: any = {};
  @Input() socialMedia: any[] = [];
  @Input() isPremium = false;
  @Input() promotionalPrice?: number;

  resolvePlatform(sm: any): string {
    if (!sm || !sm.platform) return '';
    const p = sm.platform.toLowerCase();
    if (p.includes('insta')) return 'instagram';
    if (p.includes('face')) return 'facebook';
    if (p.includes('youtube')) return 'youtube';
    return p;
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }

  get displayImage(): string {
    return this.profileImage || this.profileImages?.[0]?.url || 'assets/default-profile.png';
  }
}
