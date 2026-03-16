  // ...existing code...
import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import imageCompression from 'browser-image-compression';
import { Component, OnInit, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidatorFn, AsyncValidatorFn } from '@angular/forms';
import { map, debounceTime, switchMap, first } from 'rxjs/operators';
import { ConfigService } from '../../shared/config.service';
import { OtpService } from '../../shared/otp.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

// Custom validator to require at least one contact option
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
  // MVP rollout switch: update this later when business rules change.
  readonly FREE_SOCIAL_PROFILE_LIMIT = 1;
  currentStep: 1 | 2 | 3 = 1;
  readonly totalSteps = 3;
  step1Complete: boolean = false;
  step2Complete: boolean = false;
  step3Complete: boolean = false;
  step2Attempted: boolean = false;
  emailVerificationSent: boolean = false;
  emailVerificationError: string | null = null;
  // OTP dialog/expand state
  showPhoneOtp: boolean = false;
  showEmailOtp: boolean = false;
  phoneOtp: string[] = ['', '', '', '', '', ''];
  emailOtp: string[] = ['', '', '', '', '', ''];

  // Phone/email verification status and error
  phoneVerified: boolean = false;
  emailVerified: boolean = false;
  showEmailVerificationPrompt: boolean = false;
  phoneVerifyError: string = '';
  emailVerifyError: string = '';

  phoneOtpTimer: number = 300;
  canResendPhoneOtp: boolean = false;
  verifyingPhoneOtp: boolean = false;
  phoneOtpError: string = '';
  private phoneOtpInterval: any;


  // ...existing code...

  // Email verification resend state
  resendingEmailVerification: boolean = false;
  resendEmailVerificationSuccess: boolean = false;
  resendEmailVerificationError: string | null = null;
  pendingVerificationEmail: string = '';

  resendEmailVerification() {
    this.resendingEmailVerification = true;
    this.resendEmailVerificationSuccess = false;
    this.resendEmailVerificationError = null;
    const email = this.pendingVerificationEmail || this.registrationForm.get('email')?.value;
    if (!email) {
      this.resendingEmailVerification = false;
      this.resendEmailVerificationError = 'No email found for verification resend.';
      return;
    }
    this.configService.sendEmailVerificationLink(email).subscribe({
      next: () => {
        this.resendingEmailVerification = false;
        this.resendEmailVerificationSuccess = true;
      },
      error: (err: any) => {
        this.resendingEmailVerification = false;
        this.resendEmailVerificationError = err?.error?.message || 'Failed to resend verification email.';
      }
    });
  }
  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private ngZone: NgZone,
    private otpService: OtpService
  ) {}

  resendPhoneOtp() {
    if (!this.canResendPhoneOtp) return;
    this.sendPhoneOtp();
    this.startPhoneOtpTimer();
  }

  startPhoneOtpTimer() {
    this.phoneOtpTimer = 300;
    this.canResendPhoneOtp = false;
    if (this.phoneOtpInterval) clearInterval(this.phoneOtpInterval);
    this.phoneOtpInterval = setInterval(() => {
      this.phoneOtpTimer--;
      if (this.phoneOtpTimer <= 0) {
        clearInterval(this.phoneOtpInterval);
      }
    }, 1000);
    setTimeout(() => this.canResendPhoneOtp = true, 30000);
  }

  sendPhoneOtp() {
    const phone = this.registrationForm.get('phoneNumber')?.value;
    this.otpService.sendOtp('phone', phone).subscribe({
      next: () => { this.phoneVerifyError = ''; },
      error: () => { this.phoneVerifyError = 'Failed to send OTP'; }
    });
    this.phoneOtpError = '';
    this.startPhoneOtpTimer();
  }
  confirmPhoneOtp() {
    this.verifyingPhoneOtp = true;
    this.phoneOtpError = '';
    const phone = this.registrationForm.get('phoneNumber')?.value;
    const otp = this.phoneOtp.join('');
    this.otpService.verifyOtp('phone', phone, otp).subscribe({
      next: () => { this.phoneVerified = true; this.showPhoneOtp = false; this.phoneVerifyError = ''; },
      error: () => { this.phoneOtpError = 'Invalid or expired OTP.'; this.verifyingPhoneOtp = false; }
    });
  }
  sendEmailOtp() {
    const email = this.registrationForm.get('email')?.value;
    this.otpService.sendOtp('email', email).subscribe({
      next: () => { this.emailVerifyError = ''; },
      error: () => { this.emailVerifyError = 'Failed to send OTP'; }
    });
  }
  confirmEmailOtp() {
    const email = this.registrationForm.get('email')?.value;
    const otp = this.emailOtp.join('');
    this.otpService.verifyOtp('email', email, otp).subscribe({
      next: () => { this.emailVerified = true; this.showEmailOtp = false; this.emailVerifyError = ''; },
      error: () => { this.emailVerifyError = 'Invalid OTP'; }
    });
  }
  registrationSuccess = false;
  registrationError = '';
  registrationForm!: FormGroup;
  states: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];

  profileImagePreview: string | null = null;
  profileImageFile: File | null = null;
  languagesList: any[] = [];
  categoriesList: any[] = [];
  submitted = false;
  usernameError: string = '';
  duplicateUsernameError: string = '';
  duplicateEmailError: string = '';
  duplicatePhoneError: string = '';
  isSubmitting: boolean = false;

  // Utility to slugify username
  slugifyUsername(username: string): string {
    return username
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  ngOnInit() {
    // Initialize the form first
    this.registrationForm = this.fb.group({
      name: ['', Validators.required],
      username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]+$/)], [this.usernameUniqueValidator()]],
      phoneNumber: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required],
      paymentOption: ['free', Validators.required],
      location: this.fb.group({
        state: ['', Validators.required]
      }),
      promotionalPrice: ['', Validators.required],
      languages: [[], Validators.required],
      categories: [[], Validators.required],
      profileImages: this.fb.array([]),
      socialMedia: this.fb.array([
        this.fb.group({
          platform: ['', Validators.required],
          handle: ['', Validators.required],
          tier: ['', Validators.required],
          followersCount: ['', Validators.required]
        })
      ]),
      contact: this.fb.group({
        whatsapp: [false],
        email: [false],
        call: [false]
      }, { validators: [atLeastOneContactRequired] }),
    });

    // Listen for username changes to sanitize and clear error
    this.registrationForm.get('username')?.valueChanges.subscribe(() => this.onUsernameInput());
    this.registrationForm.get('phoneNumber')?.valueChanges.subscribe(() => {
      this.duplicatePhoneError = '';
    });
    this.registrationForm.get('email')?.valueChanges.subscribe(() => {
      this.duplicateEmailError = '';
    });
    // Only reset success/error flags if the form is dirty and success is showing
    this.registrationForm.valueChanges.subscribe(() => {
      if (this.registrationSuccess && this.registrationForm.dirty) {
        this.registrationSuccess = false;
      }
      if (this.registrationError && this.registrationForm.dirty) {
        this.registrationError = '';
      }
    });
    // Fetch dropdown data from API
    this.configService.getStates().subscribe(data => this.states = data);
    this.configService.getTiers().subscribe(data => this.tiers = data);
    this.configService.getSocialMedia().subscribe(data => this.socialMediaList = data);
    this.configService.getLanguages().subscribe(data => this.languagesList = data);
    this.configService.getCategories().subscribe(data => this.categoriesList = data);

    this.registrationForm.get('paymentOption')?.valueChanges.subscribe(() => {
      this.enforceSocialProfileLimit();
      this.refreshStepCompletion();
    });

    this.registrationForm.valueChanges.subscribe(() => this.refreshStepCompletion());
    this.registrationForm.statusChanges.subscribe(() => this.refreshStepCompletion());

    this.enforceSocialProfileLimit();
    this.applySocialMediaValidators();
    this.refreshStepCompletion();
  }

  private refreshStepCompletion() {
    this.step1Complete = this.computeStepComplete(1);
    this.step2Complete = this.computeStepComplete(2);
    this.step3Complete = this.computeStepComplete(3);
  }

  isPremiumPlan(): boolean {
    return this.registrationForm.get('paymentOption')?.value === 'premium';
  }

  canAddSocialMedia(): boolean {
    return this.isPremiumPlan() || this.socialMediaFormArray.length < this.FREE_SOCIAL_PROFILE_LIMIT;
  }

  private enforceSocialProfileLimit() {
    if (this.isPremiumPlan()) {
      return;
    }

    while (this.socialMediaFormArray.length > this.FREE_SOCIAL_PROFILE_LIMIT) {
      this.socialMediaFormArray.removeAt(this.socialMediaFormArray.length - 1);
    }
  }

  private applySocialMediaValidators() {
    this.socialMediaFormArray.controls.forEach((group) => {
      const platform = group.get('platform');
      const handle = group.get('handle');
      const tier = group.get('tier');
      const followersCount = group.get('followersCount');

      platform?.setValidators([Validators.required]);
      handle?.setValidators([Validators.required]);
      tier?.setValidators([Validators.required]);
      followersCount?.setValidators([Validators.required]);

      platform?.updateValueAndValidity({ emitEvent: false });
      handle?.updateValueAndValidity({ emitEvent: false });
      tier?.updateValueAndValidity({ emitEvent: false });
      followersCount?.updateValueAndValidity({ emitEvent: false });
    });
  }

  private computeStepComplete(step: number): boolean {
    if (step === 1) {
      const f = this.registrationForm;
      return !!(
        f.get('name')?.valid &&
        f.get('username')?.valid &&
        f.get('phoneNumber')?.valid &&
        f.get('email')?.valid &&
        f.get('password')?.valid &&
        f.get('confirmPassword')?.valid
      );
    }
    if (step === 2) {
      const f = this.registrationForm;
      const detailsValid = !!(
        f.get('paymentOption')?.valid &&
        f.get('location.state')?.valid &&
        f.get('languages')?.valid &&
        f.get('categories')?.valid
      );
      if (!detailsValid) {
        return false;
      }
      return this.socialMediaFormArray.valid && !!this.profileImagePreview;
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
      if (step === 2) {
        this.step2Attempted = false;
      }
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
      if (this.currentStep === 2) {
        this.step2Attempted = false;
      }
      this.refreshStepCompletion();
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep = (this.currentStep - 1) as 1 | 2 | 3;
      this.submitted = false;
      this.registrationError = '';
      if (this.currentStep === 2) {
        this.step2Attempted = false;
      }
      this.refreshStepCompletion();
    }
  }

  private validateCurrentStep(): boolean {
    this.submitted = true;

    if (this.currentStep === 1) {
      this.registrationForm.get('name')?.markAsTouched();
      this.registrationForm.get('username')?.markAsTouched();
      this.registrationForm.get('phoneNumber')?.markAsTouched();
      this.registrationForm.get('email')?.markAsTouched();
      this.registrationForm.get('password')?.markAsTouched();
      this.registrationForm.get('confirmPassword')?.markAsTouched();
      return this.isStepComplete(1);
    }

    if (this.currentStep === 2) {
      this.step2Attempted = true;
      this.enforceSocialProfileLimit();
      this.registrationForm.get('paymentOption')?.markAsTouched();
      this.registrationForm.get('location.state')?.markAsTouched();
      this.registrationForm.get('languages')?.markAsTouched();
      this.registrationForm.get('categories')?.markAsTouched();
      this.socialMediaFormArray.markAllAsTouched();
      if (!this.profileImagePreview) {
        this.registrationError = 'Profile image is required.';
      } else {
        this.registrationError = '';
      }
      return this.isStepComplete(2);
    }

    if (this.currentStep === 3) {
      this.registrationForm.get('promotionalPrice')?.markAsTouched();
      this.registrationForm.get('contact')?.markAsTouched();
      return this.isStepComplete(3);
    }

    return false;
  }
  // Sanitize username input (replace spaces with hyphens, remove invalid chars)
  onUsernameInput() {
    const ctrl = this.registrationForm.get('username');
    if (!ctrl) return;
    let value = ctrl.value || '';
    value = value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    ctrl.setValue(value, { emitEvent: false });
    this.usernameError = '';
    this.duplicateUsernameError = '';
  }

  // Async validator to check username uniqueness
  usernameUniqueValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return Promise.resolve(null);
      return this.configService.checkUsernameExists(control.value).pipe(
        debounceTime(300),
        map((exists: boolean) => (exists ? { usernameTaken: true } : null)),
        first()
      );
    };
  }

  get profileImagesFormArray() {
    return this.registrationForm.get('profileImages') as FormArray;
  }



  // Only allow 1 image for now (can extend for premium)

  async onProfileImageFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    // Only compress and preview locally, do not upload yet
    const options = {
      maxSizeMB: 0.1, // Target max size (100 KB)
      maxWidthOrHeight: 1024, // Resize if larger than 1024px
      useWebWorker: true
    };
    try {
      const compressedFile = await imageCompression(file, options);
      // Generate local preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profileImagePreview = e.target.result;
        this.profileImageFile = compressedFile;
        this.refreshStepCompletion();
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Image compression error:', error);
    }
  }

  removeProfileImage(index: number) {
    if (this.profileImagesFormArray.length > index) {
      this.profileImagesFormArray.removeAt(index);
    }
    this.profileImagePreview = null;
    this.profileImageFile = null;
    this.refreshStepCompletion();
  }

    goToPayment() {
      // Save form if needed, then redirect to payment page
      window.location.href = '/payment';
    }

  get socialMediaFormArray() {
    return this.registrationForm.get('socialMedia') as FormArray;
  }

  addSocialMedia() {
    if (!this.canAddSocialMedia()) {
      return;
    }

    this.socialMediaFormArray.push(this.fb.group({
      platform: ['', Validators.required],
      handle: ['', Validators.required],
      tier: ['', Validators.required],
      followersCount: ['', Validators.required]
    }));
    this.applySocialMediaValidators();
  }

  removeSocialMedia(index: number) {
    if (this.socialMediaFormArray.length > 1) {
      this.socialMediaFormArray.removeAt(index);
    }
  }



  async onSubmit() {
    if (this.isSubmitting) {
      return;
    }

    this.submitted = true;
    this.duplicateUsernameError = '';
    this.duplicateEmailError = '';
    this.duplicatePhoneError = '';
    if (this.registrationForm.invalid || !this.profileImagePreview) {
      if (this.registrationForm.get('username')?.hasError('usernameTaken')) {
        this.usernameError = 'Username already exists. Please choose another.';
      }
      if (!this.profileImagePreview) {
        this.registrationError = 'Profile image is required.';
      }
      return;
    }
    this.isSubmitting = true;
    this.registrationError = '';
    // Submit registration and handle response
    // ...existing code for registration submission...
    // Example:
    // this.registrationService.registerInfluencer(this.registrationForm.value).subscribe({
    //   next: (user) => {
    //     this.registrationSuccess = true;
    //     this.emailVerified = user.isEmailVerified;
    //     this.showEmailVerificationPrompt = !user.isEmailVerified;
    //   },
    //   error: (err) => {
    //     this.registrationError = err.message || 'Registration failed.';
    //   }
    // });
    // ...existing code...
    this.registrationSuccess = false;
    const raw = this.registrationForm.value;
    // Always slugify username before saving
    if (raw.username) {
      raw.username = this.slugifyUsername(raw.username);
    }
    // Map state ID to name
    const stateObj = this.states.find(s => s._id === raw.location.state);
    // Map language IDs to names
    const languageNames = (raw.languages || []).map((id: string) => {
      const lang = this.languagesList.find((l: any) => l._id === id);
      return lang ? lang.name : id;
    });
    // Map category IDs to names
    const categoryNames = (raw.categories || []).map((id: string) => {
      const cat = this.categoriesList.find((c: any) => c._id === id);
      return cat ? cat.name : id;
    });
    // MVP: allow social media for all users (free + premium).
    // Free users: limited by FREE_SOCIAL_PROFILE_LIMIT.
    // Premium users: multiple profiles allowed.
    const socialLimit = this.isPremiumPlan() ? Number.MAX_SAFE_INTEGER : this.FREE_SOCIAL_PROFILE_LIMIT;
    const socialMedia = (raw.socialMedia || [])
      .filter((sm: any) => sm?.platform && sm?.handle && sm?.tier && sm?.followersCount !== '' && sm?.followersCount !== null)
      .slice(0, socialLimit)
      .map((sm: any) => {
        const platformObj = this.socialMediaList.find((s: any) => s._id === sm.platform);
        return {
          ...sm,
          platform: platformObj ? platformObj.name : sm.platform,
          followersCount: Number(sm.followersCount)
        };
      });
    // Step 1: Upload image to Cloudinary if selected
    let imageUploadResult: { url: string, public_id: string } | null = null;
    if (this.profileImageFile) {
      const formData = new FormData();
      formData.append('file', this.profileImageFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (data.secure_url && data.public_id) {
          imageUploadResult = { url: data.secure_url, public_id: data.public_id };
        } else {
          this.registrationError = 'Profile image upload failed.';
          this.isSubmitting = false;
          return;
        }
      } catch (err) {
        this.registrationError = 'Profile image upload failed.';
        this.isSubmitting = false;
        return;
      }
    }
    // Step 2: Register influencer with image info
    const payload: any = {
      ...raw,
      location: {
        state: stateObj ? stateObj.name : raw.location.state
      },
      promotionalPrice: raw.promotionalPrice,
      languages: languageNames,
      categories: categoryNames,
      socialMedia,
      profileImages: imageUploadResult ? [imageUploadResult] : [],
      contact: raw.contact
    };
    this.configService.registerInfluencer(payload).subscribe({
      next: (savedInfluencer) => {
        this.ngZone.run(() => {
          this.registrationSuccess = true;
          this.pendingVerificationEmail = raw.email;
          this.showEmailVerificationPrompt = true;
          this.emailVerificationSent = true;
          this.emailVerificationError = null;
          this.registrationForm.reset();
          this.profileImagePreview = null;
          this.profileImageFile = null;
          this.submitted = false;
          this.isSubmitting = false;
        });
      },
      error: err => {
        const backendMessage = String(err?.error?.message || err?.message || '').toLowerCase();
        const duplicateFields: string[] = Array.isArray(err?.error?.duplicateFields)
          ? err.error.duplicateFields.map((f: any) => String(f).toLowerCase())
          : [];

        if (duplicateFields.length) {
          if (duplicateFields.includes('username')) {
            this.duplicateUsernameError = 'Username already exists. Please choose another.';
            this.registrationForm.get('username')?.setErrors({ ...(this.registrationForm.get('username')?.errors || {}), duplicate: true });
          }
          if (duplicateFields.includes('email')) {
            this.duplicateEmailError = 'Email already exists. Please use another email or login.';
            this.registrationForm.get('email')?.setErrors({ ...(this.registrationForm.get('email')?.errors || {}), duplicate: true });
          }
          if (duplicateFields.includes('phonenumber') || duplicateFields.includes('phone') || duplicateFields.includes('mobile')) {
            this.duplicatePhoneError = 'Mobile number already exists. Please use another number.';
            this.registrationForm.get('phoneNumber')?.setErrors({ ...(this.registrationForm.get('phoneNumber')?.errors || {}), duplicate: true });
          }
          this.currentStep = 1;
          this.refreshStepCompletion();
          this.isSubmitting = false;
          return;
        }

        if (backendMessage.includes('username') && backendMessage.includes('already exists')) {
          this.duplicateUsernameError = 'Username already exists. Please choose another.';
          this.registrationForm.get('username')?.setErrors({ ...(this.registrationForm.get('username')?.errors || {}), duplicate: true });
          this.currentStep = 1;
          this.isSubmitting = false;
          return;
        }

        if (backendMessage.includes('email') && backendMessage.includes('already exists')) {
          this.duplicateEmailError = 'Email already exists. Please use another email or login.';
          this.registrationForm.get('email')?.setErrors({ ...(this.registrationForm.get('email')?.errors || {}), duplicate: true });
          this.currentStep = 1;
          this.isSubmitting = false;
          return;
        }

        if ((backendMessage.includes('phone') || backendMessage.includes('phonenumber') || backendMessage.includes('mobile')) && backendMessage.includes('already exists')) {
          this.duplicatePhoneError = 'Mobile number already exists. Please use another number.';
          this.registrationForm.get('phoneNumber')?.setErrors({ ...(this.registrationForm.get('phoneNumber')?.errors || {}), duplicate: true });
          this.currentStep = 1;
          this.refreshStepCompletion();
          this.isSubmitting = false;
          return;
        }

        this.registrationError = err?.error?.message || 'Registration failed. Please try again.';
        this.refreshStepCompletion();
        this.isSubmitting = false;
      }
    });
  }

  // Add a method to close the modal and reset the form
  closeSuccessModal() {
  this.registrationSuccess = false;
  this.registrationForm.reset();
  this.profileImagePreview = null;
  this.profileImageFile = null;
  this.submitted = false;
  this.pendingVerificationEmail = '';
  }


}
