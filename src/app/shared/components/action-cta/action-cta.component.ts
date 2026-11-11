import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-action-cta',
  standalone: true,
  imports: [NgIf, RouterLink],
  templateUrl: './action-cta.component.html',
  styleUrls: ['./action-cta.component.scss'],
})
export class ActionCtaComponent {
  @Input() kicker = '';
  @Input() heading = '';
  @Input() description = '';
  @Input() buttonLabel = '';
  @Input() buttonRoute = '/';
  @Input() secondaryLabel = '';
  @Input() secondaryRoute = '/';
  @Input() secondaryIcon = '';
  @Input() ariaLabel = 'Call to action';
  /** When set, clicking the button calls this output instead of navigating via buttonRoute. */
  @Output() buttonClick = new EventEmitter<void>();

  onButtonClick(event: Event): void {
    if (this.buttonClick.observed) {
      event.preventDefault();
      this.buttonClick.emit();
    }
  }
}
