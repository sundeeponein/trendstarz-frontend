import { FormControl } from '@angular/forms';
import { hasValidUpiId, upiIdError, upiIdValidator } from './upi.util';

describe('UPI ID check (frontend, same rule as the server)', () => {
  it('accepts real-looking UPI IDs and refuses typos', () => {
    expect(upiIdError('9876543210@ybl')).toBeNull();
    expect(upiIdError('Ravi.Kumar@OKHDFCBANK')).toBeNull();
    for (const bad of ['9876543210', 'ravi@', 'ravi@gmail.com']) {
      expect(upiIdError(bad)).toContain("doesn't look right");
    }
  });

  it('as a form validator: empty is fine (not given), a typo marks the field invalid', () => {
    expect(new FormControl('', upiIdValidator).valid).toBeTrue();
    expect(new FormControl('ravi@ybl', upiIdValidator).valid).toBeTrue();
    const bad = new FormControl('ravi', upiIdValidator);
    expect(bad.valid).toBeFalse();
    expect(bad.errors?.['upiId']).toContain('name@bank');
  });

  it('paid invites need a present, valid UPI ID', () => {
    expect(hasValidUpiId('')).toBeFalse();
    expect(hasValidUpiId('ravi')).toBeFalse();
    expect(hasValidUpiId('ravi@ybl')).toBeTrue();
  });
});
