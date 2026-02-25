import { Component, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { LegalPageWrapperComponent } from '../legal-page-wrapper.component';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [LegalPageWrapperComponent],
  templateUrl: './terms.component.html',
  styleUrls: []
})
export class TermsComponent implements OnInit {
  constructor(private meta: Meta, private title: Title) {}
  ngOnInit() {
    this.title.setTitle('Terms & Conditions | TrendStarz');
    this.meta.updateTag({ name: 'description', content: 'Read the terms governing use of TrendStarz platform.' });
  }
}
