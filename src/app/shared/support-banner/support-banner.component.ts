import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../config.service';

/**
 * Reusable support / "Need help?" banner.
 *
 * Reads admin-managed contact info from `GET /public/support-contact` and
 * renders email, phone and WhatsApp links along with a configurable message.
 *
 * Usage:
 *   <app-support-banner></app-support-banner>
 *   <app-support-banner [title]="'Need help with payment?'"></app-support-banner>
 *
 * Hidden when admin toggles `supportContactEnabled` off.
 */
@Component({
  selector: 'app-support-banner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-banner.component.html',
  styleUrls: ['./support-banner.component.scss'],
})
export class SupportBannerComponent implements OnInit {
  /** Optional title shown in bold before the message. Defaults to "Need help?". */
  @Input() title: string = 'Need help?';
  /** Optional fallback message if admin hasn't set one. */
  @Input() fallbackMessage: string = 'For any queries, our team is here to help.';

  contact: { enabled: boolean; email: string; phone: string; whatsapp: string; message: string } = {
    enabled: true,
    email: '',
    phone: '',
    whatsapp: '',
    message: '',
  };

  constructor(private config: ConfigService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.config.getSupportContact().subscribe({
      next: (sc) => {
        this.contact = sc;
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  get phoneHref(): string {
    const p = (this.contact.phone || '').replace(/[^\d+]/g, '');
    return p ? `tel:${p}` : '';
  }

  get whatsappHref(): string {
    const w = (this.contact.whatsapp || '').replace(/[^\d]/g, '');
    return w ? `https://wa.me/${w}` : '';
  }
}
