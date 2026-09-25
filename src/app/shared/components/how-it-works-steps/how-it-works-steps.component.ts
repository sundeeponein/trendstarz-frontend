import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface HowItWorksStep {
  title: string;
  text: string;
  tagIcon: string;
  tag: string;
  tone: 'orange' | 'indigo' | 'teal';
}

@Component({
  selector: 'app-how-it-works-steps',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './how-it-works-steps.component.html',
  styleUrls: ['./how-it-works-steps.component.scss'],
})
export class HowItWorksStepsComponent {
  @Input() kicker = 'How it works';
  @Input() heading = 'How TrendStarz Works in 3 Steps';
  @Input() subheading = 'Replace scattered WhatsApp groups and agency back-and-forth with one place to find creators, agree terms and pay safely.';

  // Keep each claim true to the current campaign flow (see campaign-transaction / campaign-submission schemas).
  @Input() steps: HowItWorksStep[] = [
    {
      title: 'Discover & Filter',
      text: 'Find verified creators by niche, city, tier and age range, and compare their TrendScore before you reach out.',
      tagIcon: 'bi-funnel',
      tag: 'Verified profiles only',
      tone: 'orange',
    },
    {
      title: 'Invite & Secure Payment',
      text: 'Send your campaign brief, agree deliverables and pay through TrendStarz. The creator is paid only after you approve the work.',
      tagIcon: 'bi-shield-check',
      tag: 'Protected payments',
      tone: 'indigo',
    },
    {
      title: 'Approve & Launch',
      text: 'Creators submit their work on the platform. Approve it or raise an issue for a revision, then the payout is released.',
      tagIcon: 'bi-patch-check',
      tag: 'Pay on approval',
      tone: 'teal',
    },
  ];
}
