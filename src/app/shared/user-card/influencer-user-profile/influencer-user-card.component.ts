import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-influencer-user-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './influencer-user-card.component.html',
  styleUrls: []
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
  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }

  get displayImage(): string {
    return this.profileImage || this.profileImages?.[0]?.url || 'assets/default-profile.png';
  }
}
