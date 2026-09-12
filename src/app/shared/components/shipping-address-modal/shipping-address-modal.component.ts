import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ShippingAddressModalService } from './shipping-address-modal.service';

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

  readonly form = this.fb.group({
    contactName: ['', [Validators.required, Validators.minLength(2)]],
    contactMobile: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s]{10,15}$/)]],
    line1: ['', [Validators.required, Validators.minLength(3)]],
    line2: [''],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    pincode: ['', [Validators.required, Validators.pattern(/^[0-9]{4,10}$/)]],
    landmark: [''],
  });

  private lastSeenOptions: unknown = null;

  /** Sync prefill when modal opens with new options. Cheap check via reference. */
  private syncPrefillIfNeeded(): void {
    if (this.lastSeenOptions === this.modal.options) return;
    this.lastSeenOptions = this.modal.options;
    const prefill = this.modal.options?.prefill || {};
    this.form.reset({
      contactName: prefill.contactName || '',
      contactMobile: prefill.contactMobile || '',
      line1: prefill.line1 || '',
      line2: prefill.line2 || '',
      city: prefill.city || '',
      state: prefill.state || '',
      pincode: prefill.pincode || '',
      landmark: prefill.landmark || '',
    });
  }

  get visible(): boolean {
    const open = this.modal.isOpen;
    if (open) this.syncPrefillIfNeeded();
    return open;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    this.modal.submit({
      contactName: String(v.contactName || '').trim(),
      contactMobile: String(v.contactMobile || '').trim(),
      line1: String(v.line1 || '').trim(),
      line2: String(v.line2 || '').trim() || undefined,
      city: String(v.city || '').trim(),
      state: String(v.state || '').trim(),
      pincode: String(v.pincode || '').trim(),
      landmark: String(v.landmark || '').trim() || undefined,
    });
  }

  cancel(): void {
    this.modal.cancel();
  }
}
