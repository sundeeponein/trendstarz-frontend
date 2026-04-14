import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface PasswordCheck {
  label: string;
  passed: boolean;
}

const RULES = [
  { label: 'At least 8 characters',      test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter (A–Z)',  test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter (a–z)',  test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number (0–9)',            test: (v: string) => /[0-9]/.test(v) },
  { label: 'One special character',       test: (v: string) => /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(v) },
];

/**
 * Angular validator: fails if the password does not meet ALL 5 strength rules.
 * Returns `{ passwordStrength: true }` on failure, null on pass.
 */
export const passwordStrengthValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: string = control.value || '';
  const allPass = RULES.every(r => r.test(value));
  return allPass ? null : { passwordStrength: true };
};

/**
 * Returns a live check list — call this with the current control value in your template.
 */
export function getPasswordChecks(value: string): PasswordCheck[] {
  return RULES.map(r => ({ label: r.label, passed: r.test(value || '') }));
}
