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

  constructor(
    public fb: FormBuilder,
    private configService: ConfigService,
    private otpService: OtpService
  ) {}

  sendPhoneOtp() {
    const phone = this.registrationForm.get('phoneNumber')?.value;
    this.otpService.sendOtp('phone', phone).subscribe({
      next: () => { this.phoneVerifyError = ''; },
      error: () => { this.phoneVerifyError = 'Failed to send OTP'; }
    });
  }
  confirmPhoneOtp() {
    const phone = this.registrationForm.get('phoneNumber')?.value;
    const otp = this.phoneOtp.join('');
    this.otpService.verifyOtp('phone', phone, otp).subscribe({
      next: () => { this.phoneVerified = true; this.showPhoneOtp = false; this.phoneVerifyError = ''; },
      error: () => { this.phoneVerifyError = 'Invalid OTP'; }
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
        if (control) control.markAsTouched();
      });
      return;
    }
    this.registrationError = '';
    this.registrationSuccess = false;
    const raw = this.registrationForm.value;
    // Prepare payload with correct mapping (like influencer)
    const stateObj = this.states.find((s: any) => s._id === raw.location.state);
    const languageNames = (raw.languages || []).map((id: string) => {
      const lang = this.languagesList.find((l: any) => l._id === id);
      return lang ? lang.name : id;
    });
    const categoryNames = (raw.categories || []).map((id: string) => {
      const cat = this.categoriesList.find((c: any) => c._id === id);
      return cat ? cat.name : id;
    });
    const socialMedia = (raw.socialMedia || []).map((sm: any) => {
      const platformObj = this.socialMediaList.find((s: any) => s._id === sm.platform);
      return {
        ...sm,
        platform: platformObj ? platformObj.name : sm.platform,
        followersCount: Number(sm.followersCount)
      };
    });
    // Step 1: Upload brand logo and product images to Cloudinary if selected
    let brandLogoUploadResult: { url: string, public_id: string } | null = null;
    if (this.brandLogoFile) {
      const formData = new FormData();
      formData.append('file', this.brandLogoFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (data.secure_url && data.public_id) {
          brandLogoUploadResult = { url: data.secure_url, public_id: data.public_id };
        } else {
          this.registrationError = 'Brand logo upload failed.';
          return;
        }
      } catch (err) {
        this.registrationError = 'Brand logo upload failed.';
        return;
      }
    }
    // Upload product images
    let productImageUploadResults: { url: string, public_id: string }[] = [];
    for (const file of this.productImagesFiles) {
      if (!file) continue;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (data.secure_url && data.public_id) {
          productImageUploadResults.push({ url: data.secure_url, public_id: data.public_id });
        }
      } catch (err) {
        // Ignore failed product image uploads for now
      }
    }
    // Step 2: Register brand with image info
    const payload: any = {
      ...raw,
      location: {
        state: stateObj ? stateObj.name : raw.location.state,
        googleMapLink: raw.location.googleMapLink
      },
      promotionalPrice: raw.promotionalPrice,
      languages: languageNames,
      categories: categoryNames,
      socialMedia,
      brandLogo: brandLogoUploadResult ? [brandLogoUploadResult] : [],
      products: productImageUploadResults,
      contact: raw.contact
    };
    this.configService.registerBrand(payload).subscribe({
      next: (savedBrand) => {
        this.registrationSuccess = true;
        this.registrationForm.reset();
        this.brandLogoPreview = null;
        this.brandLogoFile = null;
        this.productImagesPreview = [];
        this.productImagesFiles = [];
        this.submitted = false;
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
}
