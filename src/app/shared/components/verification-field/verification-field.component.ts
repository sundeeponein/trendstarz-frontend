import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-verification-field',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verification-field.component.html',
  styleUrls: ['./verification-field.component.scss'],
})
export class VerificationFieldComponent {
  @Input() label = '';
  @Input() status = 'Pending';
  @Input() value: string | number | null | undefined = '-';
  @Input() verified = false;
  @Input() thumbSrc = '';
  @Input() thumbAlt = '';
  @Input() fallbackSrc = '';
  @Input() valueAsButton = false;
  @Input() valueButtonDisabled = false;
  @Input() showAction = true;
  @Input() verifyLabel = 'Verify';
  @Input() unverifyLabel = 'Unverify';

  @Output() toggled = new EventEmitter<void>();
  @Output() valueClicked = new EventEmitter<void>();

  get displayValue(): string {
    const text = String(this.value ?? '').trim();
    return text || '-';
  }

  onImageError(event: Event): void {
    if (!this.fallbackSrc) return;
    (event.target as HTMLImageElement).src = this.fallbackSrc;
  }
}
