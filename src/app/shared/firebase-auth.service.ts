import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  Auth,
  ConfirmationResult,
  RecaptchaVerifier,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  getAuth,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
  type User,
} from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

type FirebaseContactType = 'email' | 'phone';

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private recaptchaVerifier: RecaptchaVerifier | null = null;

  constructor(
    private readonly http: HttpClient,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  isConfigured(): boolean {
    const config = environment.firebase;
    return !!(config?.apiKey && config?.projectId && config?.appId);
  }

  getFirebaseAuthErrorMessage(error: any): string {
    const code = String(error?.code || '').trim();
    if (code === 'auth/unauthorized-continue-uri') {
      return 'Firebase rejected the verification link domain. Add the live domain to Firebase Auth authorized domains.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Firebase Email/Password sign-in is not enabled for this project.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Firebase temporarily blocked email sending because of too many requests. Please try again later.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'A Firebase account already exists for this email, but the password does not match. Please use Forgot Password.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'A Firebase account already exists for this email. Please use Forgot Password or resend verification from support.';
    }
    if (code) {
      return `Firebase verification email failed (${code}).`;
    }
    return error?.message || 'Firebase verification email could not be sent.';
  }

  private assertBrowser(): void {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Firebase Auth is only available in the browser.');
    }
  }

  private getFirebaseAuth(): Auth {
    this.assertBrowser();
    if (!this.isConfigured()) {
      throw new Error('Firebase is not configured.');
    }
    if (!this.app) {
      this.app = getApps().length ? getApp() : initializeApp(environment.firebase);
    }
    if (!this.auth) {
      this.auth = getAuth(this.app);
    }
    return this.auth;
  }

  async sendVerificationEmail(email: string, password: string): Promise<void> {
    const auth = this.getFirebaseAuth();
    let user: User;
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      user = credential.user;
    } catch (error: any) {
      if (error?.code !== 'auth/email-already-in-use') throw error;
      const credential = await signInWithEmailAndPassword(auth, email, password);
      user = credential.user;
    }
    const actionCodeSettings = isPlatformBrowser(this.platformId)
      ? {
          url: `${window.location.origin}/verify-email?firebaseEmail=${encodeURIComponent(email)}`,
        }
      : undefined;
    await sendEmailVerification(user, actionCodeSettings);
  }

  // async sendPasswordReset(email: string): Promise<void> {
  //   const canSend = await this.ensurePasswordResetUser(email);
  //   if (!canSend) return;
  //   const actionCodeSettings = isPlatformBrowser(this.platformId)
  //     ? {
  //         url: `${window.location.origin}/reset-password?firebaseReset=true`,
  //         // handleCodeInApp: true,
  //       }
  //     : undefined;
  //   await sendPasswordResetEmail(this.getFirebaseAuth(), email, actionCodeSettings);
  // }

  async sendPasswordReset(email: string): Promise<void> {
    const canSend =
    await this.ensurePasswordResetUser(email);

    if (!canSend) return;

    const actionCodeSettings =
      isPlatformBrowser(this.platformId)
        ? {
            url: `${window.location.origin}/reset-password?firebaseReset=true`,
            handleCodeInApp: true,
          }
        : undefined;

    await sendPasswordResetEmail(
      this.getFirebaseAuth(),
      email,
      actionCodeSettings
    );
  }

  async verifyPasswordResetCode(oobCode: string): Promise<string> {
    return verifyPasswordResetCode(this.getFirebaseAuth(), oobCode);
  }

  async completePasswordReset(oobCode: string, newPassword: string): Promise<any> {
    const auth = this.getFirebaseAuth();
    const email = await verifyPasswordResetCode(auth, oobCode);
    await confirmPasswordReset(auth, oobCode, newPassword);
    const credential = await signInWithEmailAndPassword(auth, email, newPassword);
    const idToken = await credential.user.getIdToken(true);
    return firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/auth/firebase/complete-password-reset`, {
        idToken,
        newPassword,
      }),
    );
  }

  setupPhoneRecaptcha(containerId: string): RecaptchaVerifier {
    const auth = this.getFirebaseAuth();
    if (this.recaptchaVerifier) {
      this.recaptchaVerifier.clear();
    }
    this.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
    });
    return this.recaptchaVerifier;
  }

  async sendPhoneOtp(phoneNumber: string, containerId: string): Promise<ConfirmationResult> {
    const { signInWithPhoneNumber } = await import('firebase/auth');
    return signInWithPhoneNumber(
      this.getFirebaseAuth(),
      phoneNumber,
      this.setupPhoneRecaptcha(containerId),
    );
  }

  async confirmPhoneOtp(confirmation: ConfirmationResult, otp: string): Promise<any> {
    const credential = await confirmation.confirm(otp);
    const idToken = await credential.user.getIdToken(true);
    return this.verifyContactWithBackend(idToken, 'phone');
  }

  async syncCurrentEmailVerification(): Promise<any> {
    const user = this.getFirebaseAuth().currentUser;
    if (!user) throw new Error('No Firebase user is signed in.');
    await reload(user);
    if (!user.emailVerified) {
      throw new Error('Firebase email is not verified yet.');
    }
    const idToken = await user.getIdToken(true);
    return this.verifyContactWithBackend(idToken, 'email');
  }

  async syncEmailVerificationForLogin(email: string, password: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const auth = this.getFirebaseAuth();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;
    await reload(user);
    if (!user.emailVerified) return false;
    const idToken = await user.getIdToken(true);
    await this.verifyContactWithBackend(idToken, 'email');
    return true;
  }

  async getVerifiedLoginIdToken(email: string, password: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const auth = this.getFirebaseAuth();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;
    await reload(user);
    if (!user.emailVerified) return null;
    return user.getIdToken(true);
  }

  async signOutFirebase(): Promise<void> {
    await signOut(this.getFirebaseAuth());
  }

  private verifyContactWithBackend(idToken: string, type: FirebaseContactType): Promise<any> {
    return firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/auth/firebase/verify-contact`, {
        idToken,
        type,
      }),
    );
  }

  private async ensurePasswordResetUser(email: string): Promise<boolean> {
    try {
      const result: any = await firstValueFrom(
        this.http.post(`${environment.apiBaseUrl}/auth/firebase/ensure-password-reset-user`, { email }),
      );
      return result?.canSendFirebaseReset !== false;
    } catch {
      return true;
    }
  }
}
