import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Campaign } from '../campaign.model';

@Component({
  selector: 'app-campaign-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './campaign-card.component.html',
  styleUrls: ['./campaign-card.component.scss']
})
export class CampaignCardComponent {
  @Input() campaign!: Campaign;
  @Input() isOwner = false;
  @Input() limited = false;
  @Output() viewDetails = new EventEmitter<Campaign>();
  @Output() manage = new EventEmitter<Campaign>();

  get statusClass(): string {
    const status = String(this.campaign?.status || 'active').toLowerCase();
    return status === 'pending' ? 'pending_review' : status;
  }

  get statusLabel(): string {
    const status = this.statusClass;
    if (status === 'pending_review') return 'Pending Review';
    if (status === 'needs_changes') return 'Needs Changes';
    if (status === 'rejected') return 'Rejected';
    if (status === 'active') return 'Approved';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  get budgetDisplay(): string {
    if (!this.campaign?.budgetMin && !this.campaign?.budgetMax) return '';
    const min = this.campaign.budgetMin ? `₹${this.campaign.budgetMin.toLocaleString('en-IN')}` : '';
    const max = this.campaign.budgetMax ? `₹${this.campaign.budgetMax.toLocaleString('en-IN')}` : '';
    if (min && max && min === max) return min;
    if (min && max) return `${min} - ${max}`;
    return min || max;
  }

  get timelineDisplay(): string {
    if (!this.campaign?.timelineStart) return '';
    const fmt = (d: string) => {
      const date = new Date(d);
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    };
    const start = fmt(this.campaign.timelineStart);
    const end = this.campaign.timelineEnd ? fmt(this.campaign.timelineEnd) : 'Ongoing';
    return `${start} — ${end}`;
  }

  get applicantLabel(): string {
    const n = this.campaign?.applicants || 0;
    return `${n} Influencer${n === 1 ? '' : 's'}`;
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }
}
