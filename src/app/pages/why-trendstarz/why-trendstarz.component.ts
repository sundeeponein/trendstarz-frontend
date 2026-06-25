import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-why-trendstarz',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './why-trendstarz.component.html',
  styleUrls: ['./why-trendstarz.component.scss'],
})
export class WhyTrendstarzComponent {
  readonly pillars = [
    {
      icon: 'bi-shield-check',
      iconClass: 'icon--peach',
      title: 'Verified Creator Network',
      description:
        'Identity and profile checks designed for reliable brand partnerships. We ensure every influencer on our platform meets stringent quality and authenticity benchmarks.',
    },
    {
      icon: 'bi-diagram-3',
      iconClass: 'icon--blue',
      title: 'Campaign Operations',
      description:
        'From brief to payout, the workflow is structured to reduce coordination overhead. Manage deliverables, timelines, and communications in one centralized dashboard.',
    },
  ];

  readonly topCategories = ['Fashion', 'Entertainment', 'Beauty', 'Food', 'Travel'];

  readonly glanceStats = [
    { label: 'Verified Influencers', value: '108+', icon: 'bi-person-check', emphasis: true },
    { label: 'Creator Profiles', value: '200+', icon: 'bi-briefcase', emphasis: true },
    { label: 'Network of Brands', value: 'Scaling', icon: 'bi-tags', emphasis: false },
    { label: 'Operations Scope', value: 'Across India', icon: 'bi-geo-alt', emphasis: false },
  ];

  readonly precisionStats = [
    { value: '48 hrs', label: 'Match Time' },
    { value: '100%', label: 'Quality Checks' },
  ];
}
