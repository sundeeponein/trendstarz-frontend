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
    if (this.role) this.router.navigate([routes[this.role]]);
    this.close();
  }
}
