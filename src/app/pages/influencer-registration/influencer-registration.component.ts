import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import imageCompression from 'browser-image-compression';
import { Component, OnInit, NgZone } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidatorFn, AsyncValidatorFn } from '@angular/forms';
import { map, debounceTime, first } from 'rxjs/operators';
import { ConfigService } from '../../shared/config.service';
import { OtpService } from '../../shared/otp.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

export const atLeastOneContactRequired: ValidatorFn = (control: AbstractControl) => {
  if (!control || !control.value) return { required: true };
  const { whatsapp, email, call } = control.value;
  return whatsapp || email || call ? null : { required: true };
};

@Component({
  selector: 'app-influencer-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule],
  templateUrl: './influencer-registration.component.html',
  styleUrls: ['./influencer-registration.component.scss']
})
export class InfluencerRegistrationComponent implements OnInit {

  // --- New Social Media Platform UI ---
  platformForms: { [platformId: string]: any } = {};

  isPlatformSelected(platform: any): boolean {
    return !!this.platformForms[platform._id];
  }

  togglePlatform(platform: any) {
    if (this.isPlatformSelected(platform)) {
      this.removePlatformCard(platform);
    } else {
      if (!this.isPremiumPlan() && this.selectedPlatforms().length >= this.FREE_SOCIAL_PROFILE_LIMIT) return;
      this.platformForms[platform._id] = {
        handle: '',
        followersCount: '',
        tier: '',
        contentTypes: Object.fromEntries(
          (platform.contentTypes || []).map((ct: any) => [ct.name, { selected: false, price: '' }])
        )
      };
    }
    this.refreshStepCompletion();
  }

  removePlatformCard(platform: any) {
    delete this.platformForms[platform._id];
    this.refreshStepCompletion();
  }

  selectedPlatforms(): any[] {
    return (this.socialMediaList || []).filter(p => this.platformForms[p._id]);
  }

  getPlatformTotal(platform: any): number {
    const pf = this.platformForms[platform._id];
    if (!pf) return 0;
    let total = 0;
    for (const ctName in pf.contentTypes) {
      const ct = pf.contentTypes[ctName];
      if (ct.selected && ct.price) {
        total += Number(ct.price) || 0;
      }
    }
    return total;
  }

  getGrandTotal(): number {
    return this.selectedPlatforms().reduce((sum, p) => sum + this.getPlatformTotal(p), 0);
  }

  // --- Core properties ---
  readonly FREE_SOCIAL_PROFILE_LIMIT = 1;
  currentStep: 1 | 2 | 3 = 1;
  readonly totalSteps = 3;
  step1Complete = false;
  step2Complete = false;
  step3Complete = false;
  step2Attempted = false;
  emailVerificationSent = false;
  emailVerificationError: string | null = null;
  showPhoneOtp = false;
  showEmailOtp = false;
  phoneOtp: string[] = ['', '', '', '', '', ''];
  emailOtp: string[] = ['', '', '', '', '', ''];
  phoneVerified = false;
  emailVerified = false;
  showEmailVerificationPrompt = false;
  phoneVerifyError = '';
  emailVerifyError = '';
  phoneOtpTimer = 300;
  canResendPhoneOtp = false;
  verifyingPhoneOtp = false;
  phoneOtpError = '';
  private phoneOtpInterval: any;
  resendingEmailVerification = false;
  resendEmailVerificationSuccess = false;
  resendEmailVerificationError: string | null = null;
  pendingVerificationEmail = '';
  registrationSuccess = false;
  registrationError = '';
  preApproveActive = false;
  registrationForm!: FormGroup;
  states: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];
  profileImagePreview: string | null = null;
  profileImageFile: File | null = null;
  languagesList: any[] = [];
  categoriesList: any[] = [];
  submitted = false;
  usernameError = '';
  duplicateUsernameError = '';
  duplicateEmailError = '';
  duplicatePhoneError = '';
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private ngZone: NgZone,
    private otpService: OtpService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.registrationForm = this.fb.group({
      name: ['', Validators.required],
      username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]+$/)], [this.usernameUniqueValidator()]],
      phoneNumber: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required],
      paymentOption: ['free', Validators.required],
      location: this.fb.group({ state: ['', Validators.required] }),
      promotionalPrice: ['', Validators.required],
      languages: [[], Validators.required],
      categories: [[], Validators.required],
      profileImages: this.fb.array([]),
      contact: this.fb.group({
        whatsapp: [false], email: [false], call: [false]
      }, { validators: [atLeastOneContactRequired] }),
      website: [''],
    });

    this.registrationForm.get('username')?.valueChanges.subscribe(() => this.onUsernameInput());
    this.registrationForm.get('phoneNumber')?.valueChanges.subscribe(() => { this.duplicatePhoneError = ''; });
    this.registrationForm.get('email')?.valueChanges.subscribe(() => { this.duplicateEmailError = ''; });
    this.registrationForm.valueChanges.subscribe(() => {
      if (this.registrationSuccess && this.registrationForm.dirty) this.registrationSuccess = false;
      if (this.registrationError && this.registrationForm.dirty) this.registrationError = '';
    });

    this.configService.getStates().subscribe(data => this.states = data);
    this.configService.getTiers().subscribe(data => this.tiers = data);
    this.configService.getSocialMedia().subscribe(data => this.socialMediaList = data);
    this.configService.getLanguages().subscribe(data => this.languagesList = data);
    this.configService.getCategories().subscribe(data => this.categoriesList = data);
    this.configService.getAppSettings().subscribe(s => { this.preApproveActive = s.preApproveInfluencers; });

    this.registrationForm.get('paymentOption')?.valueChanges.subscribe(() => {
      this.enforcePlatformLimit();
      this.refreshStepCompletion();
    });
    this.registrationForm.valueChanges.subscribe(() => this.refreshStepCompletion());
    this.registrationForm.statusChanges.subscribe(() => this.refreshStepCompletion());
    this.refreshStepCompletion();
  }

  private enforcePlatformLimit() {
    if (this.isPremiumPlan()) return;
    const selected = this.selectedPlatforms();
    if (selected.length > this.FREE_SOCIAL_PROFILE_LIMIT) {
      selected.slice(this.FREE_SOCIAL_PROFILE_LIMIT).forEach(p => delete this.platformForms[p._id]);
    }
  }

  private refreshStepCompletion() {
    this.step1Complete = this.computeStepComplete(1);
    this.step2Complete = this.computeStepComplete(2);
    this.step3Complete = this.computeStepComplete(3);
  }

  isPremiumPlan(): boolean {
    return this.registrationForm?.get('paymentOption')?.value === 'premium';
  }

  private computeStepComplete(step: number): boolean {
    if (step === 1) {
      const f = this.registrationForm;
      return !!(f.get('name')?.valid && f.get('username')?.valid && f.get('phoneNumber')?.valid &&
        f.get('email')?.valid && f.get('password')?.valid && f.get('confirmPassword')?.valid);
    }
    if (step === 2) {
      const f = this.registrationForm;
      const detailsValid = !!(f.get('location.state')?.valid && f.get('languages')?.valid && f.get('categories')?.valid);
      return detailsValid && this.selectedPlatforms().length > 0 && !!this.profileImagePreview;
    }
    if (step === 3) {
      return !!(this.registrationForm.get('promotionalPrice')?.valid && this.registrationForm.get('contact')?.valid);
    }
    return false;
  }

  isStepComplete(step: number): boolean {
    if (step === 1) return this.step1Complete;
    if (step === 2) return this.step2Complete;
    if (step === 3) return this.step3Complete;
    return false;
  }

  goToStep(step: 1 | 2 | 3) {
    if (step < this.currentStep || this.canNavigateTo(step)) {
      this.currentStep = step;
      this.submitted = false;
      this.registrationError = '';
      if (step === 2) this.step2Attempted = false;
      this.refreshStepCompletion();
    }
  }

  private canNavigateTo(step: 1 | 2 | 3): boolean {
    if (step === 1) return true;
    if (step === 2) return this.isStepComplete(1);
    return this.isStepComplete(1) && this.isStepComplete(2);
  }

  nextStep() {
    if (!this.validateCurrentStep()) return;
    if (this.currentStep < this.totalSteps) {
      this.currentStep = (this.currentStep + 1) as 1 | 2 | 3;
      this.submitted = false;
      this.registrationError = '';
      if (this.currentStep === 2) this.step2Attempted = false;
      this.refreshStepCompletion();
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep = (this.currentStep - 1) as 1 | 2 | 3;
      this.submitted = false;
      this.registrationError = '';
      if (this.currentStep === 2) this.step2Attempted = false;
      this.refreshStepCompletion();
    }
  }

  private validateCurrentStep(): boolean {
    this.submitted = true;
    if (this.currentStep === 1) {
      ['name', 'username', 'phoneNumber', 'email', 'password', 'confirmPassword'].forEach(f =>
        this.registrationForm.get(f)?.markAsTouched());
      return this.isStepComplete(1);
    }
    if (this.currentStep === 2) {
      this.step2Attempted = true;
      this.registrationForm.get('location.state')?.markAsTouched();
      this.registrationForm.get('languages')?.markAsTouched();
      this.registrationForm.get('categories')?.markAsTouched();
      if (!this.profileImagePreview) { this.registrationError = 'Profile image is required.'; }
      else { this.registrationError = ''; }
      return this.isStepComplete(2);
    }
    if (this.currentStep === 3) {
      this.registrationForm.get('promotionalPrice')?.markAsTouched();
      this.registrationForm.get('contact')?.markAsTouched();
      return this.isStepComplete(3);
    }
    return false;
  }

  slugifyUsername(username: string): string {
    return username.toString().trim().toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '')
      .replace(/-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
  }

  onUsernameInput() {
    const ctrl = this.registrationForm.get('username');
    if (!ctrl) return;
    let value = ctrl.value || '';
    value = value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    ctrl.setValue(value, { emitEvent: false });
    this.usernameError = '';
    this.duplicateUsernameError = '';
  }

  usernameUniqueValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return Promise.resolve(null);
      return this.configService.checkUsernameExists(control.value).pipe(
        debounceTime(300), map((exists: boolean) => (exists ? { usernameTaken: true } : null)), first()
      );
    };
  }

  resendEmailVerification() {
    this.resendingEmailVerification = true;
    this.resendEmailVerificationSuccess = false;
    this.resendEmailVerificationError = null;
    const email = this.pendingVerificationEmail || this.registrationForm.get('email')?.value;
    if (!email) { this.resendingEmailVerification = false; this.resendEmailVerificationError = 'No email found.'; return; }
    this.configService.sendEmailVerificationLink(email).subscribe({
      next: () => { this.resendingEmailVerification = false; this.resendEmailVerificationSuccess = true; },
      error: (err: any) => { this.resendingEmailVerification = false; this.resendEmailVerificationError = err?.error?.message || 'Failed to resend.'; }
    });
  }

  resendPhoneOtp() { if (!this.canResendPhoneOtp) return; this.sendPhoneOtp(); this.startPhoneOtpTimer(); }

  startPhoneOtpTimer() {
    this.phoneOtpTimer = 300; this.canResendPhoneOtp = false;
    if (this.phoneOtpInterval) clearInterval(this.phoneOtpInterval);
    this.phoneOtpInterval = setInterval(() => { this.phoneOtpTimer--; if (this.phoneOtpTimer <= 0) clearInterval(this.phoneOtpInterval); }, 1000);
    setTimeout(() => this.canResendPhoneOtp = true, 30000);
  }

  sendPhoneOtp() {
    const phone = this.registrationForm.get('phoneNumber')?.value;
    this.otpService.sendOtp('phone', phone).subscribe({ next: () => { this.phoneVerifyError = ''; }, error: () => { this.phoneVerifyError = 'Failed to send OTP'; } });
    this.phoneOtpError = ''; this.startPhoneOtpTimer();
  }

  confirmPhoneOtp() {
    this.verifyingPhoneOtp = true; this.phoneOtpError = '';
    const phone = this.registrationForm.get('phoneNumber')?.value;
    this.otpService.verifyOtp('phone', phone, this.phoneOtp.join('')).subscribe({
      next: () => { this.phoneVerified = true; this.showPhoneOtp = false; this.phoneVerifyError = ''; },
      error: () => { this.phoneOtpError = 'Invalid or expired OTP.'; this.verifyingPhoneOtp = false; }
    });
  }

  sendEmailOtp() {
    const email = this.registrationForm.get('email')?.value;
    this.otpService.sendOtp('email', email).subscribe({ next: () => { this.emailVerifyError = ''; }, error: () => { this.emailVerifyError = 'Failed to send OTP'; } });
  }

  confirmEmailOtp() {
    const email = this.registrationForm.get('email')?.value;
    this.otpService.verifyOtp('email', email, this.emailOtp.join('')).subscribe({
      next: () => { this.emailVerified = true; this.showEmailOtp = false; this.emailVerifyError = ''; },
      error: () => { this.emailVerifyError = 'Invalid OTP'; }
    });
  }

  get profileImagesFormArray() { return this.registrationForm.get('profileImages') as FormArray; }

  async onProfileImageFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const compressedFile = await imageCompression(file, { maxSizeMB: 0.1, maxWidthOrHeight: 1024, useWebWorker: true });
      const reader = new FileReader();
      reader.onload = (e: any) => { this.ngZone.run(() => { this.profileImagePreview = e.target.result; this.profileImageFile = compressedFile; this.cdr.detectChanges(); this.refreshStepCompletion(); }); };
      reader.readAsDataURL(compressedFile);
    } catch {
      const reader = new FileReader();
      reader.onload = (e: any) => { this.ngZone.run(() => { this.profileImagePreview = e.target.result; this.profileImageFile = file; this.cdr.detectChanges(); this.refreshStepCompletion(); }); };
      reader.readAsDataURL(file);
    }
  }

  removeProfileImage(index: number) {
    if (this.profileImagesFormArray.length > index) this.profileImagesFormArray.removeAt(index);
    this.profileImagePreview = null; this.profileImageFile = null; this.refreshStepCompletion();
  }

  async onSubmit() {
    if (this.isSubmitting) return;
    this.submitted = true;
    this.duplicateUsernameError = ''; this.duplicateEmailError = ''; this.duplicatePhoneError = '';

    if (this.registrationForm.invalid || !this.profileImagePreview) {
      if (this.registrationForm.get('username')?.hasError('usernameTaken'))
        this.usernameError = 'Username already exists. Please choose another.';
      if (!this.profileImagePreview) this.registrationError = 'Profile image is required.';
      return;
    }

    this.isSubmitting = true; this.registrationError = ''; this.registrationSuccess = false;
    const raw = this.registrationForm.value;
    if (raw.username) raw.username = this.slugifyUsername(raw.username);

    const stateObj = this.states.find(s => s._id === raw.location.state);
    const languageNames = (raw.languages || []).map((id: string) => { const l = this.languagesList.find((x: any) => x._id === id); return l ? l.name : id; });
    const categoryNames = (raw.categories || []).map((id: string) => { const c = this.categoriesList.find((x: any) => x._id === id); return c ? c.name : id; });

    const socialMedia = this.selectedPlatforms().map(platform => {
      const pf = this.platformForms[platform._id];
      return {
        platform: platform.name,
        handle: pf.handle,
        followersCount: Number(pf.followersCount) || 0,
        tier: pf.tier,
        contentTypes: Object.entries(pf.contentTypes)
          .filter(([_, v]: any) => v.selected)
          .map(([name, v]: any) => ({ name, enabled: true, price: Number(v.price) || 0 }))
      };
    });

    let imageUploadResult: { url: string; public_id: string } | null = null;
    if (this.profileImageFile) {
      const fd = new FormData();
      fd.append('file', this.profileImageFile);
      fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      try {
        const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
        const data = await resp.json();
        if (data.secure_url && data.public_id) { imageUploadResult = { url: data.secure_url, public_id: data.public_id }; }
        else { this.registrationError = 'Profile image upload failed.'; this.isSubmitting = false; return; }
      } catch { this.registrationError = 'Profile image upload failed.'; this.isSubmitting = false; return; }
    }

    const payload: any = {
      ...raw,
      location: { state: stateObj ? stateObj.name : raw.location.state },
      languages: languageNames, categories: categoryNames,
      socialMedia, profileImages: imageUploadResult ? [imageUploadResult] : [], contact: raw.contact
    };

    this.configService.registerInfluencer(payload).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.registrationSuccess = true; this.pendingVerificationEmail = raw.email;
          this.showEmailVerificationPrompt = true; this.emailVerificationSent = true; this.emailVerificationError = null;
          this.registrationForm.reset(); this.profileImagePreview = null; this.profileImageFile = null;
          this.platformForms = {}; this.submitted = false; this.isSubmitting = false;
        });
      },
      error: err => {
        const msg = String(err?.error?.message || err?.message || '').toLowerCase();
        const dups: string[] = Array.isArray(err?.error?.duplicateFields) ? err.error.duplicateFields.map((f: any) => String(f).toLowerCase()) : [];
        if (dups.includes('username')) { this.duplicateUsernameError = 'Username already exists.'; this.registrationForm.get('username')?.setErrors({ duplicate: true }); }
        if (dups.includes('email')) { this.duplicateEmailError = 'Email already exists.'; this.registrationForm.get('email')?.setErrors({ duplicate: true }); }
        if (dups.includes('phonenumber') || dups.includes('phone') || dups.includes('mobile')) { this.duplicatePhoneError = 'Mobile number already exists.'; this.registrationForm.get('phoneNumber')?.setErrors({ duplicate: true }); }
        if (dups.length) { this.currentStep = 1; this.refreshStepCompletion(); this.isSubmitting = false; return; }
        if (msg.includes('username') && msg.includes('already exists')) { this.duplicateUsernameError = 'Username already exists.'; this.currentStep = 1; this.isSubmitting = false; return; }
        if (msg.includes('email') && msg.includes('already exists')) { this.duplicateEmailError = 'Email already exists.'; this.currentStep = 1; this.isSubmitting = false; return; }
        if ((msg.includes('phone') || msg.includes('mobile')) && msg.includes('already exists')) { this.duplicatePhoneError = 'Mobile number already exists.'; this.currentStep = 1; this.isSubmitting = false; return; }
        this.registrationError = err?.error?.message || 'Registration failed. Please try again.';
        this.refreshStepCompletion(); this.isSubmitting = false;
      }
    });
  }

  closeSuccessModal() {
    this.registrationSuccess = false; this.registrationForm.reset();
    this.profileImagePreview = null; this.profileImageFile = null;
    this.platformForms = {}; this.submitted = false; this.pendingVerificationEmail = '';
    window.location.href = '/login';
  }
}