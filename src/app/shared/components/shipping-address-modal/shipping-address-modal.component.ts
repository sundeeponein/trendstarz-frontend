import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ShippingAddressModalService } from './shipping-address-modal.service';
import { ConfigService } from '../../config.service';
import { SessionService } from '../../../core/session.service';

@Component({
  selector: 'app-shipping-address-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './shipping-address-modal.component.html',
  styleUrls: ['./shipping-address-modal.component.scss'],
})
export class ShippingAddressModalComponent {
  protected readonly modal = inject(ShippingAddressModalService);
  private readonly fb = inject(FormBuilder);
  private readonly config = inject(ConfigService);
  private readonly session = inject(SessionService);
  private readonly cd = inject(ChangeDetectorRef);

  /** The creator's registered name and mobile — what the host sees with the address. */
  registeredName = '';
  registeredMobile = '';
  contactLoading = false;

  get contactReady(): boolean {
    return !this.contactLoading && !!this.registeredName && !!this.registeredMobile;
  }

  private loadRegisteredContact(): void {
    this.contactLoading = true;
    this.registeredName = '';
    this.registeredMobile = '';
    const role = String(this.session.getUser()?.role || '').toLowerCase();
    const profile$ = role === 'photographer'
      ? this.config.getPhotographerProfileById()
      : this.config.getInfluencerProfileById();
    profile$.subscribe({
      next: (res: any) => {
        const p = res?.user ?? res?.data ?? res ?? {};
        this.registeredName = String(p?.name || '').trim();
        this.registeredMobile = String(p?.phoneNumber || '').trim();
        this.contactLoading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.contactLoading = false;
        this.cd.markForCheck();
      },
    });
  }

  readonly form = this.fb.group({
    line1: ['', [Validators.required, Validators.minLength(3)]],
    line2: [''],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    pincode: ['', [Validators.required, Validators.pattern(/^[0-9]{4,10}$/)]],
    landmark: [''],
    optionAnswer: [''],
  });

  get optionQuestion(): string {
    return String(this.modal.options?.optionQuestion || '').trim();
  }

  get optionChoices(): string[] {
    return (this.modal.options?.optionChoices || []).filter((c) => !!String(c || '').trim());
  }

  private lastSeenOptions: unknown = null;

  /** Sync prefill when modal opens with new options. Cheap check via reference. */
  private syncPrefillIfNeeded(): void {
    if (this.lastSeenOptions === this.modal.options) return;
    this.lastSeenOptions = this.modal.options;
    this.loadRegisteredContact();
    const prefill = this.modal.options?.prefill || {};
    this.form.reset({
      line1: prefill.line1 || '',
      line2: prefill.line2 || '',
      city: prefill.city || '',
      state: prefill.state || '',
      pincode: prefill.pincode || '',
      landmark: prefill.landmark || '',
      optionAnswer: prefill.optionAnswer || '',
    });
    // The host's question (size etc.) is required only when asked.
    const answer = this.form.controls.optionAnswer;
    answer.setValidators(this.optionQuestion ? [Validators.required, Validators.maxLength(60)] : []);
    answer.updateValueAndValidity({ emitEvent: false });
  }

  get visible(): boolean {
    const open = this.modal.isOpen;
    if (open) this.syncPrefillIfNeeded();
    return open;
  }

  submit(): void {
    if (this.form.invalid || !this.contactReady) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    this.modal.submit({
      // Name and mobile come from the registered profile (set by the server).
      contactName: '',
      contactMobile: '',
      line1: String(v.line1 || '').trim(),
      line2: String(v.line2 || '').trim() || undefined,
      city: String(v.city || '').trim(),
      state: String(v.state || '').trim(),
      pincode: String(v.pincode || '').trim(),
      landmark: String(v.landmark || '').trim() || undefined,
      optionAnswer: this.optionQuestion ? String(v.optionAnswer || '').trim() : undefined,
    });
  }

  cancel(): void {
    this.modal.cancel();
  }
}
