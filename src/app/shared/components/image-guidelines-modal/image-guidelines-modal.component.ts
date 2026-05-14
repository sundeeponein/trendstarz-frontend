import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageGuidelinesService, GuidelineType } from './image-guidelines.service';

@Component({
  selector: 'app-image-guidelines-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-guidelines-modal.component.html',
  styleUrls: ['./image-guidelines-modal.component.scss']
})
export class ImageGuidelinesModalComponent {
  isOpen = false;
  currentType: GuidelineType = 'influencer';

  constructor(protected guidelinesService: ImageGuidelinesService) {
    // Use effect to track signal changes
    effect(() => {
      this.isOpen = this.guidelinesService.isOpen();
      this.currentType = this.guidelinesService.currentType();
    });
  }

  close(): void {
    this.guidelinesService.close();
  }

  get influencerGuidelines() {
    return {
      allowed: [
        'Clear face visible with natural expression',
        'Good lighting with neutral or pleasing settings',
        'Single person preferred for primary avatar',
        'Natural professional or trendy casual look'
      ],
      notAllowed: [
        'Heavy Filters',
        'Group Photos',
        'Contact Details',
        'Sunglasses',
        'No Instagram handles as text on image',
        'No brand logos or collages',
        'Avoid heavily edited blue/red backgrounds'
      ]
    };
  }

  get brandGuidelines() {
    return {
      requirements: [
        'Brand Logo - High resolution vector or PNG',
        'Product Showcase - At least one high-quality product image'
      ],
      prohibited: [
        'No Emails',
        'No Phone Nos.',
        'No Offensive',
        'No Misleading',
        'No watermarks over logos',
        'No blurry low-res imagery',
        'No promotional pricing text on banners'
      ],
      verification: 'GST and official business proof may be requested during verification stage for "Verified Brand" status.'
    };
  }
}
