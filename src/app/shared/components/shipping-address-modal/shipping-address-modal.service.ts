import { Injectable } from '@angular/core';

export interface ShippingAddress {
  contactName: string;
  contactMobile: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface ShippingAddressPromptOptions {
  /** Brand/campaign name shown in header for context. */
  campaignTitle?: string;
  /** Optional value of the product, shown for context. */
  productLabel?: string;
  /** Prefilled values when reopening or editing. */
  prefill?: Partial<ShippingAddress>;
}

@Injectable({ providedIn: 'root' })
export class ShippingAddressModalService {
  isOpen = false;
  options: ShippingAddressPromptOptions = {};
  private resolver: ((value: ShippingAddress | null) => void) | null = null;

  prompt(options: ShippingAddressPromptOptions = {}): Promise<ShippingAddress | null> {
    // If another prompt is already open, reject by resolving null on the previous.
    if (this.resolver) {
      this.resolver(null);
      this.resolver = null;
    }
    this.options = options;
    this.isOpen = true;
    return new Promise<ShippingAddress | null>((resolve) => {
      this.resolver = resolve;
    });
  }

  submit(address: ShippingAddress): void {
    const r = this.resolver;
    this.resolver = null;
    this.isOpen = false;
    if (r) r(address);
  }

  cancel(): void {
    const r = this.resolver;
    this.resolver = null;
    this.isOpen = false;
    if (r) r(null);
  }
}
