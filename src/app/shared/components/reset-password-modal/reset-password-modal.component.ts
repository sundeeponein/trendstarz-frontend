import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../config.service';
import { getPasswordChecks } from '../../password-strength';

@Component({
  selector: 'app-reset-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password-modal.component.html',
  styleUrls: ['./reset-password-modal.component.scss']
})
export class ResetPasswordModalComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };
  passwordError = '';
  passwordSuccess = '';
  passwordSaving = false;
  passwordVisible = {
    current: false,
    next: false,
    confirm: false,
  };

  constructor(private configService: ConfigService, private cdr: ChangeDetectorRef) {}

  get passwordChecks() {
    return getPasswordChecks(this.passwordForm.newPassword || '');
  }

  get strongPasswordValid(): boolean {
    return this.passwordChecks.every(c => c.passed);
  }

  get confirmPasswordMismatch(): boolean {
    return !!this.passwordForm.confirmPassword && this.passwordForm.newPassword !== this.passwordForm.confirmPassword;
  }

  get canSubmit(): boolean {
    if (this.passwordSaving) return false;
    if (!this.passwordForm.currentPassword || !this.passwordForm.newPassword || !this.passwordForm.confirmPassword) return false;
    if (!this.strongPasswordValid) return false;
    if (this.confirmPasswordMismatch) return false;
    return true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.resetState();
    }
  }

  close(): void {
    if (this.passwordSaving) return;
    this.visibleChange.emit(false);
  }

  submit(): void {
    this.passwordError = '';
    this.passwordSuccess = '';

    if (!this.passwordForm.currentPassword || !this.passwordForm.newPassword || !this.passwordForm.confirmPassword) {
      this.passwordError = 'Please fill all password fields.';
      return;
    }
    if (!this.strongPasswordValid) {
      this.passwordError = 'New password must include at least 8 characters, uppercase, lowercase, number, and special character.';
      return;
    }
    if (this.confirmPasswordMismatch) {
      this.passwordError = 'New password and confirm password do not match.';
      return;
    }

    this.passwordSaving = true;
    this.configService.changePassword(
      this.passwordForm.currentPassword,
      this.passwordForm.newPassword,
      this.passwordForm.confirmPassword,
    ).subscribe({
      next: (res: any) => {
        this.passwordSuccess = res?.data?.message || res?.message || 'Password changed successfully.';
        this.passwordSaving = false;
        this.passwordForm = {
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        };
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.passwordError = err?.error?.message || 'Failed to change password.';
        this.passwordSaving = false;
        this.cdr.detectChanges();
      },
    });
  }

  private resetState(): void {
    this.passwordError = '';
    this.passwordSuccess = '';
    this.passwordSaving = false;
    this.passwordForm = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    };
    this.passwordVisible = {
      current: false,
      next: false,
      confirm: false,
    };
  }

  togglePasswordVisibility(field: 'current' | 'next' | 'confirm'): void {
    this.passwordVisible[field] = !this.passwordVisible[field];
  }
}
