import { Component, Input } from '@angular/core';
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
}
