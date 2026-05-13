import { environment } from '../../../environments/environment';
import imageCompression from 'browser-image-compression';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, AsyncValidatorFn, AbstractControl, ValidatorFn } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { passwordStrengthValidator, getPasswordChecks } from '../../shared/password-strength';
import { map, first } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TierInfoService } from '../../shared/components/tier-info-modal/tier-info.service';
import { PlansService, Plan } from '../../shared/plans.service';
import { TIER_DESC_MAP } from '../../shared/tiers.constants';

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
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule],
  templateUrl: './brand-registration.component.html',
  styleUrls: ['./brand-registration.component.scss'],
})
export class BrandRegistrationComponent implements OnInit {
  readonly FREE_PRODUCT_IMAGE_LIMIT = 1;
  readonly FREE_SOCIAL_PROFILE_LIMIT = 1;
  readonly MAX_IMAGE_SIZE_MB = 5; // reject images larger than this before attempting compression/upload
  readonly currentYear = new Date().getFullYear();
  readonly brandFoundedYears: number[] = Array.from(
    { length: this.currentYear - 1899 },
    (_, index) => this.currentYear - index,
  );

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

  getTierOptionLabel(tier: any): string {
    const name = String(tier?.name || '').trim();
    const descFromApi = String(tier?.desc || '').trim();
    const desc = descFromApi || TIER_DESC_MAP[name.toLowerCase()] || '';
    if (!desc) return name;
    return `${name} (${desc})`;
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
  isMobileVerified: boolean = false;
  showEmailVerificationPrompt: boolean = false;
  resendingEmailVerification: boolean = false;
  resendEmailVerificationSuccess: boolean = false;
  resendEmailVerificationError: string | null = null;
  pendingVerificationEmail: string = '';

  duplicateBrandNameError: string = '';
  duplicateUsernameError: string = '';
  duplicateEmailError: string = '';
  duplicatePhoneError: string = '';
  verificationCallNumber = '';

  brandUsernameError: string = '';
  registrationForm!: FormGroup;

  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];
  protected tierInfo = inject(TierInfoService);
  languagesList: any[] = [];
  categoriesList: any[] = [];

  brandLogoPreview: string | null = null;
  brandLogoFile: File | null = null;
  // Cached upload result so we don't re-upload (and orphan the previous upload)
  // when the user retries onSubmit after a backend error (e.g., duplicate email).
  uploadedBrandLogo: { url: string; public_id: string } | null = null;
  productImagesPreview: (string | null)[] = [];
  productImagesFiles: (File | null)[] = [];
  // Per-index cached upload result for product images.
  uploadedProductImages: ({ url: string; public_id: string } | null)[] = [];
  signupAttribution: { source?: string; audience?: string; referrerPath?: string } = {};
  premiumMonthlyPrice = 999;
  premiumOriginalMonthlyPrice: number | null = null;
  premiumOfferChip = '';

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private plansService: PlansService,
    private cd: ChangeDetectorRef,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.loadPremiumMonthlyPrice();
    this.configService.getSupportContact().subscribe(s => {
      this.verificationCallNumber = s.verificationCallNumber || '';
    });

    const source = this.route.snapshot.queryParamMap.get('source') || '';
    const audience = this.route.snapshot.queryParamMap.get('audience') || '';
    this.signupAttribution = {
      source: source || undefined,
      audience: audience || undefined,
      referrerPath: typeof window !== 'undefined' ? window.location.pathname : undefined,
    };

    this.registrationForm = this.fb.group({
      brandName: ['', Validators.required],
      contactPersonName: ['', Validators.required],
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
      foundedYear: [''],
      companySize: [''],
      promotionalPrice: [500, [Validators.min(0)]],
      googleMapAddress: [''],
      description: [''],

      contact: this.fb.group({
        whatsapp: [false],
        email: [false],
        call: [false]
      }, { validators: [atLeastOneContactRequired] })
    }, { validators: [passwordMatchValidator] });

    // Defensive defaults: ensure arrays/objects exist to avoid runtime nulls
    try {
      if (!Array.isArray(this.registrationForm.get('categories')?.value)) {
        this.registrationForm.get('categories')?.setValue([]);
      }
      if (!Array.isArray(this.registrationForm.get('languages')?.value)) {
        this.registrationForm.get('languages')?.setValue([]);
      }
      const contactVal = this.registrationForm.get('contact')?.value;
      if (!contactVal || typeof contactVal !== 'object') {
        this.registrationForm.get('contact')?.setValue({ whatsapp: false, email: false, call: false });
      } else {
        // ensure missing keys exist
        const fixed = {
          whatsapp: !!contactVal.whatsapp,
          email: !!contactVal.email,
          call: !!contactVal.call
        };
        this.registrationForm.get('contact')?.setValue(fixed, { emitEvent: false });
      }
    } catch (e) {
      // swallow — defensive only
    }

    this.registrationForm.get('brandUsername')?.valueChanges.subscribe(() => {
      this.onBrandUsernameInput();
      this.duplicateUsernameError = '';
      this.duplicateBrandNameError = '';
    });
    this.registrationForm.get('brandName')?.valueChanges.subscribe((name: string) => {
      this.duplicateBrandNameError = '';
      // Auto-generate username from brand name
      const usernameCtrl = this.registrationForm.get('brandUsername');
      if (usernameCtrl && !usernameCtrl.dirty) {
        const slug = this.slugifyUsername(name || '');
        usernameCtrl.setValue(slug, { emitEvent: false });
        usernameCtrl.markAsTouched();
      }
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

    this.configService.getStates().subscribe(data => {
      this.states = data;
      // If a state was already selected (e.g. resuming a partial registration),
      // make sure the districts list gets fetched too.
      const currentStateId = this.registrationForm.get('location.state')?.value;
      if (currentStateId && (!this.districts || this.districts.length === 0)) {
        const selectedState = this.states.find((s: any) => s._id === currentStateId || s.id === currentStateId || s.name === currentStateId);
        const stateName = selectedState?.name || (typeof currentStateId === 'string' ? currentStateId : '');
        const selectedStateId = selectedState?._id || selectedState?.id || (typeof currentStateId === 'string' ? currentStateId : '');
        this.configService.getDistricts(stateName, selectedStateId).subscribe({
          next: d => { this.districts = Array.isArray(d) ? d : []; this.cd.detectChanges(); },
          error: () => { this.districts = []; this.cd.detectChanges(); }
        });
      }
      this.cd.detectChanges();
    });
    this.configService.getTiers().subscribe(data => {
      this.tiers = Array.isArray(data) ? data : [];
    });
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

  private loadPremiumMonthlyPrice(): void {
    this.plansService.getActivePlans('BRAND').subscribe((plans) => {
      const paidPlan = plans.find((plan) => (plan?.price?.monthly ?? 0) > 0);
      if (!paidPlan) return;

      const monthly = paidPlan?.price?.monthly ?? 0;
      if (monthly > 0) {
        this.premiumMonthlyPrice = monthly;
      }

      const discountPercent = this.getPlanDiscountPercent(paidPlan, ['discountOnBrandPro', 'discountMonthly']);
        if (discountPercent > 0) {
          this.premiumOriginalMonthlyPrice = monthly;
          this.premiumMonthlyPrice = Math.round(monthly * (1 - discountPercent / 100));
        }
      this.premiumOfferChip = this.resolveOfferChipLabel(paidPlan, discountPercent);
    });
  }

  private getPlanDiscountPercent(plan: Plan, keys: string[]): number {
    if (!Array.isArray(plan?.offers)) return 0;
    const offer = plan.offers.find((item) => keys.includes(item.key) && Number(item.value) > 0);
    return offer ? Number(offer.value) : 0;
  }

  private computeOriginalPrice(discountedPrice: number, discountPercent: number): number | null {
    if (!discountedPrice || !discountPercent || discountPercent <= 0 || discountPercent >= 100) return null;
    const original = Math.round(discountedPrice / (1 - discountPercent / 100));
    return original > discountedPrice ? original : null;
  }

  private resolveOfferChipLabel(plan: Plan, discountPercent: number): string {
    if (plan?.discountLabel) return plan.discountLabel;
    if (discountPercent > 0) return `Founding member pricing · Save ${discountPercent}%`;
    const hasTrialOffer = Array.isArray(plan?.offers)
      && plan.offers.some((item) => item.key === 'trialPeriodDays' && Number(item.value) > 0);
    return hasTrialOffer ? 'Early Access Offer' : '';
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
      // Allow free + premium brands to add all social handles. Visibility to influencers
      // is gated separately by the backend (`canViewBrandSocialMedia`).
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

  /** Returns the list of selected platforms whose handle or tier is missing. */
  invalidPlatforms(): any[] {
    return this.selectedPlatforms().filter(p => {
      const pf = this.platformForms[p._id];
      return !pf || !(pf.handle || '').trim() || !(pf.tier || '').trim();
    });
  }

  /** True when every selected social platform has both handle and tier filled. */
  arePlatformsValid(): boolean {
    return this.invalidPlatforms().length === 0;
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
    this.uploadedProductImages.splice(index, 1);
    this.refreshStepCompletion();
  }

  async onBrandLogoFileChange(event: any) {
    const file: File = event?.target?.files?.[0];
    if (!file) return;
    const validation = this.isValidImageFile(file, this.MAX_IMAGE_SIZE_MB);
    if (!validation.valid) {
      this.registrationError = validation.reason || 'Invalid image file.';
      return;
    }

    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      });
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.brandLogoPreview = e.target.result;
        this.brandLogoFile = compressedFile as File;
        // New file selected — invalidate any previously uploaded result so onSubmit re-uploads.
        this.uploadedBrandLogo = null;
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
    this.uploadedBrandLogo = null;
    this.refreshStepCompletion();
  }

  async onProductImageFileChange(event: any, index: number) {
    const file: File = event?.target?.files?.[0];
    if (!file) return;
    const validation = this.isValidImageFile(file, this.MAX_IMAGE_SIZE_MB);
    if (!validation.valid) {
      this.registrationError = validation.reason || 'Invalid product image.';
      return;
    }

    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      });
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.productImagesPreview[index] = e.target.result;
        this.productImagesFiles[index] = compressedFile as File;
        // New file at this slot — invalidate any previously uploaded result.
        this.uploadedProductImages[index] = null;
        this.refreshStepCompletion();
        this.cd.detectChanges();
      };
      reader.readAsDataURL(compressedFile);
    } catch {
      this.registrationError = 'Product image preview failed.';
    }
  }

  private isValidImageFile(file: any, maxMB = 5): { valid: boolean; reason?: string } {
    if (!file) return { valid: false, reason: 'No file selected.' };
    if (!(file instanceof File)) return { valid: false, reason: 'Selected value is not a file.' };
    if (!file.type || !file.type.startsWith('image/')) return { valid: false, reason: 'Please select an image file.' };
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxMB) return { valid: false, reason: `Image exceeds ${maxMB} MB limit.` };
    return { valid: true };
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
        f.get('contactPersonName')?.valid &&
        f.get('brandUsername')?.valid &&
        f.get('email')?.valid &&
        f.get('phoneNumber')?.valid &&
        f.get('categories')?.valid &&
        f.get('password')?.valid &&
        f.get('confirmPassword')?.valid &&
        !f.errors?.['passwordMismatch'] &&
        this.brandLogoPreview
      );
    }

    if (step === 2) {
      const f = this.registrationForm;
      return !!(
        f.get('location.state')?.valid &&
        f.get('location.district')?.valid &&
        f.get('languages')?.valid
      ) && this.arePlatformsValid();
    }

    if (step === 3) {
      const f = this.registrationForm;
      return !!(
        f.get('paymentOption')?.valid &&
        f.get('contact')?.valid
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
      const fields = ['brandName', 'contactPersonName', 'brandUsername', 'email', 'phoneNumber', 'categories', 'password', 'confirmPassword'];
      fields.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      this.submitted = true;

      if (!this.brandLogoPreview) {
        this.registrationError = 'Brand logo is required.';
      }

      return fields.every((path) => this.registrationForm.get(path)?.valid) &&
        !this.registrationForm.errors?.['passwordMismatch'] &&
        !!this.brandLogoPreview;
    }

    if (this.currentStep === 2) {
      this.step2Attempted = true;
      const required = ['location.state', 'location.district', 'languages'];
      required.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      const baseValid = required.every((path) => this.registrationForm.get(path)?.valid);
      if (!baseValid) return false;
      if (!this.arePlatformsValid()) {
        // Inline platform error is already rendered in the template; do not set
        // registrationError to avoid duplicate messages.
        this.registrationError = '';
        return false;
      }
      this.registrationError = '';
      return true;
    }

    if (this.currentStep === 3) {
      this.registrationForm.get('contact')?.markAsTouched();
      return !!(
        this.registrationForm.get('paymentOption')?.valid &&
        this.registrationForm.get('contact')?.valid
      );
    }

    return false;
  }

  async nextStep() {
    if (!this.validateCurrentStep()) return;

    if (this.currentStep === 1) {
      const noConflicts = await this.validateStep1Uniqueness();
      if (!noConflicts) {
        this.currentStep = 1;
        this.refreshStepCompletion();
        return;
      }
    }

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

  private async validateStep1Uniqueness(): Promise<boolean> {
    this.duplicateBrandNameError = '';
    this.duplicateUsernameError = '';
    this.duplicateEmailError = '';
    this.duplicatePhoneError = '';

    const brandName = String(this.registrationForm.get('brandName')?.value || '').trim();
    const brandUsername = String(this.registrationForm.get('brandUsername')?.value || '').trim();
    const email = String(this.registrationForm.get('email')?.value || '').trim();
    const phoneNumber = String(this.registrationForm.get('phoneNumber')?.value || '').trim();

    if (!brandName && !brandUsername && !email && !phoneNumber) return true;

    const result = await firstValueFrom(
      this.configService.checkRegistrationConflicts({
        userType: 'BRAND',
        brandName,
        brandUsername,
        email,
        phoneNumber,
      }),
    );

    let hasConflict = false;

    if (result.brandName) {
      hasConflict = true;
      this.duplicateBrandNameError = 'Brand name already exists. Please choose another.';
      this.registrationForm.get('brandName')?.setErrors({
        ...(this.registrationForm.get('brandName')?.errors || {}),
        duplicate: true,
      });
    }
    if (result.brandUsername) {
      hasConflict = true;
      this.duplicateUsernameError = 'Brand username already exists. Please choose another.';
      this.registrationForm.get('brandUsername')?.setErrors({
        ...(this.registrationForm.get('brandUsername')?.errors || {}),
        duplicate: true,
      });
    }
    if (result.email) {
      hasConflict = true;
      this.duplicateEmailError = 'Email already exists. Please use another email or login.';
      this.registrationForm.get('email')?.setErrors({
        ...(this.registrationForm.get('email')?.errors || {}),
        duplicate: true,
      });
    }
    if (result.phoneNumber) {
      hasConflict = true;
      this.duplicatePhoneError = 'Mobile number already exists. Please use another number.';
      this.registrationForm.get('phoneNumber')?.setErrors({
        ...(this.registrationForm.get('phoneNumber')?.errors || {}),
        duplicate: true,
      });
    }

    if (hasConflict) {
      this.registrationError = 'Some Step 1 details already exist. Please update and continue.';
      return false;
    }

    this.registrationError = '';
    return true;
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

  private async uploadImage(file: File | Blob, folder?: string): Promise<{ url: string; public_id: string } | null> {
    // Accept both File and Blob (browser-image-compression may return Blob in some envs)
    if (!file || !(file instanceof Blob)) {
      console.warn('[brand-registration] uploadImage skipped: invalid file type', file);
      return null;
    }
    const formData = new FormData();
    // FormData.append accepts a Blob; provide a filename so multer treats it as a file upload
    const filename = (file as File)?.name || `${folder || 'upload'}.jpg`;
    formData.append('file', file, filename);
    if (folder) {
      formData.append('folder', folder);
    }

    try {
      const response = await fetch(`${environment.apiBaseUrl}/auth/upload-image`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        console.warn('[brand-registration] upload failed', response.status, await response.text().catch(() => ''));
        return null;
      }
      const json = await response.json();
      // Backend wraps responses via ResponseInterceptor: { success: true, data: { url, public_id } }
      const uploaded = json?.data || json;
      if (uploaded?.url && uploaded?.public_id) {
        return { url: uploaded.url, public_id: uploaded.public_id };
      }
      console.warn('[brand-registration] upload response missing url/public_id', json);
      return null;
    } catch (err) {
      console.error('[brand-registration] upload error', err);
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
    // Auto-generate username from brandName if not set
    if (!raw.brandUsername) {
      raw.brandUsername = this.slugifyUsername(raw.brandName || '');
    } else {
      raw.brandUsername = this.slugifyUsername(raw.brandUsername || '');
    }

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

    // Reuse a previously uploaded brand logo if available (avoids orphaned uploads on retry).
    let uploadedBrandLogo = this.uploadedBrandLogo;
    if (!uploadedBrandLogo) {
      uploadedBrandLogo = await this.uploadImage(this.brandLogoFile, 'brand_logo');
      if (uploadedBrandLogo) {
        this.uploadedBrandLogo = uploadedBrandLogo;
      }
    }
    if (!uploadedBrandLogo) {
      this.registrationError = 'Brand logo upload failed.';
      this.isSubmitting = false;
      return;
    }

    // Upload product images per slot, reusing any cached upload result so a retry after a
    // backend error doesn't orphan previously uploaded files.
    const uploadedProducts: Array<{ url: string; public_id: string }> = [];
    for (let i = 0; i < this.productImagesFiles.length; i++) {
      const productFile = this.productImagesFiles[i];
      if (!productFile) continue;
      let uploaded = this.uploadedProductImages[i];
      if (!uploaded) {
        uploaded = await this.uploadImage(productFile, 'brand_products');
        if (uploaded) {
          this.uploadedProductImages[i] = uploaded;
        }
      }
      if (!uploaded) {
        this.registrationError = 'One of the product image uploads failed.';
        this.isSubmitting = false;
        return;
      }
      uploadedProducts.push(uploaded);
    }

    const payload: any = {
      ...raw,
      foundedYear: raw.foundedYear ? Number(raw.foundedYear) : undefined,
      promotionalPrice: Number(raw.promotionalPrice) || 0,
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
    if (this.signupAttribution.source || this.signupAttribution.audience || this.signupAttribution.referrerPath) {
      payload.signupAttribution = this.signupAttribution;
    }
    delete payload.googleMapAddress;

    this.configService.registerBrand(payload).subscribe({
      next: () => {
        this.pendingVerificationEmail = raw.email;
        this.showEmailVerificationPrompt = true;
        this.emailVerificationSent = true;
        this.emailVerificationError = null;
        this.platformForms = {};
        this.activePlatformTab = null;
        this.brandLogoPreview = null;
        this.brandLogoFile = null;
        this.uploadedBrandLogo = null;
        this.productImagesPreview = [];
        this.productImagesFiles = [];
        this.uploadedProductImages = [];
        this.currentStep = 1;
        this.submitted = false;
        this.isSubmitting = false;
        // Reset the form first (fires valueChanges which would clear registrationSuccess if set),
        // then on next microtask mark success and run CD — ensures the success modal renders
        // under zoneless change detection.
        this.registrationForm.reset({
          paymentOption: 'free',
          promotionalPrice: 500,
          contact: { whatsapp: false, email: false, call: false }
        });
        this.refreshStepCompletion();
        queueMicrotask(() => {
          this.registrationSuccess = true;
          this.cd.detectChanges();
        });
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
    window.location.href = '/';
  }
}