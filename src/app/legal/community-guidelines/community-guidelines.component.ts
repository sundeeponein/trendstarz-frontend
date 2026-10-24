import { Component, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { LegalPageWrapperComponent } from '../legal-page-wrapper.component';

@Component({
  selector: 'app-community-guidelines',
  standalone: true,
  imports: [LegalPageWrapperComponent],
  templateUrl: './community-guidelines.component.html',
  styleUrls: []
})
export class CommunityGuidelinesComponent implements OnInit {
  constructor(private meta: Meta, private title: Title) {}
  ngOnInit() {
    this.title.setTitle('Community Guidelines | TrendStarz');
    this.meta.updateTag({ name: 'description', content: 'TrendStarz Community Guidelines — rules and best practices for influencers, brands, and photographers on the platform.' });
  }
}
