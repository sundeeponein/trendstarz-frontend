
import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import imageCompression from 'browser-image-compression';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AsyncValidatorFn, AbstractControl } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { map, first } from 'rxjs/operators';
import { OtpService } from '../../shared/otp.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-brand-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule],
  templateUrl: './brand-profile.component.html',
  styleUrls: ['./brand-profile.component.scss']
})

export class BrandProfileComponent implements OnInit {
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
    public fb: FormBuilder,
    private configService: ConfigService,
    private otpService: OtpService
  ) {}

  phoneOtpTimer: number = 300;
  canResendPhoneOtp: boolean = false;
  verifyingPhoneOtp: boolean = false;
  phoneOtpError: string = '';
  private phoneOtpInterval: any;

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
  brandUsernameError: string = '';
  get brandLogoFormArray(): FormArray {
    return this.registrationForm.get('brandLogo') as FormArray;
  }
  isEditMode = false;
  originalFormValue: any = null;
  premiumStart: Date | null = null;
  premiumEnd: Date | null = null;
  showPayment = false;
  selectedDuration: '1m' | '3m' | '1y' | '' = '';
  paymentSuccess = false;
  paymentError = '';
  registrationSuccess = false;
  registrationError = '';
  submitted = false;
  registrationForm!: FormGroup;
  states: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];
  languagesList: any[] = [];
  categoriesList: any[] = [];
  isPremium = false;
  brandLogoPreview: string | null = null;
  brandLogoFile: { url: string, public_id: string } | null = null;
  productImagesPreview: (string | null)[] = [];
  productImagesFiles: ({ url: string, public_id: string } | null)[] = [];
  // ...existing code...

  // Getter for brandLogo FormArray
  // Handle brand logo file selection, compress, upload, and preview
  async onBrandLogoFileChange(event: any) {
    if (!this.isEditMode) return;
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
    // Compress image before upload
    const options = {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };
    try {
      const compressedFile = await imageCompression(file, options);
      // Upload to Cloudinary
      this.brandLogoPreview = null;
      this.brandLogoFile = null;
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.secure_url && data.public_id) {
  this.brandLogoPreview = data.secure_url;
  this.brandLogoFile = { url: data.secure_url, public_id: data.public_id };
  // Sync with form array for validation
  const logoArray = this.registrationForm.get('brandLogo') as FormArray;
  logoArray.clear();
  logoArray.push(this.fb.control(this.brandLogoFile));
      } else {
        this.registrationError = 'Brand logo upload failed.';
      }
    } catch (err) {
      this.registrationError = 'Brand logo upload failed.';
    }
  }

  // Handle product image file selection, compress, upload, and preview
  async onProductImageFileChange(event: any, index: number) {
    if (!this.isEditMode) return;
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
    // Compress image before upload
    const options = {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };
    try {
      const compressedFile = await imageCompression(file, options);
      // Upload to Cloudinary
      this.productImagesPreview[index] = null;
      this.productImagesFiles[index] = null;
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.secure_url && data.public_id) {
        this.productImagesPreview[index] = data.secure_url;
        this.productImagesFiles[index] = { url: data.secure_url, public_id: data.public_id };
        // Sync with form array for validation
        const prodArray = this.registrationForm.get('productImages') as FormArray;
        // Ensure enough controls
        while (prodArray.length <= index) {
          prodArray.push(this.fb.control(null));
        }
        prodArray.setControl(index, this.fb.control(this.productImagesFiles[index]));
      } else {
        this.registrationError = 'Product image upload failed.';
      }
    } catch (err) {
      this.registrationError = 'Product image upload failed.';
    }
  }

  addBrandLogo() {
    this.brandLogoFormArray.push(this.fb.control(''));
  }

  removeBrandLogo(index: number) {
    if (this.brandLogoFormArray.length > 1) {
      this.brandLogoFormArray.removeAt(index);
    }
  }

  ngOnInit() {
    console.log('BrandProfileComponent ngOnInit called');

    this.registrationForm = this.fb.group({
      brandName: ['', Validators.required],
      brandUsername: [
        '',
        [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]+$/)],
        [this.brandUsernameUniqueValidator()]
      ],
      email: ['', [Validators.required, Validators.email]],
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
      products: this.fb.array([]),
      productImages: this.fb.array([]),
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
      }),
    });

    // Username input sanitization
    this.registrationForm.get('brandUsername')?.valueChanges.subscribe(() => this.onBrandUsernameInput());

    this.registrationForm.get('password')?.disable();
    this.registrationForm.get('confirmPassword')?.disable();
  }

  // Sanitize brand username input (replace spaces with hyphens, remove invalid chars)
  onBrandUsernameInput() {
    const ctrl = this.registrationForm.get('brandUsername');
    if (!ctrl) return;
    let value = ctrl.value || '';
    value = value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    ctrl.setValue(value, { emitEvent: false });
    this.brandUsernameError = '';
  }

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

  enableEdit(): void {
    this.isEditMode = true;
    this.registrationForm.enable();
  // Password fields are disabled and removed from the form
  }

  cancelEdit(): void {
    this.isEditMode = false;
    if (this.originalFormValue) {
      this.registrationForm.reset(this.originalFormValue);
    }
    this.registrationForm.disable();
    this.registrationForm.get('password')?.disable();
    this.registrationForm.get('confirmPassword')?.disable();
  }

  payAndUpgrade() {
    this.paymentError = '';
    this.paymentSuccess = false;
    if (!this.selectedDuration) {
      this.paymentError = 'Please select a premium duration.';
      setTimeout(() => {
        this.showPayment = false;
        this.paymentError = '';
      }, 1200);
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      this.paymentError = 'Not logged in.';
      return;
    }
    // Simulate payment, then call backend PATCH to set premium for brand
    this.configService.getBrandProfileById(token).subscribe({
      next: (profile: any) => {
        if (!profile || !profile._id) {
          this.paymentError = 'User ID not found';
          return;
        }
        const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        this.configService['http'].patch(
          `${this.configService['apiUrl']}/users/${profile._id}/premium`,
          { isPremium: true, premiumDuration: this.selectedDuration },
          headers
        ).subscribe({
          next: (res: any) => {
            this.paymentSuccess = true;
            this.showPayment = false;
            // Refresh profile to show premium status
            this.ngOnInit();
          },
          error: (err: any) => {
            this.paymentError = 'Payment failed or could not upgrade. Please try again.';
          }
        });
      },
      error: (err: any) => {
        this.paymentError = 'Could not fetch profile.';
      }
    });
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

  get productImagesFormArray() {
    return this.registrationForm.get('productImages') as FormArray;
  }

  addProductImage() {
    const maxImages = this.isPremium ? 5 : 1;
    if (this.productImagesFormArray.length < maxImages) {
      this.productImagesFormArray.push(this.fb.control('', Validators.required));
    }
  }

  removeProductImage(index: number) {
    this.productImagesFormArray.removeAt(index);
  }



  async onSubmit() {
    this.submitted = true;
    if (!this.isEditMode || this.registrationForm.invalid || !this.brandLogoPreview) {
      if (!this.brandLogoPreview) {
        this.registrationError = 'Brand logo is required.';
      }
      return;
    }
    this.registrationError = '';
    this.registrationSuccess = false;
    const raw = this.registrationForm.getRawValue();
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
    // Map social media platform ID to name (for backend compatibility)
    const socialMedia = (raw.socialMedia || []).map((sm: any) => {
      const platformObj = this.socialMediaList.find((s: any) => s._id === sm.platform);
      return {
        ...sm,
        platform: platformObj ? platformObj.name : sm.platform,
        followersCount: Number(sm.followersCount)
      };
    });
    // Handle Cloudinary upload for brand logo if file selected
    // Only send image objects from file input handlers
    const products = this.productImagesFiles.filter((img): img is { url: string, public_id: string } => !!img && typeof img === 'object' && 'url' in img && 'public_id' in img);
    const brandLogoObjs = this.brandLogoFile ? [this.brandLogoFile] : [];
    const location = {
      state: stateObj ? stateObj.name : raw.location.state,
      googleMapLink: raw.googleMapAddress || raw.location.googleMapLink || undefined
    };
    const payload: any = {
  ...raw,
  location,
  promotionalPrice: raw.promotionalPrice,
  languages: languageNames,
  categories: categoryNames,
  socialMedia,
  brandLogo: brandLogoObjs.length > 0 ? brandLogoObjs : (raw.brandLogo || []),
  products: products.length > 0 ? products : (raw.products || []),
  contact: raw.contact
    };
    // Remove fields not in DTO
    delete payload.password;
    delete payload.confirmPassword;
    delete payload.paymentOption;
    delete payload.productImages;
    delete payload.googleMapAddress;
    let token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
    this.configService.updateBrandProfile(payload, token).subscribe({
      next: () => {
        this.registrationSuccess = true;
        this.isEditMode = false;
        this.registrationForm.disable();
        this.brandLogoPreview = null;
        this.brandLogoFile = null;
        this.productImagesPreview = [];
        this.productImagesFiles = [];
        this.registrationForm.get('password')?.disable();
        this.registrationForm.get('confirmPassword')?.disable();
        this.originalFormValue = this.registrationForm.getRawValue();
        this.submitted = false;
      },
      error: err => {
        this.registrationError = 'Update failed. Please try again.';
        this.submitted = false;
      }
    });
  }
  
}
