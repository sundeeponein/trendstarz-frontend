
import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import imageCompression from 'browser-image-compression';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AsyncValidatorFn, AbstractControl } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { map, first, catchError } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';
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
  currentStep: 1 | 2 | 3 = 1;
  readonly totalSteps = 3;
  step1Complete: boolean = false;
  step2Complete: boolean = false;
  step3Complete: boolean = false;
  step2Attempted: boolean = false;

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


  // Email verification resend state
  resendingEmailVerification: boolean = false;
  resendEmailVerificationSuccess: boolean = false;
  resendEmailVerificationError: string | null = null;

  resendEmailVerification() {
    this.resendingEmailVerification = true;
    this.resendEmailVerificationSuccess = false;
    this.resendEmailVerificationError = null;
    const email = this.registrationForm.get('email')?.value;
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
  get brandLogoFormArray(): FormArray | undefined {
    return this.registrationForm?.get('brandLogo') as FormArray | undefined;
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
  this.refreshStepCompletion();
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
        this.refreshStepCompletion();
      } else {
        this.registrationError = 'Product image upload failed.';
      }
    } catch (err) {
      this.registrationError = 'Product image upload failed.';
    }
  }

  addBrandLogo() {
    this.brandLogoFormArray?.push(this.fb.control(''));
  }

  removeBrandLogo(index: number) {
    if ((this.brandLogoFormArray?.length || 0) > 1) {
      this.brandLogoFormArray?.removeAt(index);
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
    this.registrationForm.valueChanges.subscribe(() => this.refreshStepCompletion());
    this.registrationForm.statusChanges.subscribe(() => this.refreshStepCompletion());

    // Fetch dropdown data first, then profile
    forkJoin({
      states: this.configService.getStates(),
      tiers: this.configService.getTiers(),
      socialMedia: this.configService.getSocialMedia(),
      languages: this.configService.getLanguages(),
      categories: this.configService.getCategories()
    }).subscribe({
      next: (dropdownData) => {
        this.states = dropdownData.states || [];
        this.tiers = dropdownData.tiers || [];
        this.socialMediaList = dropdownData.socialMedia || [];
        this.languagesList = dropdownData.languages || [];
        this.categoriesList = dropdownData.categories || [];

        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (token) {
          this.configService.getBrandProfileById().subscribe({
        next: (profile: any) => {
          if (!profile) {
            this.registrationError = 'Profile not found or you are not logged in.';
            return;
          }

          this.emailVerified = !!profile?.isEmailVerified;
          this.showEmailVerificationPrompt = !this.emailVerified;

          const stateId = this.states.find(s => s.name === profile.location?.state)?.['_id'] || '';
          const languageIds = (profile.languages || []).map((name: string) =>
            this.languagesList.find((l: any) => l.name === name)?._id
          ).filter(Boolean);
          const categoryIds = (profile.categories || []).map((name: string) =>
            this.categoriesList.find((c: any) => c.name === name)?._id
          ).filter(Boolean);
          const socialMedia = (profile.socialMedia || []).map((sm: any) => ({
            ...sm,
            platform: this.socialMediaList.find((s: any) => s.name === sm.platform)?._id || sm.platform
          }));
          const resolvedBrandUsername =
            profile.brandUsername ||
            profile.username ||
            (profile.brandName
              ? String(profile.brandName)
                  .trim()
                  .replace(/\s+/g, '-')
                  .replace(/[^a-zA-Z0-9_-]/g, '')
              : '');
          const resolvedPromotionalPrice =
            profile.promotionalPrice ?? profile.price ?? '';

          this.registrationForm.patchValue({
            brandName: profile.brandName || '',
            brandUsername: resolvedBrandUsername,
            email: profile.email || '',
            phoneNumber: profile.phoneNumber || '',
            isPremium: !!profile.isPremium,
            paymentOption: profile.paymentOption || 'free',
            location: {
              state: stateId,
              googleMapLink: profile.location?.googleMapLink || ''
            },
            promotionalPrice: resolvedPromotionalPrice,
            categories: categoryIds,
            languages: languageIds,
            website: profile.website || '',
            googleMapAddress: profile.googleMapAddress || profile.location?.googleMapLink || '',
            contact: profile.contact || { whatsapp: false, email: false, call: false }
          });

          const logoArr = this.registrationForm.get('brandLogo') as FormArray;
          logoArr.clear();
          (profile.brandLogo || []).forEach((img: any) => logoArr.push(this.fb.group({
            url: img.url,
            public_id: img.public_id
          })));
          this.brandLogoPreview = (profile.brandLogo && profile.brandLogo[0]?.url) || null;
          this.brandLogoFile = (profile.brandLogo && profile.brandLogo[0]) || null;

          const productSource = Array.isArray(profile.products)
            ? profile.products
            : (Array.isArray(profile.productImages) ? profile.productImages : []);
          const productArr = this.registrationForm.get('productImages') as FormArray;
          productArr.clear();
          productSource.forEach((img: any) => productArr.push(this.fb.group({
            url: img.url,
            public_id: img.public_id
          })));
          this.productImagesPreview = productSource.map((img: any) => img?.url || null);
          this.productImagesFiles = productSource.map((img: any) =>
            (img?.url && img?.public_id ? { url: img.url, public_id: img.public_id } : null)
          );

          const smArr = this.registrationForm.get('socialMedia') as FormArray;
          smArr.clear();
          socialMedia.forEach((sm: any) => {
            smArr.push(this.fb.group({
              platform: sm.platform || '',
              handle: sm.handle || '',
              tier: sm.tier || '',
              followersCount: sm.followersCount || ''
            }));
          });

          this.originalFormValue = this.registrationForm.getRawValue();
          this.premiumStart = profile.premiumStart ? new Date(profile.premiumStart) : null;
          this.premiumEnd = profile.premiumEnd ? new Date(profile.premiumEnd) : null;
          this.registrationForm.disable();
          this.refreshStepCompletion();
        },
        error: () => {
          this.registrationError = 'Error fetching profile.';
          this.showEmailVerificationPrompt = false;
        },
          });
        }
      },
      error: () => {
        this.registrationError = 'Error fetching dropdown data.';
        console.error('[Dropdown data error]');
      }
    });

    this.registrationForm.get('password')?.disable();
    this.registrationForm.get('confirmPassword')?.disable();
    this.refreshStepCompletion();
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
      // Skip validation if username hasn't changed from the loaded profile
      if (this.originalFormValue && control.value === this.originalFormValue.brandUsername) {
        return Promise.resolve(null);
      }
      return this.configService.checkBrandUsernameUnique(control.value).pipe(
        map((isUnique: boolean) => (isUnique ? null : { notUnique: true })),
        catchError(() => of(null)),
        first()
      );
    };
  }

  enableEdit(): void {
    this.isEditMode = true;
    this.registrationForm.enable();
    this.refreshStepCompletion();
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
    this.refreshStepCompletion();
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
    this.configService.getBrandProfileById().subscribe({
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

  get socialMediaFormArray(): FormArray | undefined {
    return this.registrationForm?.get('socialMedia') as FormArray | undefined;
  }

  addSocialMedia() {
    this.socialMediaFormArray?.push(this.fb.group({
      platform: ['', Validators.required],
      handle: ['', Validators.required],
      tier: ['', Validators.required],
      followersCount: ['', Validators.required]
    }));
    this.refreshStepCompletion();
  }

  removeSocialMedia(index: number) {
    if ((this.socialMediaFormArray?.length || 0) > 1) {
      this.socialMediaFormArray?.removeAt(index);
    }
    this.refreshStepCompletion();
  }

  get productImagesFormArray(): FormArray | undefined {
    return this.registrationForm?.get('productImages') as FormArray | undefined;
  }

  addProductImage() {
    const maxImages = this.isPremium ? 5 : 1;
    if ((this.productImagesFormArray?.length || 0) < maxImages) {
      this.productImagesFormArray?.push(this.fb.control('', Validators.required));
    }
  }

  removeProductImage(index: number) {
    this.productImagesFormArray?.removeAt(index);
    this.refreshStepCompletion();
  }

  private hasBrandLogo(): boolean {
    const logo = this.brandLogoFormArray?.at(0)?.value;
    return !!(
      this.brandLogoPreview ||
      (logo && typeof logo === 'object' && 'url' in logo && logo.url)
    );
  }

  private computeStepComplete(step: number): boolean {
    if (step === 1) {
      return !!(
        this.registrationForm.get('brandName')?.valid &&
        this.registrationForm.get('brandUsername')?.valid &&
        this.registrationForm.get('email')?.valid &&
        this.registrationForm.get('phoneNumber')?.valid &&
        this.hasBrandLogo()
      );
    }

    if (step === 2) {
      return !!(
        this.registrationForm.get('paymentOption')?.valid &&
        this.registrationForm.get('location.state')?.valid &&
        this.registrationForm.get('languages')?.valid &&
        this.registrationForm.get('categories')?.valid &&
        (this.socialMediaFormArray?.valid ?? true)
      );
    }

    if (step === 3) {
      return !!(
        this.registrationForm.get('promotionalPrice')?.valid &&
        this.registrationForm.get('contact')?.valid
      );
    }

    return false;
  }

  private refreshStepCompletion() {
    if (!this.isEditMode) {
      this.step1Complete = this.currentStep > 1;
      this.step2Complete = this.currentStep > 2;
      this.step3Complete = false;
      return;
    }

    this.step1Complete = this.computeStepComplete(1);
    this.step2Complete = this.computeStepComplete(2);
    this.step3Complete = this.computeStepComplete(3);
  }

  private canNavigateTo(step: 1 | 2 | 3): boolean {
    if (step === 1) return true;
    if (step === 2) return this.step1Complete;
    if (step === 3) return this.step1Complete && this.step2Complete;
    return false;
  }

  goToStep(step: 1 | 2 | 3) {
    this.currentStep = step;
    this.submitted = false;
    this.registrationError = '';
    if (step === 2) {
      this.step2Attempted = false;
    }
    this.refreshStepCompletion();
  }

  private validateCurrentStep(): boolean {
    if (this.currentStep === 1) {
      const fields = ['brandName', 'brandUsername', 'email', 'phoneNumber'];
      fields.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      return fields.every((path) => this.registrationForm.get(path)?.valid) && this.hasBrandLogo();
    }

    if (this.currentStep === 2) {
      this.step2Attempted = true;
      const required = ['paymentOption', 'location.state', 'languages', 'categories'];
      required.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      this.socialMediaFormArray?.controls?.forEach((ctrl) => ctrl.markAllAsTouched());
      return required.every((path) => this.registrationForm.get(path)?.valid) && (this.socialMediaFormArray?.valid ?? true);
    }

    if (this.currentStep === 3) {
      this.registrationForm.get('promotionalPrice')?.markAsTouched();
      this.registrationForm.get('contact')?.markAsTouched();
      return !!(this.registrationForm.get('promotionalPrice')?.valid && this.registrationForm.get('contact')?.valid);
    }

    return false;
  }

  nextStep() {
    if (this.isEditMode && !this.validateCurrentStep()) return;
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
    }
  }

  async onSubmit() {
    this.submitted = true;
    if (!this.isEditMode || this.registrationForm.invalid || !this.hasBrandLogo()) {
      if (!this.hasBrandLogo()) {
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
    this.configService.updateBrandProfile(payload).subscribe({
      next: () => {
        this.registrationSuccess = true;
        this.isEditMode = false;
        this.registrationForm.disable();
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
