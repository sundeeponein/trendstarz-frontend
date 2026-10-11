import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CampaignTransactionsPanelComponent } from './sections/campaign-transactions-panel.component';
import { PremiumPaymentsPanelComponent } from './sections/premium-payments-panel.component';
import { RefundsPanelComponent } from './sections/refunds-panel.component';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, PremiumPaymentsPanelComponent, CampaignTransactionsPanelComponent, RefundsPanelComponent],
  templateUrl: './admin-payments.component.html',
  styleUrls: ['./admin-payments.component.scss'],
})
export class AdminPaymentsComponent {
  error = '';
  successMessage = '';

  viewMode: 'premium' | 'transactions' | 'refunds' = 'transactions';

  constructor(private cdr: ChangeDetectorRef) {}

  setViewMode(mode: 'premium' | 'transactions' | 'refunds') {
    this.viewMode = mode;
  }

  onError(message: string) {
    setTimeout(() => {
      this.error = message;
      this.successMessage = '';
      this.cdr.markForCheck();
    });
  }

  onSuccess(message: string) {
    this.successMessage = message;
    this.error = '';
    this.cdr.markForCheck();
    setTimeout(() => {
      if (this.successMessage === message) this.successMessage = '';
      this.cdr.markForCheck();
    }, 3000);
  }
}
