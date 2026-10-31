import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-action-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-action-modal.component.html',
  styleUrls: ['./confirm-action-modal.component.scss']
})
export class ConfirmActionModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() width = '520px';
  @Input() submitting = false;
  @Input() confirmLabel = 'Confirm';
  @Input() confirmLoadingLabel = 'Saving...';
  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<void>();

  dismiss(): void {
    if (!this.submitting) this.closed.emit();
  }
}
