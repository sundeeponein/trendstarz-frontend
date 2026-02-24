import { Component, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { LegalPageWrapperComponent } from '../legal-page-wrapper.component';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [LegalPageWrapperComponent],
  templateUrl: './contact.component.html',
  styleUrls: []
})
export class ContactComponent implements OnInit {
  constructor(private meta: Meta, private title: Title) {}
  ngOnInit() {
    this.title.setTitle('Contact Us – TrendStarz');
    this.meta.updateTag({ name: 'description', content: 'Contact TrendStarz support for inquiries or assistance.' });
  }
}
