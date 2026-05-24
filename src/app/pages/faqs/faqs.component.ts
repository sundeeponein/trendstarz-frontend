import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FaqAccordionComponent, FaqCtaButton } from '../../shared/components/faq-accordion/faq-accordion.component';
import { TRENDSTARZ_FAQ_ITEMS } from '../../shared/components/faq-accordion/faq-content.constants';

@Component({
  selector: 'app-faqs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FaqAccordionComponent],
  templateUrl: './faqs.component.html',
  styleUrls: ['./faqs.component.scss'],
})
export class FaqsComponent {
  readonly allFaqs = TRENDSTARZ_FAQ_ITEMS;
  readonly searchTerm = signal('');
  readonly ctaButtons: FaqCtaButton[] = [
    { label: 'Join as Influencer', route: '/register-influencer', className: 'btn btn-primary' },
    { label: 'Join as Brand', route: '/register-brand', className: 'btn btn-outline-white' },
    { label: 'Explore Opportunities', route: '/search', className: 'btn btn-outline-white' },
  ];

  readonly filteredFaqs = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.allFaqs;
    return this.allFaqs.filter((item) => {
      return [item.question, item.answer, item.label || '']
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  });

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }
}
