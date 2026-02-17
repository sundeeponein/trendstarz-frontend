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
  // OTP dialog/expand state
  showPhoneOtp: boolean = false;
  showEmailOtp: boolean = false;
  phoneOtp: string[] = ['', '', '', '', '', ''];
  emailOtp: string[] = ['', '', '', '', '', ''];

  // Phone/email verification status and error
  phoneVerified: boolean = false;
  emailVerified: boolean = false;
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

  resendEmailVerification() {
    this.resendingEmailVerification = true;
    this.resendEmailVerificationSuccess = false;
    this.resendEmailVerificationError = null;
    const email = this.registrationForm.get('email')?.value;
    this.otpService.sendOtp('email', email).subscribe({
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
  }
  // Sanitize username input (replace spaces with hyphens, remove invalid chars)
  onUsernameInput() {
    const ctrl = this.registrationForm.get('username');
    if (!ctrl) return;
    let value = ctrl.value || '';
    value = value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    ctrl.setValue(value, { emitEvent: false });
    this.usernameError = '';
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
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Image compression error:', error);
    }
  }

  removeProfileImage(index: number) {
    this.profileImagesFormArray.removeAt(index);
  }

    goToPayment() {
      // Save form if needed, then redirect to payment page
      window.location.href = '/payment';
    }

  get socialMediaFormArray() {
    return this.registrationForm.get('socialMedia') as FormArray;
  }

  addSocialMedia() {
    this.socialMediaFormArray.push(this.fb.group({
      platform: ['', Validators.required],
      handle: ['', Validators.required],
      tier: ['', Validators.required],
      followersCount: ['', Validators.required]
    }));
  }

  removeSocialMedia(index: number) {
    if (this.socialMediaFormArray.length > 1) {
      this.socialMediaFormArray.removeAt(index);
    }
  }



  async onSubmit() {
    this.submitted = true;
    if (this.registrationForm.invalid || !this.profileImagePreview) {
      if (this.registrationForm.get('username')?.hasError('usernameTaken')) {
        this.usernameError = 'Username already exists. Please choose another.';
      }
      if (!this.profileImagePreview) {
        this.registrationError = 'Profile image is required.';
      }
      return;
    }
    this.registrationError = '';
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
    // Map social media platform ID to name
    const socialMedia = (raw.socialMedia || []).map((sm: any) => {
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
          return;
        }
      } catch (err) {
        this.registrationError = 'Profile image upload failed.';
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
          this.registrationForm.reset();
          this.profileImagePreview = null;
          this.profileImageFile = null;
          this.submitted = false;
        });
      },
      error: err => {
        if (err?.error?.message && err.error.message.includes('already exists')) {
          this.registrationError = err.error.message;
        } else {
          this.registrationError = 'Registration failed. Please try again.';
        }
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
  }


}
