import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface BuiltForAudienceItem {
  icon: string;
  title: string;
  subtitle: string;
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

  @Input() items: BuiltForAudienceItem[] = [
    { icon: 'bi-person', title: 'Fashion Brands', subtitle: 'Apparel & Accessories' },
    { icon: 'bi-geo-alt', title: 'Restaurants', subtitle: 'Food & Dining' },
    { icon: 'bi-heart', title: 'Beauty Brands', subtitle: 'Skincare & Makeup' },
    { icon: 'bi-display', title: 'Tech & Gadgets', subtitle: 'Electronics & Apps' },
    { icon: 'bi-rocket', title: 'Startups', subtitle: 'Growth & Awareness' },
    { icon: 'bi-people-fill', title: 'Lifestyle Creators', subtitle: 'Daily Life & Trends' },
    { icon: 'bi-building', title: 'Local Businesses', subtitle: 'City & Hyperlocal Reach' },
    { icon: 'bi-chat-left-quote', title: 'Food Bloggers', subtitle: 'Taste & Review Content' },
  ];
}
