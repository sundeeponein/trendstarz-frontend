import { Component, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { LegalPageWrapperComponent } from '../legal-page-wrapper.component';

@Component({
  selector: 'app-refund-policy',
  standalone: true,
  imports: [LegalPageWrapperComponent],
  templateUrl: './refund-policy.component.html',
  styleUrls: []
})
export class RefundPolicyComponent implements OnInit {
  constructor(private meta: Meta, private title: Title) {}
  ngOnInit() {
    this.title.setTitle('Refund & Cancellation Policy – TrendStarz');
    this.meta.updateTag({ name: 'description', content: 'Refund and cancellation policy for TrendStarz premium subscriptions.' });
  }
}
