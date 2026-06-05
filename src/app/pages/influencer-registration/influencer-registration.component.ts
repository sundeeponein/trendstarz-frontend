// ...existing code...
import { environment } from '../../../environments/environment';
import imageCompression from 'browser-image-compression';
import { Component, OnInit, NgZone, inject } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidatorFn, AsyncValidatorFn } from '@angular/forms';
import { map, debounceTime, first } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../shared/config.service';
import { OtpService } from '../../shared/otp.service';
import { passwordStrengthValidator, getPasswordChecks } from '../../shared/password-strength';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TierInfoService } from '../../shared/components/tier-info-modal/tier-info.service';
import { ImageGuidelinesService } from '../../shared/components/image-guidelines-modal/image-guidelines.service';
import { PlansService, Plan } from '../../shared/plans.service';
import { CollaborationAvailabilityFormComponent } from '../../shared/collaboration-availability/collaboration-availability-form.component';
import { FirebaseAuthService } from '../../shared/firebase-auth.service';
import { ChipSelectionGroupComponent } from '../../shared/chip-selection-group/chip-selection-group.component';
import { buildSocialProfileUrl, normalizeSocialHandle, socialHandleExample } from '../../shared/social-handle.util';

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
  selector: 'app-influencer-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule, CollaborationAvailabilityFormComponent, ChipSelectionGroupComponent],
  templateUrl: './influencer-registration.component.html',
  styleUrls: ['./influencer-registration.component.scss']
})
export class InfluencerRegistrationComponent implements OnInit {
  readonly maxCategories = 5;
  readonly maxCreatorTypes = 3;
  readonly maxCollaborationTypes = 3;
  readonly maxAvailableFor = 2;

  setChipValues(field: 'languages' | 'categories' | 'creatorTypes', values: string[]): void {
    this.registrationForm.get(field)?.setValue(values);
    this.registrationForm.get(field)?.markAsTouched();
  }

  openProfilePhotoGuidelines(): void {
    this.guidelinesService.open('influencer');
  }

  // --- Password strength live checks ---
  get passwordChecks() {
    return getPasswordChecks(this.registrationForm?.get('password')?.value || '');
  }

  // --- New Social Media Platform UI ---
  platformForms: { [platformId: string]: any } = {};

  // Platform Tabs UI
  activePlatformTab: string | null = null;

  getPlatformById(id: string) {
    return this.socialMediaList.find(p => p._id === id);
  }

  isPlatformSelected(platform: any): boolean {
    return !!this.platformForms[platform._id];
  }

  togglePlatform(platform: any) {
    if (this.isPlatformSelected(platform)) {
      this.removePlatformCard(platform);
      // If the removed platform was active, clear or switch tab
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

  getProfileUrl(platformName: string, handle: string): string {
    return buildSocialProfileUrl(platformName, handle);
  }

  getTierOptionLabel(tier: any): string {
    const name = String(tier?.name || '').trim();
    const range = String(tier?.desc || '').trim();
    if (!range) return name;
    return `${name} (${range})`;
  }

  stripAtSign(platformId: string) {
    const pf = this.platformForms[platformId];
    if (!pf) return;
    pf.handle = normalizeSocialHandle(pf.handle, this.getPlatformById(platformId)?.name || '');
  }

  getSocialHandleExample(platformName: string): string {
    return socialHandleExample(platformName);
  }

  selectedPlatforms(): any[] {
    return (this.socialMediaList || []).filter(p => this.platformForms[p._id]);
  }

  /** Selected platforms missing handle or tier. */
  invalidPlatforms(): any[] {
    return this.selectedPlatforms().filter(p => {
      const pf = this.platformForms[p._id];
      return !pf || !(pf.handle || '').trim() || !(pf.tier || '').trim() || !this.hasSelectedPricedContentType(pf);
    });
  }

  arePlatformsValid(): boolean {
    return this.invalidPlatforms().length === 0;
  }

  hasSelectedPricedContentType(pf: any): boolean {
    const values = Object.values(pf?.contentTypes || {}) as any[];
    const selected = values.filter((ct: any) => ct?.selected === true);
    return selected.length > 0 && selected.every((ct: any) => Number(ct?.price) > 0);
  }

  getPlatformTotal(platform: any): number {
    const pf = this.platformForms[platform._id];
    if (!pf) return 0;
    let total = 0;
    for (const ctName in pf.contentTypes) {
      const ct = pf.contentTypes[ctName];
      if (ct.selected && ct.price) {
        total += Number(ct.price) || 0;
      }
    }
    return total;
  }

  getGrandTotal(): number {
    return this.selectedPlatforms().reduce((sum, p) => sum + this.getPlatformTotal(p), 0);
  }

  // --- Core properties ---
  readonly FREE_SOCIAL_PROFILE_LIMIT = 10;
  currentStep: 1 | 2 | 3 = 1;
  readonly totalSteps = 3;
  step1Complete = false;
  step2Complete = false;
  step3Complete = false;
  step2Attempted = false;
  emailVerificationSent = false;
  emailVerificationError: string | null = null;
  showPhoneOtp = false;
  showEmailOtp = false;
  phoneOtp: string[] = ['', '', '', '', '', ''];
  emailOtp: string[] = ['', '', '', '', '', ''];
  phoneVerified = false;
  emailVerified = false;
  showEmailVerificationPrompt = false;
  phoneVerifyError = '';
  emailVerifyError = '';
  phoneOtpTimer = 300;
  canResendPhoneOtp = false;
  verifyingPhoneOtp = false;
  phoneOtpError = '';
  private phoneOtpInterval: any;
  resendingEmailVerification = false;
  resendEmailVerificationSuccess = false;
  resendEmailVerificationError: string | null = null;
  pendingVerificationEmail = '';
  registrationSuccess = false;
  registrationEmailSendFailed = false;
  registrationError = '';
  preApproveActive = false;
  showPassword = false;
  showConfirmPassword = false;
  showProfessionalOptional = false;
  verificationDocuments: Array<{ url: string; public_id: string; originalName?: string; mimeType?: string }> = [];
  verificationUploading = false;
  verificationUploadError = '';
  verificationConsentError = '';
  togglePasswordVisibility() { this.showPassword = !this.showPassword; }
  toggleConfirmPasswordVisibility() { this.showConfirmPassword = !this.showConfirmPassword; }
  registrationForm!: FormGroup;
  states: any[] = [];
  socialMediaList: any[] = [];
  collaborationAvailabilityOptions: any = {};
  creatorTypeOptions: any[] = [];
  tiers: any[] = [];
  protected tierInfo = inject(TierInfoService);
  profileImagePreview: string | null = null;
  profileImageFile: File | null = null;
  // Cached upload result so we don't re-upload (and orphan the previous upload) on retry.
  uploadedProfileImage: { url: string; public_id: string } | null = null;
  galleryImagesPreview: string[] = [];
  galleryImagesData: { url: string; public_id: string }[] = [];
  galleryUploadWarning = '';
  freeTotalImageLimit = 3;
  premiumTotalImageLimit = 10;
  languagesList: any[] = [];
  categoriesList: any[] = [];
  districts: any[] = [];
  submitted = false;
  usernameError = '';
  duplicateUsernameError = '';
  duplicateEmailError = '';
  duplicatePhoneError = '';
  verificationCallNumber = '';

  isSubmitting = false;
  stepTransitioning = false;
  signupAttribution: { source?: string; audience?: string; referrerPath?: string } = {};
  premiumMonthlyPrice = 399;
  premiumOriginalMonthlyPrice: number | null = null;
  premiumOfferChip = '';

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private ngZone: NgZone,
    private otpService: OtpService,
    private plansService: PlansService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private guidelinesService: ImageGuidelinesService,
    private firebaseAuth: FirebaseAuthService,
  ) {}

  ngOnInit(): void {
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
      name: ['', Validators.required],
      username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]+$/)]],
      phoneNumber: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      dateOfBirth: ['', Validators.required],
      gender: [''],
      influencerCategory: [''],
      professionalStatus: [false],
      expertiseArea: [''],
      verificationDocuments: [[]],
      verificationDisclaimerAccepted: [false],
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
      paymentOption: ['free', Validators.required],
      location: this.fb.group({ state: ['', Validators.required], district: ['', Validators.required] }),
      promotionalPrice: ['', Validators.required],
      languages: [[], Validators.required],
      categories: [[], Validators.required],
      creatorTypes: [[]],
      profileImages: this.fb.array([]),
      contact: this.fb.group({
        whatsapp: [false], email: [false], call: [false]
      }, { validators: [atLeastOneContactRequired] }),
      collaborationAvailability: this.fb.group({
        enabled: [false],
        collaborationTypes: [[]],
        preference: [''],
        availableFor: [[]],
        openToTravel: [false],
      }),
      website: [''],
    }, { validators: [passwordMatchValidator] });

    this.registrationForm.get('username')?.valueChanges.subscribe(() => this.onUsernameInput());
    this.registrationForm.get('phoneNumber')?.valueChanges.subscribe(() => { this.duplicatePhoneError = ''; });
    this.registrationForm.get('email')?.valueChanges.subscribe(() => { this.duplicateEmailError = ''; });
    
    // Auto-generate username from name if not manually set
    this.registrationForm.get('name')?.valueChanges.subscribe((name: string) => {
      const usernameCtrl = this.registrationForm.get('username');
      if (usernameCtrl && !usernameCtrl.dirty) {
        const slug = this.slugifyUsername(name || '');
        usernameCtrl.setValue(slug, { emitEvent: false });
        usernameCtrl.markAsTouched();
      }
      this.duplicateUsernameError = '';
    });

    this.registrationForm.get('professionalStatus')?.valueChanges.subscribe((isProfessional: boolean) => {
      const catCtrl = this.registrationForm.get('influencerCategory');
      if (isProfessional) {
        catCtrl?.setValidators([Validators.required]);
      } else {
        this.showProfessionalOptional = false;
        catCtrl?.clearValidators();
        catCtrl?.setValue('');
        catCtrl?.markAsUntouched();
        catCtrl?.markAsPristine();
        this.registrationForm.get('expertiseArea')?.setValue('');
      }
      catCtrl?.updateValueAndValidity();
      this.refreshStepCompletion();
    });
    
    this.registrationForm.valueChanges.subscribe(() => {
      if (this.registrationSuccess && this.registrationForm.dirty) this.registrationSuccess = false;
      if (this.registrationError && this.registrationForm.dirty) this.registrationError = '';
    });

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
          next: d => { this.districts = Array.isArray(d) ? d : []; this.cdr.detectChanges(); },
          error: () => { this.districts = []; this.cdr.detectChanges(); }
        });
      }
      this.cdr.detectChanges();
    });
    this.configService.getTiers().subscribe(data => {
      this.tiers = Array.isArray(data) ? data : [];
    });
    this.configService.getSocialMedia().subscribe(data => this.socialMediaList = data);
    this.configService.getCollaborationAvailabilityOptions().subscribe(data => {
      this.collaborationAvailabilityOptions = data || {};
      this.cdr.detectChanges();
    });
    this.configService.getCreatorTypeOptions().subscribe(data => {
      this.creatorTypeOptions = Array.isArray(data) ? data : [];
      this.cdr.detectChanges();
    });
    this.configService.getLanguages().subscribe(data => this.languagesList = data);
    this.configService.getCategories('influencer').subscribe(data => {
      this.categoriesList = data;
      this.cdr.detectChanges();
    });
    this.configService.getAppSettings().subscribe(s => { this.preApproveActive = s.preApproveInfluencers; });

    // Load districts when state changes
    this.registrationForm.get('location.state')?.valueChanges.subscribe(stateId => {
      this.registrationForm.get('location.district')?.setValue('');
      this.districts = [];
      if (stateId) {
        const selectedState = this.states.find((s: any) => s._id === stateId || s.id === stateId || s.name === stateId);
        const stateName = selectedState?.name || (typeof stateId === 'string' ? stateId : '');
        const selectedStateId = selectedState?._id || selectedState?.id || (typeof stateId === 'string' ? stateId : '');
        this.configService.getDistricts(stateName, selectedStateId).subscribe({
          next: data => { this.districts = Array.isArray(data) ? data : []; this.cdr.detectChanges(); },
          error: () => { this.districts = []; this.cdr.detectChanges(); }
        });
      }
    });

    this.registrationForm.get('paymentOption')?.valueChanges.subscribe(() => {
      this.enforcePlatformLimit();
      this.enforceGalleryLimit();
      this.refreshStepCompletion();
    });
    this.registrationForm.valueChanges.subscribe(() => this.refreshStepCompletion());
    this.registrationForm.statusChanges.subscribe(() => this.refreshStepCompletion());
    this.refreshStepCompletion();
  }

  private loadPremiumMonthlyPrice(): void {
    this.plansService.getActivePlans('INFLUENCER').subscribe((plans) => {
      const freePlan = plans.find((plan) => (plan?.price?.monthly ?? 0) === 0);
      const paidPlan = plans.find((plan) => (plan?.price?.monthly ?? 0) > 0);

      const resolveImageLimit = (plan: Plan | undefined, fallback: number): number => {
        if (!plan?.limits?.length) return fallback;
        const hit = plan.limits.find((limit) => String(limit?.key || '').trim() === 'maxProductImages');
        const value = Number(hit?.value);
        return Number.isFinite(value) && value > 0 ? value : fallback;
      };

      this.freeTotalImageLimit = resolveImageLimit(freePlan, this.freeTotalImageLimit);
      this.premiumTotalImageLimit = resolveImageLimit(paidPlan, this.premiumTotalImageLimit);

      if (!paidPlan) return;

      const monthly = paidPlan?.price?.monthly ?? 0;
      if (monthly > 0) {
        this.premiumMonthlyPrice = monthly;
      }

      const discountPercent = this.getPlanDiscountPercent(paidPlan, ['discountOnInfluencerPro', 'discountMonthly']);
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

  private enforcePlatformLimit() {
    if (this.isPremiumPlan()) return;
    const selected = this.selectedPlatforms();
    if (selected.length > this.FREE_SOCIAL_PROFILE_LIMIT) {
      selected.slice(this.FREE_SOCIAL_PROFILE_LIMIT).forEach(p => delete this.platformForms[p._id]);
    }
  }

  refreshStepCompletion() {
    this.step1Complete = this.computeStepComplete(1);
    this.step2Complete = this.computeStepComplete(2);
    this.step3Complete = this.computeStepComplete(3);
  }

  isPremiumPlan(): boolean {
    return this.registrationForm?.get('paymentOption')?.value === 'premium';
  }

  get selectedTotalImageLimit(): number {
    return this.isPremiumPlan() ? this.premiumTotalImageLimit : this.freeTotalImageLimit;
  }

  get maxGalleryImages(): number {
    return Math.max(0, this.selectedTotalImageLimit - 1);
  }

  private enforceGalleryLimit(): void {
    if (this.galleryImagesData.length <= this.maxGalleryImages) return;
    this.galleryImagesData = this.galleryImagesData.slice(0, this.maxGalleryImages);
    this.galleryImagesPreview = this.galleryImagesPreview.slice(0, this.maxGalleryImages);
  }

  private computeStepComplete(step: number): boolean {
    if (step === 1) {
      const f = this.registrationForm;
      return !!(f.get('name')?.valid && f.get('username')?.valid && f.get('phoneNumber')?.valid &&
        f.get('email')?.valid && f.get('dateOfBirth')?.valid && f.get('password')?.valid && f.get('confirmPassword')?.valid &&
        !f.errors?.['passwordMismatch'] && !!this.profileImagePreview);
    }
    if (step === 2) {
      const f = this.registrationForm;
      const isProfessional = !!f.get('professionalStatus')?.value;
      const detailsValid = !!(
        f.get('location.state')?.valid &&
        f.get('location.district')?.valid &&
        f.get('languages')?.valid &&
        f.get('categories')?.valid &&
        (!isProfessional || f.get('influencerCategory')?.valid)
      );
      return detailsValid && this.selectedPlatforms().length > 0 && this.arePlatformsValid();
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
      if (step === 2) this.step2Attempted = false;
      this.refreshStepCompletion();
      this.scrollToTop();
    }
  }

  private canNavigateTo(step: 1 | 2 | 3): boolean {
    if (step === 1) return true;
    if (step === 2) return this.isStepComplete(1);
    return this.isStepComplete(1) && this.isStepComplete(2);
  }

  private scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async nextStep() {
    if (this.stepTransitioning) return;
    this.stepTransitioning = true;

    if (!this.validateCurrentStep()) {
      this.stepTransitioning = false;
      return;
    }

    if (this.currentStep < this.totalSteps) {
      this.currentStep = (this.currentStep + 1) as 1 | 2 | 3;
      this.submitted = false;
      this.registrationError = '';
      if (this.currentStep === 2) this.step2Attempted = false;
      this.refreshStepCompletion();
      this.scrollToTop();
    }

    this.stepTransitioning = false;
  }

  private async validateStep1Uniqueness(): Promise<boolean> {
    this.duplicateUsernameError = '';
    this.duplicateEmailError = '';
    this.duplicatePhoneError = '';

    const username = String(this.registrationForm.get('username')?.value || '').trim();
    const email = String(this.registrationForm.get('email')?.value || '').trim();
    const phoneNumber = String(this.registrationForm.get('phoneNumber')?.value || '').trim();

    if (!username && !email && !phoneNumber) return true;

    const result = await firstValueFrom(
      this.configService.checkRegistrationConflicts({
        userType: 'INFLUENCER',
        username,
        email,
        phoneNumber,
      }),
    );

    let hasConflict = false;

    if (result.username) {
      hasConflict = true;
      this.duplicateUsernameError = 'Username already exists.';
      this.registrationForm.get('username')?.setErrors({
        ...(this.registrationForm.get('username')?.errors || {}),
        duplicate: true,
      });
    }
    if (result.email) {
      hasConflict = true;
      this.duplicateEmailError = 'Email already exists.';
      this.registrationForm.get('email')?.setErrors({
        ...(this.registrationForm.get('email')?.errors || {}),
        duplicate: true,
      });
    }
    if (result.phoneNumber) {
      hasConflict = true;
      this.duplicatePhoneError = 'Mobile number already exists.';
      this.registrationForm.get('phoneNumber')?.setErrors({
        ...(this.registrationForm.get('phoneNumber')?.errors || {}),
        duplicate: true,
      });
    }

    if (hasConflict) {
      this.registrationError = 'Username, email, or mobile already exists. Please update Step 1 details.';
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
      if (this.currentStep === 2) this.step2Attempted = false;
      this.refreshStepCompletion();
      this.scrollToTop();
    }
  }

  private validateCurrentStep(): boolean {
    this.submitted = true;
    if (this.currentStep === 1) {
      ['name', 'username', 'phoneNumber', 'email', 'dateOfBirth', 'password', 'confirmPassword'].forEach(f =>
        this.registrationForm.get(f)?.markAsTouched());
      if (!this.profileImagePreview) { this.registrationError = 'Profile photo is required.'; }
      else { this.registrationError = ''; }
      return this.isStepComplete(1);
    }
    if (this.currentStep === 2) {
      this.step2Attempted = true;
      this.registrationForm.get('location.state')?.markAsTouched();
      this.registrationForm.get('location.district')?.markAsTouched();
      this.registrationForm.get('languages')?.markAsTouched();
      this.registrationForm.get('categories')?.markAsTouched();
      if (this.registrationForm.get('professionalStatus')?.value) {
        this.registrationForm.get('influencerCategory')?.markAsTouched();
      }
      if (this.verificationDocuments.length > 0 && !this.registrationForm.get('verificationDisclaimerAccepted')?.value) {
        this.verificationConsentError = 'Please confirm the declaration for submitted verification documents.';
        return false;
      }
      this.verificationConsentError = '';
      if (this.selectedPlatforms().length === 0) {
        this.registrationError = '';
        return false;
      }
      if (this.selectedPlatforms().length > 0 && !this.arePlatformsValid()) {
        this.registrationError = '';
        return false;
      }
      this.registrationError = '';
      return this.isStepComplete(2);
    }
    if (this.currentStep === 3) {
      this.registrationForm.get('promotionalPrice')?.markAsTouched();
      this.registrationForm.get('contact')?.markAsTouched();
      return this.isStepComplete(3);
    }
    return false;
  }

  slugifyUsername(username: string): string {
    return username.toString().trim().toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '')
      .replace(/-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
  }

  onUsernameInput() {
    const ctrl = this.registrationForm.get('username');
    if (!ctrl) return;
    let value = ctrl.value || '';
    value = value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    ctrl.setValue(value, { emitEvent: false });
    this.usernameError = '';
    this.duplicateUsernameError = '';
  }

  usernameUniqueValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return Promise.resolve(null);
      return this.configService.checkUsernameExists(control.value).pipe(
        debounceTime(300), map((exists: boolean) => (exists ? { usernameTaken: true } : null)), first()
      );
    };
  }

  onEmailBlur(): void {
    const emailCtrl = this.registrationForm.get('email');
    const email = String(emailCtrl?.value || '').trim();

    this.duplicateEmailError = '';
    if (!emailCtrl || !email || emailCtrl.hasError('email')) {
      this.clearDuplicateError(emailCtrl);
      return;
    }

    this.configService
      .checkRegistrationConflicts({
        userType: 'INFLUENCER',
        email,
      })
      .subscribe((result) => {
        if (result?.email) {
          this.duplicateEmailError = 'Email already exists.';
          emailCtrl.setErrors({ ...(emailCtrl.errors || {}), duplicate: true });
          return;
        }
        this.clearDuplicateError(emailCtrl);
      });
  }

  onPhoneBlur(): void {
    const phoneCtrl = this.registrationForm.get('phoneNumber');
    const phoneNumber = String(phoneCtrl?.value || '').trim();

    this.duplicatePhoneError = '';
    if (!phoneCtrl || !phoneNumber) {
      this.clearDuplicateError(phoneCtrl);
      return;
    }

    this.configService
      .checkRegistrationConflicts({
        userType: 'INFLUENCER',
        phoneNumber,
      })
      .subscribe((result) => {
        if (result?.phoneNumber) {
          this.duplicatePhoneError = 'Mobile number already exists.';
          phoneCtrl.setErrors({ ...(phoneCtrl.errors || {}), duplicate: true });
          return;
        }
        this.clearDuplicateError(phoneCtrl);
      });
  }

  onPhoneNumberBlur(): void {
    const phoneCtrl = this.registrationForm.get('phoneNumber');
    const phoneNumber = String(phoneCtrl?.value || '').trim();

    this.duplicatePhoneError = '';
    if (!phoneCtrl || !phoneNumber || phoneCtrl.hasError('required')) {
      this.clearDuplicateError(phoneCtrl);
      return;
    }

    this.configService
      .checkRegistrationConflicts({
        userType: 'INFLUENCER',
        phoneNumber,
      })
      .subscribe((result) => {
        if (result?.phoneNumber) {
          this.duplicatePhoneError = 'Mobile number already exists.';
          phoneCtrl.setErrors({ ...(phoneCtrl.errors || {}), duplicate: true });
          return;
        }
        this.clearDuplicateError(phoneCtrl);
      });
  }

  private clearDuplicateError(control: AbstractControl | null): void {
    if (!control?.errors?.['duplicate']) return;
    const next = { ...(control.errors || {}) } as Record<string, any>;
    delete next['duplicate'];
    control.setErrors(Object.keys(next).length ? next : null);
  }

  resendEmailVerification() {
    this.resendingEmailVerification = true;
    this.resendEmailVerificationSuccess = false;
    this.resendEmailVerificationError = null;
    const email = this.pendingVerificationEmail || this.registrationForm.get('email')?.value;
    if (!email) { this.resendingEmailVerification = false; this.resendEmailVerificationError = 'No email found.'; return; }
    this.configService.sendEmailVerificationLink(email).subscribe({
      next: () => { this.resendingEmailVerification = false; this.resendEmailVerificationSuccess = true; },
      error: (err: any) => { this.resendingEmailVerification = false; this.resendEmailVerificationError = err?.error?.message || 'Failed to resend.'; }
    });
  }

  resendPhoneOtp() { if (!this.canResendPhoneOtp) return; this.sendPhoneOtp(); this.startPhoneOtpTimer(); }

  startPhoneOtpTimer() {
    this.phoneOtpTimer = 300; this.canResendPhoneOtp = false;
    if (this.phoneOtpInterval) clearInterval(this.phoneOtpInterval);
    this.phoneOtpInterval = setInterval(() => { this.phoneOtpTimer--; if (this.phoneOtpTimer <= 0) clearInterval(this.phoneOtpInterval); }, 1000);
    setTimeout(() => this.canResendPhoneOtp = true, 30000);
  }

  sendPhoneOtp() {
    const phone = this.registrationForm.get('phoneNumber')?.value;
    this.otpService.sendOtp('phone', phone).subscribe({ next: () => { this.phoneVerifyError = ''; }, error: () => { this.phoneVerifyError = 'Failed to send OTP'; } });
    this.phoneOtpError = ''; this.startPhoneOtpTimer();
  }

  confirmPhoneOtp() {
    this.verifyingPhoneOtp = true; this.phoneOtpError = '';
    const phone = this.registrationForm.get('phoneNumber')?.value;
    this.otpService.verifyOtp('phone', phone, this.phoneOtp.join('')).subscribe({
      next: () => { this.phoneVerified = true; this.showPhoneOtp = false; this.phoneVerifyError = ''; },
      error: () => { this.phoneOtpError = 'Invalid or expired OTP.'; this.verifyingPhoneOtp = false; }
    });
  }

  sendEmailOtp() {
    const email = this.registrationForm.get('email')?.value;
    this.otpService.sendOtp('email', email).subscribe({ next: () => { this.emailVerifyError = ''; }, error: () => { this.emailVerifyError = 'Failed to send OTP'; } });
  }

  confirmEmailOtp() {
    const email = this.registrationForm.get('email')?.value;
    this.otpService.verifyOtp('email', email, this.emailOtp.join('')).subscribe({
      next: () => { this.emailVerified = true; this.showEmailOtp = false; this.emailVerifyError = ''; },
      error: () => { this.emailVerifyError = 'Invalid OTP'; }
    });
  }

  get profileImagesFormArray() { return this.registrationForm.get('profileImages') as FormArray; }

  async onProfileImageFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const compressedFile = await imageCompression(file, { maxSizeMB: 0.1, maxWidthOrHeight: 1024, useWebWorker: true });
      const reader = new FileReader();
      reader.onload = (e: any) => { this.ngZone.run(() => { this.profileImagePreview = e.target.result; this.profileImageFile = compressedFile as File; this.uploadedProfileImage = null; this.cdr.detectChanges(); this.refreshStepCompletion(); }); };
      reader.readAsDataURL(compressedFile);
    } catch {
      const reader = new FileReader();
      reader.onload = (e: any) => { this.ngZone.run(() => { this.profileImagePreview = e.target.result; this.profileImageFile = file; this.uploadedProfileImage = null; this.cdr.detectChanges(); this.refreshStepCompletion(); }); };
      reader.readAsDataURL(file);
    }
  }

  removeProfileImage(index: number) {
    if (this.profileImagesFormArray.length > index) this.profileImagesFormArray.removeAt(index);
    this.profileImagePreview = null; this.profileImageFile = null; this.uploadedProfileImage = null; this.refreshStepCompletion();
  }

  async onGalleryImagesChange(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files || []);
    if (!files.length) return;

    const remainingSlots = this.maxGalleryImages - this.galleryImagesData.length;
    const selectedFiles = files.slice(0, Math.max(0, remainingSlots));
    if (!selectedFiles.length) return;

    let failedUploads = 0;

    for (const file of selectedFiles) {
      if (!file.type.startsWith('image/')) {
        failedUploads += 1;
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        failedUploads += 1;
        continue;
      }

      const preview = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result || ''));
        reader.onerror = () => reject(new Error('preview_failed'));
        reader.readAsDataURL(file);
      }).catch(() => '');

      if (!preview) {
        failedUploads += 1;
        continue;
      }

      const fd = new FormData();
      fd.append('file', file, file.name || 'gallery.jpg');
      fd.append('folder', 'influencer_gallery_images');

      const uploaded = await new Promise<{ url: string; public_id: string } | null>((resolve) => {
        this.configService.uploadImage(fd).subscribe({
          next: (res: any) => {
            if (res?.url && res?.public_id) {
              resolve({ url: res.url, public_id: res.public_id });
              return;
            }
            resolve(null);
          },
          error: () => resolve(null),
        });
      });

      if (!uploaded) {
        failedUploads += 1;
        continue;
      }

      this.galleryImagesPreview.push(preview);
      this.galleryImagesData.push(uploaded);
      this.cdr.detectChanges();
    }

    this.galleryUploadWarning = failedUploads
      ? `${failedUploads} gallery image${failedUploads > 1 ? 's' : ''} could not be uploaded. Uploaded images are saved and you can continue.`
      : '';

    this.cdr.detectChanges();
  }

  removeGalleryImage(index: number) {
    if (index < 0 || index >= this.galleryImagesData.length) return;
    this.galleryImagesPreview.splice(index, 1);
    this.galleryImagesData.splice(index, 1);
    this.galleryUploadWarning = '';
  }

  async onSubmit() {
    if (this.isSubmitting) return;
    this.submitted = true;
    this.duplicateUsernameError = ''; this.duplicateEmailError = ''; this.duplicatePhoneError = '';

    if (this.registrationForm.invalid || !this.profileImagePreview) {
      if (this.registrationForm.get('username')?.hasError('usernameTaken'))
        this.usernameError = 'Username already exists. Please choose another.';
      if (!this.profileImagePreview) this.registrationError = 'Profile image is required.';
      return;
    }

    this.isSubmitting = true; this.registrationError = ''; this.registrationSuccess = false;
    const raw = this.registrationForm.value;
    if (this.verificationDocuments.length > 0 && !raw.verificationDisclaimerAccepted) {
      this.verificationConsentError = 'Please confirm the declaration for submitted verification documents.';
      this.isSubmitting = false;
      return;
    }
    this.verificationConsentError = '';
    if (raw.username) raw.username = this.slugifyUsername(raw.username);

    const stateObj = this.states.find(s => s._id === raw.location.state);
    const districtObj = this.districts.find(d => d._id === raw.location.district);
    const languageNames = (raw.languages || []).map((id: string) => { const l = this.languagesList.find((x: any) => x._id === id); return l ? l.name : id; });
    const categoryNames = (raw.categories || []).map((id: string) => { const c = this.categoriesList.find((x: any) => x._id === id); return c ? c.name : id; });
    const creatorTypeNames = (raw.creatorTypes || []).map((id: string) => {
      const item = this.creatorTypeOptions.find((x: any) => x._id === id || x.name === id);
      return item ? item.name : id;
    }).filter((name: string) => !!String(name || '').trim());
    const influencerCategoryName = raw.influencerCategory
      ? (this.categoriesList.find((x: any) => x._id === raw.influencerCategory)?.name || raw.influencerCategory)
      : '';

    const socialMedia = this.selectedPlatforms().map(platform => {
      const pf = this.platformForms[platform._id];
      return {
        platform: platform.name,
        handle: normalizeSocialHandle(pf.handle, platform.name),
        followersCount: Number(pf.followersCount) || 0,
        tier: pf.tier,
        contentTypes: Object.entries(pf.contentTypes)
          .filter(([_, v]: any) => v.selected)
          .map(([name, v]: any) => ({ name, enabled: true, price: Number(v.price) || 0 }))
      };
    });

    let imageUploadResult: { url: string; public_id: string } | null = this.uploadedProfileImage;
    if (!imageUploadResult && this.profileImageFile) {
      const fd = new FormData();
      // Provide a filename so multer treats Blob output from imageCompression as a file upload.
      const filename = (this.profileImageFile as File)?.name || 'profile.jpg';
      fd.append('file', this.profileImageFile, filename);
      fd.append('folder', 'influencer_profile_images');
      try {
        const resp = await fetch(`${environment.apiBaseUrl}/auth/upload-image`, { method: 'POST', body: fd });
        if (!resp.ok) {
          this.registrationError = 'Profile image upload failed.';
          this.isSubmitting = false;
          return;
        }
        const data = await resp.json();
        const uploaded = data?.data || data;
        if (uploaded?.url && uploaded?.public_id) {
          imageUploadResult = { url: uploaded.url, public_id: uploaded.public_id };
          // Cache so retries (e.g., after duplicate-email error) reuse the same upload.
          this.uploadedProfileImage = imageUploadResult;
        }
        else { this.registrationError = 'Profile image upload failed.'; this.isSubmitting = false; return; }
      } catch { this.registrationError = 'Profile image upload failed.'; this.isSubmitting = false; return; }
    }

    const payload: any = {
      ...raw,
      location: { state: stateObj ? stateObj.name : raw.location.state, district: districtObj ? districtObj.name : raw.location.district },
      languages: languageNames, categories: categoryNames,
      creatorTypes: creatorTypeNames,
      influencerCategory: influencerCategoryName,
      professionalStatus: !!raw.professionalStatus,
      expertiseArea: raw.expertiseArea || '',
      verificationDocuments: this.verificationDocuments,
      verificationDisclaimerAccepted: !!raw.verificationDisclaimerAccepted,
      collaborationAvailability: raw.collaborationAvailability,
      socialMedia,
      profileImages: [
        ...(imageUploadResult ? [imageUploadResult] : []),
        ...this.galleryImagesData,
      ],
      contact: raw.contact
    };
    if (this.signupAttribution.source || this.signupAttribution.audience || this.signupAttribution.referrerPath) {
      payload.signupAttribution = this.signupAttribution;
    }

    this.configService.registerInfluencer(payload).subscribe({
      next: async () => {
        try {
          await this.firebaseAuth.sendVerificationEmail(raw.email, raw.password);
        } catch (error: any) {
          this.ngZone.run(() => {
            this.pendingVerificationEmail = raw.email;
            this.showEmailVerificationPrompt = true;
            this.emailVerificationSent = false;
            this.emailVerificationError = this.firebaseAuth.getFirebaseAuthErrorMessage(error);
            this.registrationError = '';
            this.registrationEmailSendFailed = true;
            this.isSubmitting = false;
            this.cdr.detectChanges();
          });
          return;
        }
        this.ngZone.run(() => {
          this.pendingVerificationEmail = raw.email;
          this.showEmailVerificationPrompt = true; this.emailVerificationSent = true; this.emailVerificationError = null;
          this.profileImagePreview = null; this.profileImageFile = null; this.uploadedProfileImage = null;
          this.galleryImagesPreview = []; this.galleryImagesData = []; this.galleryUploadWarning = '';
          this.platformForms = {}; this.submitted = false; this.isSubmitting = false;
          // Reset the form first (fires valueChanges which may clear registrationSuccess if set),
          // then on next microtask mark success and run CD — ensures the success modal renders.
          this.registrationForm.reset();
          queueMicrotask(() => {
            this.registrationSuccess = true;
            this.registrationEmailSendFailed = false;
            this.cdr.detectChanges();
          });
        });
      },
      error: err => {
        const rawMessage = err?.error?.message;
        const parsedMessage = Array.isArray(rawMessage)
          ? rawMessage.join(', ')
          : typeof rawMessage === 'object' && rawMessage !== null
            ? String((rawMessage as any).message || JSON.stringify(rawMessage))
            : String(rawMessage || err?.message || '');
        const msg = parsedMessage.toLowerCase();
        const dups: string[] = Array.isArray(err?.error?.duplicateFields) ? err.error.duplicateFields.map((f: any) => String(f).toLowerCase()) : [];
        const duplicateLabels: string[] = [];
        if (dups.includes('username')) {
          this.duplicateUsernameError = 'Username already exists.';
          this.registrationForm.get('username')?.setErrors({ duplicate: true });
          duplicateLabels.push('Username');
        }
        if (dups.includes('email')) {
          this.duplicateEmailError = 'Email already exists.';
          this.registrationForm.get('email')?.setErrors({ duplicate: true });
          duplicateLabels.push('Email');
        }
        if (dups.includes('phonenumber') || dups.includes('phone') || dups.includes('mobile')) {
          this.duplicatePhoneError = 'Mobile number already exists.';
          this.registrationForm.get('phoneNumber')?.setErrors({ duplicate: true });
          duplicateLabels.push('Mobile number');
        }
        if (dups.length) {
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
        if (msg.includes('username') && msg.includes('already exists')) { this.duplicateUsernameError = 'Username already exists.'; this.currentStep = 1; this.isSubmitting = false; return; }
        if (msg.includes('email') && msg.includes('already exists')) { this.duplicateEmailError = 'Email already exists.'; this.currentStep = 1; this.isSubmitting = false; return; }
        if ((msg.includes('phone') || msg.includes('mobile')) && msg.includes('already exists')) { this.duplicatePhoneError = 'Mobile number already exists.'; this.currentStep = 1; this.isSubmitting = false; return; }
        this.registrationError = parsedMessage || 'Registration failed. Please try again.';
        this.refreshStepCompletion(); this.isSubmitting = false;
      }
    });
  }

  closeSuccessModal() {
    this.registrationSuccess = false;
    this.registrationForm.reset();
    this.profileImagePreview = null;
    this.profileImageFile = null;
    this.verificationDocuments = [];
    this.verificationUploadError = '';
    this.verificationConsentError = '';
    this.platformForms = {};
    this.submitted = false;
    this.pendingVerificationEmail = '';
    window.location.href = '/';
  }

  closeEmailSendFailedModal() {
    this.registrationEmailSendFailed = false;
    this.registrationForm.reset();
    this.profileImagePreview = null;
    this.profileImageFile = null;
    this.verificationDocuments = [];
    this.verificationUploadError = '';
    this.verificationConsentError = '';
    this.platformForms = {};
    this.submitted = false;
    this.pendingVerificationEmail = '';
    window.location.href = '/login';
  }

  toggleProfessionalOptional(): void {
    this.showProfessionalOptional = !this.showProfessionalOptional;
  }

  async onVerificationFilesChange(event: any): Promise<void> {
    this.verificationUploadError = '';
    const files: File[] = Array.from(event?.target?.files || []);
    if (!files.length) return;

    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    this.verificationUploading = true;
    try {
      for (const file of files) {
        if (!allowed.has(file.type)) {
          this.verificationUploadError = 'Only PDF, JPG, PNG files are allowed.';
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          this.verificationUploadError = 'Each file must be 10 MB or smaller.';
          continue;
        }

        const fd = new FormData();
        fd.append('file', file, file.name);
        const resp = await fetch(`${environment.apiBaseUrl}/auth/upload-verification`, {
          method: 'POST',
          body: fd,
        });
        if (!resp.ok) {
          this.verificationUploadError = 'Verification upload failed for one or more files.';
          continue;
        }
        const uploaded = await resp.json();
        if (uploaded?.url && uploaded?.public_id) {
          this.verificationDocuments = [
            ...this.verificationDocuments,
            {
              url: uploaded.url,
              public_id: uploaded.public_id,
              originalName: uploaded.originalName || file.name,
              mimeType: uploaded.mimeType || file.type,
            },
          ];
        }
      }
      this.registrationForm.get('verificationDocuments')?.setValue(this.verificationDocuments);
      this.registrationForm.get('verificationDocuments')?.markAsDirty();
      this.cdr.detectChanges();
    } catch {
      this.verificationUploadError = 'Verification upload failed. Please try again.';
    } finally {
      this.verificationUploading = false;
      if (event?.target) event.target.value = '';
    }
  }

  removeVerificationDocument(index: number): void {
    this.verificationDocuments = this.verificationDocuments.filter((_, i) => i !== index);
    this.registrationForm.get('verificationDocuments')?.setValue(this.verificationDocuments);
    if (!this.verificationDocuments.length) {
      this.registrationForm.get('verificationDisclaimerAccepted')?.setValue(false);
      this.verificationConsentError = '';
    }
  }
}
