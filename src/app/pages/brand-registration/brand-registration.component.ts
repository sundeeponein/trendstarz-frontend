import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import imageCompression from 'browser-image-compression';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AsyncValidatorFn, AbstractControl, ValidatorFn } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { map, first } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

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
  readonly FREE_PRODUCT_IMAGE_LIMIT = 1;
  readonly FREE_SOCIAL_PROFILE_LIMIT = 1;

  currentStep: 1 | 2 | 3 = 1;
  readonly totalSteps = 3;
  step1Complete: boolean = false;
  step2Complete: boolean = false;
  step3Complete: boolean = false;
  step2Attempted: boolean = false;

  submitted = false;
  isSubmitting = false;
  registrationSuccess = false;
  registrationError = '';
  preApproveActive = false;

  emailVerificationSent: boolean = false;
  emailVerificationError: string | null = null;
  emailVerified: boolean = false;
  showEmailVerificationPrompt: boolean = false;
  resendingEmailVerification: boolean = false;
  resendEmailVerificationSuccess: boolean = false;
  resendEmailVerificationError: string | null = null;
  pendingVerificationEmail: string = '';

  duplicateBrandNameError: string = '';
  duplicateUsernameError: string = '';
  duplicateEmailError: string = '';
  duplicatePhoneError: string = '';

  brandUsernameError: string = '';
  registrationForm!: FormGroup;

  states: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];
  languagesList: any[] = [];
  categoriesList: any[] = [];

  brandLogoPreview: string | null = null;
  brandLogoFile: File | null = null;
  productImagesPreview: (string | null)[] = [];
  productImagesFiles: (File | null)[] = [];

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
  ) {}

  ngOnInit() {
    this.registrationForm = this.fb.group({
      brandName: ['', Validators.required],
      brandUsername: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)], [this.brandUsernameUniqueValidator()]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      paymentOption: ['free', Validators.required],
      location: this.fb.group({
        state: ['', Validators.required],
        googleMapLink: ['']
      }),
      promotionalPrice: ['', Validators.required],
      categories: [[], Validators.required],
      languages: [[], Validators.required],
      website: [''],
      googleMapAddress: [''],
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

    this.registrationForm.get('brandUsername')?.valueChanges.subscribe(() => {
      this.onBrandUsernameInput();
      this.duplicateUsernameError = '';
      this.duplicateBrandNameError = '';
    });
    this.registrationForm.get('brandName')?.valueChanges.subscribe(() => {
      this.duplicateBrandNameError = '';
    });
    this.registrationForm.get('email')?.valueChanges.subscribe(() => {
      this.duplicateEmailError = '';
    });
    this.registrationForm.get('phoneNumber')?.valueChanges.subscribe(() => {
      this.duplicatePhoneError = '';
    });

    this.registrationForm.valueChanges.subscribe(() => {
      if (this.registrationSuccess && this.registrationForm.dirty) {
        this.registrationSuccess = false;
      }
      if (this.registrationError && this.registrationForm.dirty) {
        this.registrationError = '';
      }
      this.refreshStepCompletion();
    });
    this.registrationForm.statusChanges.subscribe(() => this.refreshStepCompletion());

    this.configService.getStates().subscribe(data => this.states = data);
    this.configService.getTiers().subscribe(data => this.tiers = data);
    this.configService.getSocialMedia().subscribe(data => this.socialMediaList = data);
    this.configService.getLanguages().subscribe(data => this.languagesList = data);
    this.configService.getCategories().subscribe(data => this.categoriesList = data);
    this.configService.getAppSettings().subscribe(s => { this.preApproveActive = s.preApproveBrands; });

    this.registrationForm.get('paymentOption')?.valueChanges.subscribe(() => {
      this.enforceProductImageLimit();
      this.enforceSocialProfileLimit();
      this.refreshStepCompletion();
    });

    this.refreshStepCompletion();
  }

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

  get socialMediaFormArray(): FormArray {
    return this.registrationForm.get('socialMedia') as FormArray;
  }

  isPremiumPlan(): boolean {
    return this.registrationForm.get('paymentOption')?.value === 'premium';
  }

  canAddSocialMedia(): boolean {
    return this.isPremiumPlan() || this.socialMediaFormArray.length < this.FREE_SOCIAL_PROFILE_LIMIT;
  }

  canAddProductImage(): boolean {
    return this.isPremiumPlan() || this.productImagesFiles.length < this.FREE_PRODUCT_IMAGE_LIMIT;
  }

  private enforceSocialProfileLimit() {
    if (this.isPremiumPlan()) {
      return;
    }
    while (this.socialMediaFormArray.length > this.FREE_SOCIAL_PROFILE_LIMIT) {
      this.socialMediaFormArray.removeAt(this.socialMediaFormArray.length - 1);
    }
  }

  private enforceProductImageLimit() {
    if (this.isPremiumPlan()) {
      return;
    }
    if (this.productImagesFiles.length > this.FREE_PRODUCT_IMAGE_LIMIT) {
      this.productImagesFiles = this.productImagesFiles.slice(0, this.FREE_PRODUCT_IMAGE_LIMIT);
      this.productImagesPreview = this.productImagesPreview.slice(0, this.FREE_PRODUCT_IMAGE_LIMIT);
    }
  }

  onBrandUsernameInput() {
    const ctrl = this.registrationForm.get('brandUsername');
    if (!ctrl) return;
    const value = this.slugifyUsername(ctrl.value || '');
    ctrl.setValue(value, { emitEvent: false });
    this.brandUsernameError = '';
  }

  onBrandUsernameBlur() {
    const ctrl = this.registrationForm.get('brandUsername');
    if (ctrl) {
      ctrl.setValue(this.slugifyUsername(ctrl.value || ''), { emitEvent: false });
    }
  }

  brandUsernameUniqueValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return Promise.resolve(null);
      return this.configService.checkBrandUsernameUnique(control.value).pipe(
        map((isUnique: boolean) => (isUnique ? null : { notUnique: true })),
        first()
      );
    };
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
  }

  removeSocialMedia(index: number) {
    if (this.socialMediaFormArray.length > 1) {
      this.socialMediaFormArray.removeAt(index);
    }
  }

  addProductImage() {
    if (!this.canAddProductImage()) {
      return;
    }
    this.productImagesPreview.push(null);
    this.productImagesFiles.push(null);
    this.refreshStepCompletion();
  }

  removeProductImage(index: number) {
    this.productImagesPreview.splice(index, 1);
    this.productImagesFiles.splice(index, 1);
    this.refreshStepCompletion();
  }

  async onBrandLogoFileChange(event: any) {
    const file: File = event?.target?.files?.[0];
    if (!file) return;

    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      });
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.brandLogoPreview = e.target.result;
        this.brandLogoFile = compressedFile;
        this.refreshStepCompletion();
      };
      reader.readAsDataURL(compressedFile);
    } catch {
      this.registrationError = 'Brand logo preview failed.';
    }
  }

  removeBrandLogo() {
    this.brandLogoPreview = null;
    this.brandLogoFile = null;
    this.refreshStepCompletion();
  }

  async onProductImageFileChange(event: any, index: number) {
    const file: File = event?.target?.files?.[0];
    if (!file) return;

    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      });
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.productImagesPreview[index] = e.target.result;
        this.productImagesFiles[index] = compressedFile;
        this.refreshStepCompletion();
      };
      reader.readAsDataURL(compressedFile);
    } catch {
      this.registrationError = 'Product image preview failed.';
    }
  }

  private refreshStepCompletion() {
    this.step1Complete = this.computeStepComplete(1);
    this.step2Complete = this.computeStepComplete(2);
    this.step3Complete = this.computeStepComplete(3);
  }

  private computeStepComplete(step: number): boolean {
    if (step === 1) {
      const f = this.registrationForm;
      return !!(
        f.get('brandName')?.valid &&
        f.get('brandUsername')?.valid &&
        f.get('email')?.valid &&
        f.get('password')?.valid &&
        f.get('confirmPassword')?.valid &&
        f.get('phoneNumber')?.valid &&
        this.brandLogoPreview
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
      const socialValid = this.socialMediaFormArray.valid;
      const productReady = this.productImagesFiles.every((f) => !f || !!f);
      return socialValid && productReady;
    }

    if (step === 3) {
      return !!(
        this.registrationForm.get('promotionalPrice')?.valid &&
        this.registrationForm.get('contact')?.valid
      );
    }

    return false;
  }

  isStepComplete(step: number): boolean {
    if (step === 1) return this.step1Complete;
    if (step === 2) return this.step2Complete;
    if (step === 3) return this.step3Complete;
    return false;
  }

  private canNavigateTo(step: 1 | 2 | 3): boolean {
    if (step === 1) return true;
    if (step === 2) return this.step1Complete;
    if (step === 3) return this.step1Complete && this.step2Complete;
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

  private validateCurrentStep(): boolean {
    if (this.currentStep === 1) {
      const fields = ['brandName', 'brandUsername', 'email', 'password', 'confirmPassword', 'phoneNumber'];
      fields.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      this.submitted = true;

      if (!this.brandLogoPreview) {
        this.registrationError = 'Brand logo is required.';
      }

      return fields.every((path) => this.registrationForm.get(path)?.valid) && !!this.brandLogoPreview;
    }

    if (this.currentStep === 2) {
      this.step2Attempted = true;
      const required = ['paymentOption', 'location.state', 'languages', 'categories'];
      required.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      this.socialMediaFormArray.controls.forEach((ctrl) => ctrl.markAllAsTouched());
      return required.every((path) => this.registrationForm.get(path)?.valid) && this.socialMediaFormArray.valid;
    }

    if (this.currentStep === 3) {
      this.registrationForm.get('promotionalPrice')?.markAsTouched();
      this.registrationForm.get('contact')?.markAsTouched();
      return !!(
        this.registrationForm.get('promotionalPrice')?.valid &&
        this.registrationForm.get('contact')?.valid
      );
    }

    return false;
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

  private async uploadImage(file: File): Promise<{ url: string; public_id: string } | null> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data?.secure_url && data?.public_id) {
        return { url: data.secure_url, public_id: data.public_id };
      }
      return null;
    } catch {
      return null;
    }
  }

  async onSubmit() {
    if (this.isSubmitting) {
      return;
    }

    this.submitted = true;
    this.duplicateBrandNameError = '';
    this.duplicateUsernameError = '';
    this.duplicateEmailError = '';
    this.duplicatePhoneError = '';

    if (!this.validateCurrentStep()) {
      return;
    }

    if (this.registrationForm.invalid || !this.brandLogoFile) {
      if (!this.brandLogoFile) {
        this.registrationError = 'Brand logo is required.';
      }
      return;
    }

    this.registrationError = '';
    this.registrationSuccess = false;
    this.isSubmitting = true;

    const raw = this.registrationForm.value;
    raw.brandUsername = this.slugifyUsername(raw.brandUsername || '');

    const stateObj = this.states.find(s => s._id === raw.location.state);
    const languageNames = (raw.languages || []).map((id: string) => {
      const lang = this.languagesList.find((l: any) => l._id === id);
      return lang ? lang.name : id;
    });
    const categoryNames = (raw.categories || []).map((id: string) => {
      const cat = this.categoriesList.find((c: any) => c._id === id);
      return cat ? cat.name : id;
    });

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

    const uploadedBrandLogo = await this.uploadImage(this.brandLogoFile);
    if (!uploadedBrandLogo) {
      this.registrationError = 'Brand logo upload failed.';
      this.isSubmitting = false;
      return;
    }

    const productUploadTargets = this.productImagesFiles.filter((f): f is File => !!f);
    const uploadedProducts = [] as Array<{ url: string; public_id: string }>;
    for (const productFile of productUploadTargets) {
      const uploaded = await this.uploadImage(productFile);
      if (!uploaded) {
        this.registrationError = 'One of the product image uploads failed.';
        this.isSubmitting = false;
        return;
      }
      uploadedProducts.push(uploaded);
    }

    const payload: any = {
      ...raw,
      location: {
        state: stateObj ? stateObj.name : raw.location.state,
        googleMapLink: raw.googleMapAddress || raw.location.googleMapLink || ''
      },
      promotionalPrice: raw.promotionalPrice,
      languages: languageNames,
      categories: categoryNames,
      socialMedia,
      brandLogo: [uploadedBrandLogo],
      products: uploadedProducts,
      contact: raw.contact
    };
    delete payload.googleMapAddress;

    this.configService.registerBrand(payload).subscribe({
      next: () => {
        this.registrationSuccess = true;
        this.pendingVerificationEmail = raw.email;
        this.showEmailVerificationPrompt = true;
        this.emailVerificationSent = true;
        this.emailVerificationError = null;
        this.registrationForm.reset({
          paymentOption: 'free',
          socialMedia: [{ platform: '', handle: '', tier: '', followersCount: '' }],
          contact: { whatsapp: false, email: false, call: false }
        });
        this.socialMediaFormArray.clear();
        this.socialMediaFormArray.push(this.fb.group({
          platform: ['', Validators.required],
          handle: ['', Validators.required],
          tier: ['', Validators.required],
          followersCount: ['', Validators.required]
        }));
        this.brandLogoPreview = null;
        this.brandLogoFile = null;
        this.productImagesPreview = [];
        this.productImagesFiles = [];
        this.currentStep = 1;
        this.submitted = false;
        this.isSubmitting = false;
        this.refreshStepCompletion();
      },
      error: (err: any) => {
        const duplicateFields: string[] = Array.isArray(err?.error?.duplicateFields)
          ? err.error.duplicateFields.map((f: any) => String(f).toLowerCase())
          : [];

        if (duplicateFields.length) {
          if (duplicateFields.includes('brandname')) {
            this.duplicateBrandNameError = 'Brand name already exists. Please choose another.';
            this.registrationForm.get('brandName')?.setErrors({ ...(this.registrationForm.get('brandName')?.errors || {}), duplicate: true });
          }
          if (duplicateFields.includes('brandusername') || duplicateFields.includes('username')) {
            this.duplicateUsernameError = 'Brand username already exists. Please choose another.';
            this.registrationForm.get('brandUsername')?.setErrors({ ...(this.registrationForm.get('brandUsername')?.errors || {}), duplicate: true });
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

        this.registrationError = err?.error?.message || 'Registration failed. Please try again.';
        this.isSubmitting = false;
      }
    });
  }

  closeSuccessModal() {
    this.registrationSuccess = false;
    this.brandLogoPreview = null;
    this.brandLogoFile = null;
    this.submitted = false;
    this.pendingVerificationEmail = '';
    window.location.href = '/login';
  }
}