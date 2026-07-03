import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { copyTextToClipboard } from '../referral-link.util';

@Component({
  selector: 'app-promo-link-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './promo-link-card.component.html',
  styleUrl: './promo-link-card.component.scss',
})
export class PromoLinkCardComponent {
  @Input() typeLabel = 'Link';
  @Input() url = '';

  copied = false;
  private copyTimer: any;

  copy(): void {
    if (!this.url) return;
    copyTextToClipboard(this.url);
    this.copied = true;
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => (this.copied = false), 2000);
  }
}
