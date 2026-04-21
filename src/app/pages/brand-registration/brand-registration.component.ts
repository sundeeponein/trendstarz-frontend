import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import imageCompression from 'browser-image-compression';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AsyncValidatorFn, AbstractControl, ValidatorFn } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { passwordStrengthValidator, getPasswordChecks } from '../../shared/password-strength';
import { map, first } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TierInfoModalComponent } from '../../shared/components/tier-info-modal/tier-info-modal.component';

export const atLeastOneContactRequired: ValidatorFn = (control: AbstractControl) => {
  if (!control || !control.value) return { required: true };
  const { whatsapp, email, call } = control.value;
  return whatsapp || email || call ? null : { required: true };
};

export const passwordMatchValidator: ValidatorFn = (group: AbstractControl) => {
  const pw = group.get('password')?.value;
  const cpw = group.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-brand-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule, TierInfoModalComponent],
  templateUrl: './brand-registration.component.html',
  styleUrls: ['./brand-registration.component.scss'],
})
export class BrandRegistrationComponent implements OnInit {
  readonly FREE_PRODUCT_IMAGE_LIMIT = 1;
  readonly FREE_SOCIAL_PROFILE_LIMIT = 1;

  toggleChip(field: 'languages' | 'categories', id: string): void {
    const arr = this.registrationForm.get(field)?.value || [];
    const idx = arr.indexOf(id);
    if (idx > -1) {
      arr.splice(idx, 1);
    } else {
      arr.push(id);
    }
    this.registrationForm.get(field)?.setValue([...arr]);
    this.registrationForm.get(field)?.markAsTouched();
  }

  // --- Password strength live checks ---
  get passwordChecks() {
    return getPasswordChecks(this.registrationForm?.get('password')?.value || '');
  }

  // --- Social Media Platform UI ---
  platformForms: { [platformId: string]: any } = {};
  activePlatformTab: string | null = null;

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
  showPassword = false;
  showConfirmPassword = false;
  togglePasswordVisibility() { this.showPassword = !this.showPassword; }
  toggleConfirmPasswordVisibility() { this.showConfirmPassword = !this.showConfirmPassword; }

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
  districts: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];
  showTierInfoModal = false;
  languagesList: any[] = [];
  categoriesList: any[] = [];

  brandLogoPreview: string | null = null;
  brandLogoFile: File | null = null;
  productImagesPreview: (string | null)[] = [];
  productImagesFiles: (File | null)[] = [];

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.registrationForm = this.fb.group({
      brandName: ['', Validators.required],
      brandUsername: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)], [this.brandUsernameUniqueValidator()]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      paymentOption: ['free', Validators.required],
      location: this.fb.group({
        state: ['', Validators.required],
        district: ['', Validators.required],
        googleMapLink: ['']
      }),
      categories: [[], Validators.required],
      languages: [[], Validators.required],
      website: [''],
      googleMapAddress: [''],

      contact: this.fb.group({
        whatsapp: [false],
        email: [false],
        call: [false]
      }, { validators: [atLeastOneContactRequired] })
    }, { validators: [passwordMatchValidator] });

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

    // Load districts when state changes
    this.registrationForm.get('location.state')?.valueChanges.subscribe(stateId => {
      this.registrationForm.get('location.district')?.setValue('');
      this.districts = [];
      if (stateId) {
        const selectedState = this.states.find((s: any) => s._id === stateId || s.id === stateId || s.name === stateId);
        const stateName = selectedState?.name || (typeof stateId === 'string' ? stateId : '');
        const selectedStateId = selectedState?._id || selectedState?.id || (typeof stateId === 'string' ? stateId : '');
        this.configService.getDistricts(stateName, selectedStateId).subscribe({
          next: data => { this.districts = Array.isArray(data) ? data : []; this.cd.detectChanges(); },
          error: () => { this.districts = []; this.cd.detectChanges(); }
        });
      }
    });

    this.registrationForm.get('paymentOption')?.valueChanges.subscribe(() => {
      this.enforceProductImageLimit();
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

  isPremiumPlan(): boolean {
    return this.registrationForm.get('paymentOption')?.value === 'premium';
  }

  canAddProductImage(): boolean {
    return this.isPremiumPlan() || this.productImagesFiles.length < this.FREE_PRODUCT_IMAGE_LIMIT;
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

  // --- Social Media Platform UI Methods ---
  getPlatformById(id: string | null) {
    if (!id) return null;
    return this.socialMediaList.find(p => p._id === id) || null;
  }

  isPlatformSelected(platform: any): boolean {
    return !!this.platformForms[platform._id];
  }

  togglePlatform(platform: any) {
    if (this.isPlatformSelected(platform)) {
      this.removePlatformCard(platform);
      if (this.activePlatformTab === platform._id) {
        const remaining = this.selectedPlatforms();
        this.activePlatformTab = remaining.length ? remaining[0]._id : null;
      }
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
      this.activePlatformTab = platform._id;
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
      if (ct.selected && ct.price) total += Number(ct.price) || 0;
    }
    return total;
  }

  getGrandTotal(): number {
    return this.selectedPlatforms().reduce((sum, p) => sum + this.getPlatformTotal(p), 0);
  }

  getProfileUrl(platformName: string, handle: string): string {
    const h = (handle || '').replace(/^@+/, '').trim();
    if (!h) return '';
    const n = (platformName || '').toLowerCase();
    if (n.includes('instagram')) return 'https://instagram.com/' + h;
    if (n.includes('youtube')) return 'https://youtube.com/@' + h;
    if (n.includes('twitter') || n.includes('x')) return 'https://x.com/' + h;
    if (n.includes('facebook')) return 'https://facebook.com/' + h;
    if (n.includes('tiktok')) return 'https://tiktok.com/@' + h;
    if (n.includes('linkedin')) return 'https://linkedin.com/in/' + h;
    return '';
  }

  stripAtSign(platformId: string) {
    const pf = this.platformForms[platformId];
    if (!pf) return;
    pf.handle = (pf.handle || '').replace(/^@+/, '').trim();
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
        this.cd.detectChanges();
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
        this.cd.detectChanges();
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
        !f.errors?.['passwordMismatch'] &&
        f.get('phoneNumber')?.valid &&
        this.brandLogoPreview
      );
    }

    if (step === 2) {
      const f = this.registrationForm;
      const detailsValid = !!(
        f.get('paymentOption')?.valid &&
        f.get('location.state')?.valid &&
        f.get('location.district')?.valid &&
        f.get('languages')?.valid &&
        f.get('categories')?.valid
      );
      if (!detailsValid) {
        return false;
      }
      const socialValid = this.selectedPlatforms().length > 0;
      const productReady = this.productImagesFiles.every((f) => !f || !!f);
      return socialValid && productReady;
    }

    if (step === 3) {
      return !!(
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
      const required = ['paymentOption', 'location.state', 'location.district', 'languages', 'categories'];
      required.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      return required.every((path) => this.registrationForm.get(path)?.valid) && this.selectedPlatforms().length > 0;
    }

    if (this.currentStep === 3) {
      this.registrationForm.get('contact')?.markAsTouched();
      return !!(
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
    const districtObj = this.districts.find(d => d._id === raw.location.district);
    const languageNames = (raw.languages || []).map((id: string) => {
      const lang = this.languagesList.find((l: any) => l._id === id);
      return lang ? lang.name : id;
    });
    const categoryNames = (raw.categories || []).map((id: string) => {
      const cat = this.categoriesList.find((c: any) => c._id === id);
      return cat ? cat.name : id;
    });

    const socialMedia = this.selectedPlatforms().map((platform: any) => {
      const pf = this.platformForms[platform._id];
      return {
        platform: platform.name,
        handle: pf.handle,
        followersCount: Number(pf.followersCount) || 0,
        tier: pf.tier,
        contentTypes: Object.keys(pf.contentTypes)
          .filter(ctName => pf.contentTypes[ctName].selected)
          .map(ctName => ({ name: ctName }))
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
        district: districtObj ? districtObj.name : raw.location.district,
        googleMapLink: raw.googleMapAddress || raw.location.googleMapLink || ''
      },
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
          contact: { whatsapp: false, email: false, call: false }
        });
        this.platformForms = {};
        this.activePlatformTab = null;
        this.brandLogoPreview = null;
        this.brandLogoFile = null;
        this.productImagesPreview = [];
        this.productImagesFiles = [];
        this.currentStep = 1;
        this.submitted = false;
        this.isSubmitting = false;
        this.refreshStepCompletion();
        this.cd.detectChanges();
      },
      error: (err: any) => {
        const rawMessage = err?.error?.message;
        const parsedMessage = Array.isArray(rawMessage)
          ? rawMessage.join(', ')
          : typeof rawMessage === 'object' && rawMessage !== null
            ? String((rawMessage as any).message || JSON.stringify(rawMessage))
            : String(rawMessage || err?.message || '');

        const duplicateFields: string[] = Array.isArray(err?.error?.duplicateFields)
          ? err.error.duplicateFields.map((f: any) => String(f).toLowerCase())
          : [];

        if (duplicateFields.length) {
          const duplicateLabels: string[] = [];
          if (duplicateFields.includes('brandname')) {
            this.duplicateBrandNameError = 'Brand name already exists. Please choose another.';
            this.registrationForm.get('brandName')?.setErrors({ ...(this.registrationForm.get('brandName')?.errors || {}), duplicate: true });
            duplicateLabels.push('Brand name');
          }
          if (duplicateFields.includes('brandusername') || duplicateFields.includes('username')) {
            this.duplicateUsernameError = 'Brand username already exists. Please choose another.';
            this.registrationForm.get('brandUsername')?.setErrors({ ...(this.registrationForm.get('brandUsername')?.errors || {}), duplicate: true });
            duplicateLabels.push('Brand username');
          }
          if (duplicateFields.includes('email')) {
            this.duplicateEmailError = 'Email already exists. Please use another email or login.';
            this.registrationForm.get('email')?.setErrors({ ...(this.registrationForm.get('email')?.errors || {}), duplicate: true });
            duplicateLabels.push('Email');
          }
          if (duplicateFields.includes('phonenumber') || duplicateFields.includes('phone') || duplicateFields.includes('mobile')) {
            this.duplicatePhoneError = 'Mobile number already exists. Please use another number.';
            this.registrationForm.get('phoneNumber')?.setErrors({ ...(this.registrationForm.get('phoneNumber')?.errors || {}), duplicate: true });
            duplicateLabels.push('Mobile number');
          }

          this.registrationError = duplicateLabels.length === 1
            ? `${duplicateLabels[0]} already exists. Please use a different value.`
            : duplicateLabels.length > 1
              ? `${duplicateLabels.join(' and ')} already exist. Please use different values.`
              : 'Some fields already exist. Please update and try again.';

          this.currentStep = 1;
          this.refreshStepCompletion();
          this.isSubmitting = false;
          return;
        }

        const lower = parsedMessage.toLowerCase();
        if (lower.includes('brand name') && lower.includes('already exists')) {
          this.duplicateBrandNameError = 'Brand name already exists. Please choose another.';
          this.registrationForm.get('brandName')?.setErrors({ ...(this.registrationForm.get('brandName')?.errors || {}), duplicate: true });
          this.currentStep = 1;
          this.isSubmitting = false;
          this.refreshStepCompletion();
          return;
        }
        if ((lower.includes('brandusername') || lower.includes('brand username') || lower.includes('username')) && lower.includes('already exists')) {
          this.duplicateUsernameError = 'Brand username already exists. Please choose another.';
          this.registrationForm.get('brandUsername')?.setErrors({ ...(this.registrationForm.get('brandUsername')?.errors || {}), duplicate: true });
          this.currentStep = 1;
          this.isSubmitting = false;
          this.refreshStepCompletion();
          return;
        }

        this.registrationError = parsedMessage || 'Registration failed. Please try again.';
        this.isSubmitting = false;
        this.cd.detectChanges();
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