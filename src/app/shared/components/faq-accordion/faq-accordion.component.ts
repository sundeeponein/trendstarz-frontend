import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, EventEmitter, Inject, Input, OnDestroy, OnInit, Output, PLATFORM_ID, Renderer2 } from '@angular/core';
import { RouterModule } from '@angular/router';

export interface FaqAccordionItem {
  question: string;
  answer: string;
  label?: 'Coming Soon' | 'Planned' | 'In Development';
}

export interface FaqCtaButton {
  label: string;
  route: string;
  className?: string;
}

@Component({
  selector: 'app-faq-accordion',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './faq-accordion.component.html',
  styleUrls: ['./faq-accordion.component.scss'],
})
export class FaqAccordionComponent implements OnInit, OnDestroy {
  @Input() heading = 'Frequently Asked Questions';
  @Input() items: FaqAccordionItem[] = [];
  @Input() schemaItems?: FaqAccordionItem[];
  @Input() showSchema = true;
  @Input() schemaId = 'trendstarz-faq-schema';
  @Input() ctaHeading = 'Ready to grow your collaborations?';
  @Input() ctaButtons: FaqCtaButton[] = [
    { label: 'Join as Influencer', route: '/register-influencer', className: 'btn btn-primary' },
    { label: 'Join as Brand', route: '/register-brand', className: 'btn btn-outline-dark' },
    { label: 'Explore Opportunities', route: '/search', className: 'btn btn-outline-dark' },
  ];

  /** Fires whenever an item is opened (not on close) — for page-level analytics. */
  @Output() itemToggled = new EventEmitter<{ index: number; question: string }>();

  activeIndex = -1;
  private readonly isBrowser: boolean;

  constructor(
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.showSchema) {
      this.upsertFaqSchema();
    }
  }

  ngOnDestroy(): void {
    this.removeSchemaScript();
  }

  toggle(index: number): void {
    this.activeIndex = this.activeIndex === index ? -1 : index;
    if (this.activeIndex === index) {
      this.itemToggled.emit({ index, question: this.items[index]?.question || '' });
    }
  }

  private upsertFaqSchema(): void {
    const existing = this.document.getElementById(this.schemaId);
    if (existing) {
      existing.remove();
    }

    const script = this.renderer.createElement('script');
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'id', this.schemaId);

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (this.schemaItems || this.items).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    };

    const schemaJson = this.renderer.createText(JSON.stringify(schema));
    this.renderer.appendChild(script, schemaJson);
    this.renderer.appendChild(this.document.head, script);
  }

  private removeSchemaScript(): void {
    if (!this.isBrowser) {
      return;
    }

    const script = this.document.getElementById(this.schemaId);
    if (script) {
      script.remove();
    }
  }
}
