import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../config.service';
import { SessionService } from '../../../core/session.service';
import { PushNotificationService } from '../../../core/push-notification.service';
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
  /** Forced change after logging in with an admin-issued temporary password: can't be dismissed. */
  @Input() required = false;
  /** Emitted once the password has been changed successfully. */
  @Output() changed = new EventEmitter<void>();

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

  private readonly push = inject(PushNotificationService);

  constructor(
    private configService: ConfigService,
    private cdr: ChangeDetectorRef,
    private session: SessionService,
  ) {}

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
    if (this.passwordSaving || this.required) return;
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
        // Changing the password signs out every other session; keep this one with the new token.
        const freshToken = res?.token || res?.data?.token;
        if (freshToken) this.session.setToken(freshToken);
        // The server forgets every push device on a password change; re-attach
        // this one silently if notifications were already allowed here.
        if (this.push.localPreference !== 'disabled' && this.push.browserPermission === 'granted') {
          const role = String((this.session.getUser() as any)?.role || '').toLowerCase();
          this.push.requestSubscription(role === 'brand' || role === 'admin' || role === 'photographer' ? role : 'influencer');
        }
        this.passwordSuccess = res?.data?.message || res?.message || 'Password changed successfully.';
        this.passwordSaving = false;
        this.passwordForm = {
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        };
        this.changed.emit();
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
