import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  Auth,
  ConfirmationResult,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  getAuth,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
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
    await sendEmailVerification(user);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.getFirebaseAuth(), email);
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
}
