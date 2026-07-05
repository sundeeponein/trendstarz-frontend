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
  /** e.g. "Website", "Instagram Profile" — the destination's type label. */
  @Input() typeLabel = 'Link';
  /** The real destination (brand's site/profile) — shown as a hostname for context, never the tracked link itself. */
  @Input() destinationUrl: string | undefined = '';
  /** The tracked short link (trendstarz.in/r/CODE) — this is what gets copied. */
  @Input() url = '';
  @Input() active = true;
  /** false = audit mode (admin roster): hide the short link/copy button, show status + click count instead. */
  @Input() showShortLink = true;
  @Input() clickCount: number | null = null;

  copied = false;
  private copyTimer: any;

  get destinationHost(): string {
    const raw = String(this.destinationUrl || '').trim();
    if (!raw) return '';
    try {
      const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
      return new URL(withScheme).hostname;
    } catch {
      return raw;
    }
  }

  copy(): void {
    if (!this.url) return;
    copyTextToClipboard(this.url);
    this.copied = true;
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => (this.copied = false), 2000);
  }
}
