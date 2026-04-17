import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tier-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tier-info-modal.component.html',
  styleUrls: ['./tier-info-modal.component.scss']
})
export class TierInfoModalComponent {
  @Input() tiers: any[] = [];
  @Input() show = false;
  @Output() showChange = new EventEmitter<boolean>();

  close(): void {
    this.show = false;
    this.showChange.emit(false);
  }
}
