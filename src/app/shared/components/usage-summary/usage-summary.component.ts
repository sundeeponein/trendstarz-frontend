import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsageSummary } from '../../../services/monetization-api.service';

@Component({
  selector: 'app-usage-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="usageSummary">
      <span [class.usage-at-limit]="profileViewsAtLimit">
        <strong>Daily profile views:</strong> {{ usageSummary.profileViews.used }}/{{ usageSummary.profileViews.limit }}
      </span>
      <span [class.usage-at-limit]="searchAtLimit">
        <strong>Daily searches:</strong> {{ usageSummary.search.used }}/{{ usageSummary.search.limit }}
      </span>
    </ng-container>
  `,
  styles: [
    `:host { display: contents; }`,
    `.usage-at-limit { color: #dc2626; }`,
  ],
})
export class UsageSummaryComponent {
  @Input() usageSummary: UsageSummary | null = null;

  get profileViewsAtLimit(): boolean {
    const u = this.usageSummary;
    return !!u && u.profileViews.limit > 0 && u.profileViews.used >= u.profileViews.limit;
  }

  get searchAtLimit(): boolean {
    const u = this.usageSummary;
    return !!u && u.search.limit > 0 && u.search.used >= u.search.limit;
  }
}
