import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import imageCompression from 'browser-image-compression';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AsyncValidatorFn, AbstractControl, ValidatorFn } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { map, first } from 'rxjs/operators';
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
  styleUrls: ['./brand-registration.component.scss'],
})
export class BrandRegistrationComponent implements OnInit {
  // Email verification state
  emailVerified: boolean = false;
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

  // Social media add/remove
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

  // Phone OTP state and methods
  showPhoneOtp: boolean = false;
  phoneVerified: boolean = false;
  phoneOtp: string[] = ['', '', '', '', '', ''];

  confirmPhoneOtp() {
    // Implement OTP confirmation logic here
    // For now, just mark as verified for demo
    this.phoneVerified = true;
    this.showPhoneOtp = false;
  }
  get socialMediaFormArray(): FormArray {
    return this.registrationForm.get('socialMedia') as FormArray;
  }
  // Real-time sanitize brand username input (replace spaces with hyphens, remove invalid chars)
  onBrandUsernameInput() {
    const ctrl = this.registrationForm.get('brandUsername');
    if (!ctrl) return;
    let value = ctrl.value || '';
    value = value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    ctrl.setValue(value, { emitEvent: false });
    this.brandUsernameError = '';
  }
  brandUsernameError: string = '';
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

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private otpService: OtpService
  ) {}

  // Initialize the registration form and fetch any required data here
  ngOnInit() {
    this.registrationForm = this.fb.group({
      brandName: ['', Validators.required],
      brandUsername: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]+$/)], [this.brandUsernameUniqueValidator()]],
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
      }, { validators: [atLeastOneContactRequired] })
    });

    // Username input sanitization
    this.registrationForm.get('brandUsername')?.valueChanges.subscribe(() => this.onBrandUsernameInput());
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

  // Sanitize brand username input (replace spaces with hyphens, remove invalid chars)
  // ...existing code...

  // Async validator to check brand username uniqueness
  brandUsernameUniqueValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return Promise.resolve(null);
      return this.configService.checkBrandUsernameUnique(control.value).pipe(
        map((isUnique: boolean) => (isUnique ? null : { notUnique: true })),
        first()
      );
    };
  }

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

  get brandLogoFormArray(): FormArray {
    return this.registrationForm.get('brandLogo') as FormArray;
  }

  addBrandLogo() {
    // This method can be used to add a new brand logo input if needed in the future
  }

  // Utility to slugify username (match influencer logic)
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

  // ...existing code...

  onBrandUsernameBlur() {
    const ctrl = this.registrationForm.get('brandUsername');
    if (ctrl) {
      ctrl.setValue(this.slugifyUsername(ctrl.value), { emitEvent: false });
    }
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
        if (control instanceof FormGroup) {
          Object.keys(control.controls).forEach(subKey => control.get(subKey)?.markAsTouched());
        } else {
          control?.markAsTouched();
        }
      });
      return;
    }
    // ...existing code...
  }
  // --- End of class ---
}