import { ChangeDetectorRef, Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../config.service';

/**
 * One-time "I agree" for accounts made before the sign-up checkbox (or before
 * the current Terms / Privacy versions). The server says when it's needed
 * (session/opened → consentNeeded) and records the answer (auth/consent/accept).
 */
@Component({
  selector: 'app-terms-consent-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './terms-consent-modal.component.html',
})
export class TermsConsentModalComponent {
  private readonly config = inject(ConfigService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Output() accepted = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  agreed = false;
  saving = false;
  error = '';

  accept(): void {
    if (!this.agreed || this.saving) return;
    this.saving = true;
    this.error = '';
    this.config.acceptLegalConsent().subscribe({
      next: () => {
        this.saving = false;
        this.accepted.emit();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Could not save right now. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }
}
