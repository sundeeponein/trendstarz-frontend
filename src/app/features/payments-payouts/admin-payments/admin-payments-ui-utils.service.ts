import { Injectable } from '@angular/core';
import { PremiumPayment } from '../payments-payouts.models';

@Injectable({ providedIn: 'root' })
export class AdminPaymentsUiUtilsService {
  formatPaise(amount: number): string {
    return `₹${((amount || 0) / 100).toLocaleString('en-IN')}`;
  }

  formatDateTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getTransactionLabel(type: 'paid_collab' | 'pay_to_join'): string {
    return type === 'paid_collab' ? 'Paid Collab' : 'Pay-to-Join';
  }

  collectionStatusLabel(status: string): string {
    const map: Record<string, string> = {
      awaiting_payment: 'Awaiting Payment',
      proof_submitted:  'Proof Submitted',
      verified:         'Verified',
      failed:           'Rejected',
    };
    return map[status] || status;
  }

  payoutStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending:    'Pending',
      processing: 'Processing',
      paid:       'Paid Out',
      skipped:    'Skipped',
    };
    return map[status] || status;
  }

  getUserDisplayName(payment: PremiumPayment): string {
    const u = payment.userId;
    if (u && !u.isDeleted) {
      return (
        u.username ||
        u.brandUsername ||
        u.brandName ||
        u.name ||
        (payment.userSnapshot?.name ? payment.userSnapshot.name + ' (Deleted)' : 'Deleted User')
      );
    }
    if (payment.userSnapshot?.name) {
      return payment.userSnapshot.name + ' (Deleted)';
    }
    return 'Deleted User';
  }

  getProfileImage(payment: PremiumPayment): string {
    const u = payment.userId;
    if (!u) return 'assets/default-profile.png';

    if (payment.userType === 'Brand') {
      if (Array.isArray(u.brandLogo) && u.brandLogo.length > 0) {
        const img = u.brandLogo[0];
        if (img && typeof img === 'object' && img.url) return img.url;
        if (typeof img === 'string' && img) return img;
      }
      return 'assets/default-logo.png';
    }

    if (Array.isArray(u.profileImages) && u.profileImages.length > 0) {
      const img = u.profileImages[0];
      if (img && typeof img === 'object' && img.url) return img.url;
      if (typeof img === 'string' && img) return img;
    }

    return 'assets/default-profile.png';
  }
}
