import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConfigService } from '../../shared/config.service';

@Component({
  selector: 'app-why-trendstarz',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './why-trendstarz.component.html',
  styleUrls: ['./why-trendstarz.component.scss'],
})
export class WhyTrendstarzComponent implements OnInit {
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

  glanceStats = [
    { label: 'Verified Influencers', value: '108+', icon: 'bi-person-check', emphasis: true },
    { label: 'Creator Profiles', value: '200+', icon: 'bi-briefcase', emphasis: true },
    { label: 'Network of Brands', value: 'Scaling', icon: 'bi-tags', emphasis: false },
    { label: 'Photographers', value: '0', icon: 'bi-camera', emphasis: false },
  ];

  readonly precisionStats = [
    { value: '48 hrs', label: 'Match Time' },
    { value: '100%', label: 'Quality Checks' },
  ];

  private readonly isBrowser: boolean;

  constructor(
    private readonly config: ConfigService,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.config.getPlatformStats().subscribe((stats) => {
      const hasData = (stats?.totalInfluencers || 0) > 0 || (stats?.totalPhotographers || 0) > 0;
      if (!hasData) return;
      const formatCount = (count: number) => (Number.isFinite(count) ? String(count) : '0');
      this.glanceStats = [
        { label: 'Verified Influencers', value: formatCount(stats.verifiedInfluencers), icon: 'bi-person-check', emphasis: true },
        { label: 'Creator Profiles', value: formatCount(stats.totalInfluencers), icon: 'bi-briefcase', emphasis: true },
        { label: 'Network of Brands', value: 'Scaling', icon: 'bi-tags', emphasis: false },
        { label: 'Photographers', value: formatCount(stats.totalPhotographers), icon: 'bi-camera', emphasis: false },
      ];
    });
  }
}
