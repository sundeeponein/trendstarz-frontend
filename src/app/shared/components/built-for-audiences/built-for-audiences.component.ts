import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export type BuiltForAudienceTint = 'purple' | 'orange' | 'blue' | 'gray' | 'red';

export interface BuiltForAudienceItem {
  icon: string;
  title: string;
  subtitle: string;
  tint?: BuiltForAudienceTint;
}

@Component({
  selector: 'app-built-for-audiences',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './built-for-audiences.component.html',
  styleUrls: ['./built-for-audiences.component.scss'],
})
export class BuiltForAudiencesComponent {
  @Input() heading = 'Platform Features';
  @Input() subheading = 'Tools and collaboration solutions built for creators and brands.';

  private static readonly tintCycle: BuiltForAudienceTint[] = ['purple', 'orange', 'blue', 'gray'];

  @Input() items: BuiltForAudienceItem[] = [
    { icon: 'bi-person', title: 'Fashion Brands', subtitle: 'Apparel & Accessories tailored management.', tint: 'purple' },
    { icon: 'bi-fork-knife', title: 'Restaurants', subtitle: 'Food & Dining visual storytelling.', tint: 'orange' },
    { icon: 'bi-heart', title: 'Beauty Brands', subtitle: 'Skincare & Makeup brand scaling.', tint: 'blue' },
    { icon: 'bi-display', title: 'Tech & Gadgets', subtitle: 'Electronics & Apps launch precision.', tint: 'gray' },
    { icon: 'bi-rocket', title: 'Startups', subtitle: 'Growth & Awareness for new entities.', tint: 'red' },
    { icon: 'bi-people-fill', title: 'Lifestyle Creators', subtitle: 'Daily Life & Trends connectivity.', tint: 'purple' },
    { icon: 'bi-building', title: 'Local Businesses', subtitle: 'City & Hyperlocal Reach campaigns.', tint: 'gray' },
    { icon: 'bi-chat-left-quote', title: 'Food Bloggers', subtitle: 'Taste & Review content excellence.', tint: 'orange' },
  ];

  tintFor(item: BuiltForAudienceItem, index: number): BuiltForAudienceTint {
    return item.tint || BuiltForAudiencesComponent.tintCycle[index % BuiltForAudiencesComponent.tintCycle.length];
  }
}
