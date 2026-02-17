import { environment } from '../../../environments/environment';
// Cloudinary configuration from Angular environment
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
// ...existing code...
import imageCompression from 'browser-image-compression';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { AbstractControl, ValidatorFn } from '@angular/forms';
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
  selector: 'app-brand-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule],
  templateUrl: './brand-registration.component.html',
  styleUrls: ['./brand-registration.component.scss']
})
 
export class BrandRegistrationComponent implements OnInit {
  // OTP dialog/expand state
  showPhoneOtp: boolean = false;
  showEmailOtp: boolean = false;
  phoneOtp: string[] = ['', '', '', '', '', ''];
  emailOtp: string[] = ['', '', '', '', '', ''];

  phoneOtpTimer: number = 300;
  canResendPhoneOtp: boolean = false;
  verifyingPhoneOtp: boolean = false;
  phoneOtpError: string = '';
  private phoneOtpInterval: any;

  // Email verification resend state
  resendingEmailVerification: boolean = false;
  resendEmailVerificationSuccess: boolean = false;
  resendEmailVerificationError: string = '';

  constructor(
    public fb: FormBuilder,
    private configService: ConfigService,
    private otpService: OtpService
  ) {}
  resendEmailVerification() {
    this.resendingEmailVerification = true;
    this.resendEmailVerificationSuccess = false;
    this.resendEmailVerificationError = '';
    const email = this.registrationForm.get('email')?.value;
    if (!email) {
      this.resendingEmailVerification = false;
      this.resendEmailVerificationError = 'Email is required.';
      return;
    }
    this.otpService.sendOtp('email', email).subscribe({
      next: () => {
        this.resendingEmailVerification = false;
        this.resendEmailVerificationSuccess = true;
        this.resendEmailVerificationError = '';
      },
      error: () => {
        this.resendingEmailVerification = false;
        this.resendEmailVerificationSuccess = false;
        this.resendEmailVerificationError = 'Failed to send verification email.';
      }
    });
  }

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
  // Username error for brand
  brandUsernameError: string = '';

  // Phone/email verification status and error
  phoneVerified: boolean = false;
  emailVerified: boolean = false;
  phoneVerifyError: string = '';
  emailVerifyError: string = '';

  // Stub verification methods
  verifyPhone() {
    // TODO: Implement phone verification logic
    // For now, just mark as verified
    this.phoneVerified = true;
    this.phoneVerifyError = '';
  }

  verifyEmail() {
    // TODO: Implement email verification logic
    // For now, just mark as verified
    this.emailVerified = true;
    this.emailVerifyError = '';
  }
  get socialMediaFormArray(): FormArray {
    return this.registrationForm.get('socialMedia') as FormArray;
  }

  removeSocialMedia(index: number) {
    if (this.socialMediaFormArray.length > 1) {
      this.socialMediaFormArray.removeAt(index);
    }
  }
  addSocialMedia() {
    (this.registrationForm.get('socialMedia') as FormArray).push(
      this.fb.group({
        platform: ['', Validators.required],
        handle: ['', Validators.required],
        tier: ['', Validators.required],
        followersCount: ['', Validators.required]
      })
    );
  }
  ngOnInit(): void {
    // Initialize the registration form and fetch any required data here
    this.registrationForm = this.fb.group({
      brandName: ['', Validators.required],
      brandUsername: ['', [Validators.required, Validators.pattern('^[a-zA-Z0-9-]+$')]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      isPremium: [false],
      paymentOption: ['', Validators.required],
      location: this.fb.group({
        state: ['', Validators.required],
        googleMapLink: ['']
      }),
      promotionalPrice: ['', Validators.required],
      categories: [[], Validators.required],
      languages: [[], Validators.required],
      website: [''],
      googleMapAddress: [''],
      brandLogo: this.fb.array([]),
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

    // Fetch dropdown data from API
    this.configService.getStates().subscribe(data => this.states = data);
    this.configService.getTiers().subscribe(data => this.tiers = data);
    this.configService.getSocialMedia().subscribe(data => this.socialMediaList = data);
    this.configService.getLanguages().subscribe(data => this.languagesList = data);
    this.configService.getCategories().subscribe(data => this.categoriesList = data);
    this.registrationForm.get('paymentOption')?.valueChanges.subscribe(val => {
      this.isPremium = val === 'premium';
    });
}
  submitted = false;
  registrationSuccess = false;
  registrationError = '';
  registrationForm!: FormGroup;
  states: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];

  isPremium = false;
  languagesList: any[] = [];
  categoriesList: any[] = [];
  brandLogoPreview: string | null = null;
  brandLogoFile: File | null = null;
  productImagesPreview: (string | null)[] = [];
  productImagesFiles: (File | null)[] = [];
  addProductImage() {
    const maxImages = this.isPremium ? 5 : 1;
    if (this.productImagesPreview.length < maxImages) {
      this.productImagesPreview.push(null);
      this.productImagesFiles.push(null);
    }
  }

  removeProductImage(index: number) {
    this.productImagesPreview.splice(index, 1);
    this.productImagesFiles.splice(index, 1);
  }

  onProductImageFileChange(event: any, index: number) {
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be below 2MB.');
      return;
    }
    const options = {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };
    imageCompression(file, options)
      .then(compressedFile => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.productImagesPreview[index] = e.target.result;
          this.productImagesFiles[index] = compressedFile;
        };
        reader.readAsDataURL(compressedFile);
      })
      .catch(() => {
        this.registrationError = 'Product image preview failed.';
      });
  }

  onBrandLogoFileChange(event: any) {
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be below 2MB.');
      return;
    }
    const options = {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };
    imageCompression(file, options)
      .then(compressedFile => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.brandLogoPreview = e.target.result;
          this.brandLogoFile = compressedFile;
        };
        reader.readAsDataURL(compressedFile);
      })
      .catch(() => {
        this.registrationError = 'Brand logo preview failed.';
      });
  }

  // ...existing code...

  get brandLogoFormArray(): FormArray {
    return this.registrationForm.get('brandLogo') as FormArray;
  }

  addBrandLogo() {
    // This method can be used to add a new brand logo input if needed in the future
  }

  async onSubmit() {
    this.submitted = true;
    // Field-level error handling
    if (this.registrationForm.invalid || !this.brandLogoPreview) {
      if (!this.brandLogoPreview) {
        this.registrationError = 'Brand logo is required.';
      }
      // Mark all controls as touched to show errors
      Object.keys(this.registrationForm.controls).forEach(key => {
        const control = this.registrationForm.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
      return;
    }
    // Add your registration submission logic here
  }
}
