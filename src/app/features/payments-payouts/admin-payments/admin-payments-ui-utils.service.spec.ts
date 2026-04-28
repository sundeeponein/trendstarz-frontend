import { AdminPaymentsUiUtilsService } from './admin-payments-ui-utils.service';
import { PremiumPayment } from '../payments-payouts.models';

describe('AdminPaymentsUiUtilsService', () => {
  let service: AdminPaymentsUiUtilsService;

  beforeEach(() => {
    service = new AdminPaymentsUiUtilsService();
  });

  it('formats paise to INR string', () => {
    expect(service.formatPaise(12345)).toBe('₹123.45');
  });

  it('returns paid collab label', () => {
    expect(service.getTransactionLabel('paid_collab')).toBe('Paid Collab');
  });

  it('returns fallback deleted user name when user is missing', () => {
    const payment = {
      _id: 'p1',
      userId: null,
      userType: 'Influencer',
      transactionId: 'T1',
      amount: 100,
      premiumDuration: '1m',
      paymentMethod: 'upi',
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as PremiumPayment;

    expect(service.getUserDisplayName(payment)).toBe('Deleted User');
  });

  it('uses snapshot name when actual user is deleted', () => {
    const payment = {
      _id: 'p2',
      userId: { isDeleted: true },
      userSnapshot: { name: 'Old User' },
      userType: 'Brand',
      transactionId: 'T2',
      amount: 100,
      premiumDuration: '1m',
      paymentMethod: 'qr',
      status: 'rejected',
      createdAt: new Date().toISOString(),
    } as PremiumPayment;

    expect(service.getUserDisplayName(payment)).toBe('Old User (Deleted)');
  });
});
