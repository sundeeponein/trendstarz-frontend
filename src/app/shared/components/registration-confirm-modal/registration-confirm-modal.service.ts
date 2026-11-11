import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

export type RegistrationRole = 'influencer' | 'brand' | 'photographer';

@Injectable({ providedIn: 'root' })
export class RegistrationConfirmModalService {
  private router = inject(Router);

  isOpen = false;
  role: RegistrationRole | null = null;

  open(role: RegistrationRole): void {
    this.role = role;
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
    this.role = null;
  }

  confirm(): void {
    const routes: Record<RegistrationRole, string> = {
      influencer: '/register-influencer',
      brand: '/register-brand',
      photographer: '/register-photographer',
    };
    // Tag this navigation so navbar-layout's direct-link auto-open (below)
    // doesn't immediately reopen the modal the user just confirmed.
    if (this.role) this.router.navigate([routes[this.role]], { state: { fromRegModal: true } });
    this.close();
  }
}
