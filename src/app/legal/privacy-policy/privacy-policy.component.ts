import { Component, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { LegalPageWrapperComponent } from '../legal-page-wrapper.component';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [LegalPageWrapperComponent],
  templateUrl: './privacy-policy.component.html',
  styleUrls: []
})
export class PrivacyPolicyComponent implements OnInit {
  constructor(private meta: Meta, private title: Title) {}
  ngOnInit() {
    this.title.setTitle('Privacy Policy | TrendStarz');
    this.meta.updateTag({ name: 'description', content: 'Learn how TrendStarz collects, uses, and protects your personal information.' });
  }
}
