import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

export interface WhyTrendstarzBenefit {
  title: string;
  description: string;
}

export interface TrendstarzGlanceCounter {
  label: string;
  value: string;
  emphasis?: boolean;
}

@Component({
  selector: 'app-why-trendstarz-glance',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './why-trendstarz-glance.component.html',
  styleUrls: ['./why-trendstarz-glance.component.scss'],
})
export class WhyTrendstarzGlanceComponent {
  @Input() heading = 'Why TrendStarz';
  @Input() subheading = "Built for India's growing creator economy, providing institutional-grade tools for modern collaborations.";
  @Input() learnMoreRoute = '/why-trendstarz';

  @Input() benefits: WhyTrendstarzBenefit[] = [
    { title: 'Verified Creator Network', description: 'Identity and profile checks designed for reliable brand partnerships.' },
    { title: 'Campaign Operations', description: 'From brief to payout, the workflow is structured to reduce coordination overhead.' },
  ];

  @Input() growingLabel = 'Growing daily';
  @Input() growingSub = 'Join the elite network of Indian creators.';

  @Input() glanceHeading = 'TrendStarz at a Glance';
  /** Real counts only — the counters block stays hidden while this is empty. */
  @Input() counters: TrendstarzGlanceCounter[] = [];

  @Input() categoriesLabel = 'Top Creator Categories';
  @Input() categories: string[] = ['Fashion', 'Beauty', 'Tech', 'Travel', 'Food', 'Fitness'];
}
