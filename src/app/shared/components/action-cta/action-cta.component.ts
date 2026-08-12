import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-action-cta',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './action-cta.component.html',
  styleUrls: ['./action-cta.component.scss'],
})
export class ActionCtaComponent {
  @Input() heading = '';
  @Input() description = '';
  @Input() buttonLabel = '';
  @Input() buttonRoute = '/';
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
