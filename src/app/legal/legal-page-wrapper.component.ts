import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-legal-page-wrapper',
  standalone: true,
  templateUrl: './legal-page-wrapper.component.html',
  styleUrls: ['./legal-page-wrapper.component.css']
})
export class LegalPageWrapperComponent {
  @Input() title = '';
}
