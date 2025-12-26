import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-brand-user-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './brand-user-card.component.html',
  styleUrls: []
})
export class BrandUserCardComponent {
  @Input() brandLogoUrl = '';
  @Input() brandLogo: any;
  @Input() brandName = '';
  @Input() email = '';
  @Input() phoneNumber = '';
  @Input() categories: string[] = [];
  @Input() state = '';
  @Input() productImages: any[] = [];
  @Input() website = '';
  @Input() isPremium = false;

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }

  get displayBrandLogo(): string {
    // Support both array and string for brandLogo
    if (this.brandLogoUrl) return this.brandLogoUrl;
    if (Array.isArray(this.brandLogo) && this.brandLogo.length > 0) return this.brandLogo[0]?.url || 'assets/default-profile.png';
    if (typeof this.brandLogo === 'string') return this.brandLogo;
    return 'assets/default-profile.png';
  }
}
