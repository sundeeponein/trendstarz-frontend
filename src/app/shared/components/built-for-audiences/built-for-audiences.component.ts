import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

export type BuiltForAudienceTint = 'pink' | 'orange' | 'purple' | 'blue' | 'green' | 'amber' | 'indigo' | 'red';

export interface BuiltForAudienceItem {
  icon: string;
  title: string;
  subtitle: string;
  tint?: BuiltForAudienceTint;
  /** Exact creator category name — used for the Search link and the live count. */
  category?: string;
  /** Pre-formatted live count ("150+"); when absent the card links without a number. */
  countLabel?: string;
}

@Component({
  selector: 'app-built-for-audiences',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './built-for-audiences.component.html',
  styleUrls: ['./built-for-audiences.component.scss'],
})
export class BuiltForAudiencesComponent {
  @Input() kicker = 'Creators for every niche';
  @Input() heading = 'Find Creators for Every Vertical';
  @Input() subheading = 'From beauty micro-influencers to tech reviewers — pick a niche and see verified creators ready to collaborate.';
  @Input() exploreAllLabel = 'Explore all creators';

  private static readonly tintCycle: BuiltForAudienceTint[] = ['pink', 'orange', 'purple', 'blue', 'green', 'amber', 'indigo', 'red'];

  @Input() items: BuiltForAudienceItem[] = [];

  tintFor(item: BuiltForAudienceItem, index: number): BuiltForAudienceTint {
    return item.tint || BuiltForAudiencesComponent.tintCycle[index % BuiltForAudiencesComponent.tintCycle.length];
  }

  searchParams(item?: BuiltForAudienceItem): Record<string, string> {
    return item?.category ? { tab: 'influencers', category: item.category } : { tab: 'influencers' };
  }
}
