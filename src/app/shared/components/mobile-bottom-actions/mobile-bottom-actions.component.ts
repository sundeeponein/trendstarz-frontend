import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-mobile-bottom-actions',
  standalone: true,
  templateUrl: './mobile-bottom-actions.component.html',
  styleUrls: ['./mobile-bottom-actions.component.scss'],
})
export class MobileBottomActionsComponent {
  @Input() ariaLabel = 'Page actions';
}
