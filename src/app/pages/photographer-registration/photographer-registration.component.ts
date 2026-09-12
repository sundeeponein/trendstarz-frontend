import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { FirebaseAuthService } from '../../shared/firebase-auth.service';
import { OtpService } from '../../shared/otp.service';
import { passwordStrengthValidator, getPasswordChecks } from '../../shared/password-strength';
import { ImageGuidelinesService } from '../../shared/components/image-guidelines-modal/image-guidelines.service';
import { PlansService, Plan } from '../../shared/plans.service';
import { CollaborationAvailabilityFormComponent } from '../../shared/collaboration-availability/collaboration-availability-form.component';
import { ChipSelectionGroupComponent } from '../../shared/chip-selection-group/chip-selection-group.component';
import { buildSocialProfileUrl, normalizeSocialHandle, socialHandleExample, validateSocialHandle } from '../../shared/social-handle.util';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { RegistrationNoticeComponent } from '../../shared/components/registration-notice/registration-notice.component';
import { MobileBottomActionsComponent } from '../../shared/components/mobile-bottom-actions/mobile-bottom-actions.component';
import { captureSignupAttribution } from '../../shared/signup-attribution.util';
import { ImageCropModalComponent } from '../../shared/components/image-crop-modal/image-crop-modal.component';
import { validateImageFile, compressImageFile, isOversizedAfterCompression, OVERSIZE_MESSAGE } from '../../shared/utils/image-upload.util';
import { ProfileVisibilitySelectorComponent } from '../../shared/components/profile-visibility-selector/profile-visibility-selector.component';
import { HomepageFeatureToggleComponent } from '../../shared/components/homepage-feature-toggle/homepage-feature-toggle.component';

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
  selector: 'app-photographer-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, CollaborationAvailabilityFormComponent, ChipSelectionGroupComponent, ConfirmDialogComponent, RegistrationNoticeComponent, MobileBottomActionsComponent, ImageCropModalComponent, ProfileVisibilitySelectorComponent, HomepageFeatureToggleComponent],
  templateUrl: './photographer-registration.component.html',
  styleUrls: ['./photographer-registration.component.scss'],
})
export class PhotographerRegistrationComponent implements OnInit {
  skillOptions: string[] = [];
  equipmentOptions: any[] = [];
  pricingOptions: any[] = [];

  private readonly fallbackEquipment = ['Sony', 'Canon', 'DJI', 'iPhone Creator'];
  private readonly fallbackPricing = [
    { key: 'Starting Price', label: 'Starting Price' },
    { key: 'Per Reel', label: 'Per Reel' },
    { key: 'Per Shoot', label: 'Per Shoot' },
    { key: 'Hourly', label: 'Hourly' },
    { key: 'Equipment', label: 'Equipment Rental' },
  ];

  currentStep: 1 | 2 | 3 = 1;
  step1Complete = false;
  step2Complete = false;
  step3Complete = false;

  form!: FormGroup;
  submitted = false;
  submitting = false;
  registrationSuccess = false;
  registrationEmailSendFailed = false;
  registrationError = '';
  resendingEmailVerification = false;
  resendEmailVerificationSuccess = false;
  resendEmailVerificationError: string | null = null;
  pendingVerificationEmail = '';
  showPhoneOtp = false;
  phoneOtp: string[] = ['', '', '', '', '', ''];
  phoneVerified = false;
  phoneVerifyError = '';
  verifyingPhoneOtp = false;
  phoneOtpError = '';
  phoneOtpTimer = 300;
  canResendPhoneOtp = false;
  mobileOtpVerificationToken = '';
  otpVerificationEnabled = false;
  private phoneOtpInterval: any;
  profileConfirmOpen = false;
  profileConfirmMessage = '';
  private profileConfirmResolver: ((confirmed: boolean) => void) | null = null;
  readonly maxSkills = 3;
  readonly maxAvailableFor = 2;

  get localAuthBypassEnabled(): boolean {
    return this.firebaseAuth.isLocalAuthBypassEnabled();
  }

  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];
  collaborationAvailabilityOptions: any = {};

  // Pricing state: { [key]: { enabled: boolean; price: string } }
  pricingState: { [key: string]: { enabled: boolean; price: string } } = {};

  // Platform forms (similar to influencer registration)
  platformForms: {
    [platformId: string]: {
      handle: string;
      followersCount: string;
      tier: string;
      contentTypes: { [name: string]: { selected: boolean; price: string } };
    };
  } = {};
  activePlatformTab: string | null = null;
  tiers: any[] = [];

  profileImagePreview = '';
  profileImageData: { url: string; public_id: string } | null = null;
  uploadingImage = false;

  duplicateEmailError = '';
  duplicatePhoneError = '';
  duplicateUsernameError = '';
  showPassword = false;
  showConfirmPassword = false;
  premiumMonthlyPrice = 399;
  premiumOriginalMonthlyPrice: number | null = null;
  premiumOfferChip = '';

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  get passwordChecks() {
    return getPasswordChecks(this.form?.get('password')?.value || '');
  }

  private slugifyUsername(username: string): string {
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

  constructor(
    private fb: FormBuilder,
    private config: ConfigService,
    private firebaseAuth: FirebaseAuthService,
    private otpService: OtpService,
    private plansService: PlansService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private guidelinesService: ImageGuidelinesService,
  ) {}

  openProfilePhotoGuidelines(): void {
    this.guidelinesService.open('influencer');
  }

  private loadPlanConfig(): void {
    this.plansService.getActivePlans('PHOTOGRAPHER').subscribe((plans) => {
      const paidPlan = plans.find((plan) => (plan?.price?.monthly ?? 0) > 0);

      if (paidPlan) {
        const monthly = Number(paidPlan?.price?.monthly || 0);
        if (monthly > 0) this.premiumMonthlyPrice = monthly;

        const discountPercent = this.getPlanDiscountPercent(paidPlan, ['discountOnPhotographerPro', 'discountMonthly']);
        if (discountPercent > 0) {
          this.premiumOriginalMonthlyPrice = monthly;
          this.premiumMonthlyPrice = Math.round(monthly * (1 - discountPercent / 100));
        }
        this.premiumOfferChip = this.resolveOfferChipLabel(paidPlan, discountPercent);
      }

      this.cdr.detectChanges();
    });
  }

  private getPlanDiscountPercent(plan: Plan, keys: string[]): number {
    if (!Array.isArray(plan?.offers)) return 0;
    const offer = plan.offers.find((item) => keys.includes(item.key) && Number(item.value) > 0);
    return offer ? Number(offer.value) : 0;
  }

  private resolveOfferChipLabel(plan: Plan, discountPercent: number): string {
    const bonusMonths = this.getPlanDiscountPercent(plan, ['bonusMonthsMonthly']);
    const bonusSuffix = bonusMonths > 0 ? ` · +${bonusMonths} mo free` : '';
    if (plan?.discountLabel) return plan.discountLabel + bonusSuffix;
    if (discountPercent > 0) return `Founding member pricing · Save ${discountPercent}%${bonusSuffix}`;
    if (bonusMonths > 0) return `Pay 1 month, get ${1 + bonusMonths} months`;
    const hasTrialOffer = Array.isArray(plan?.offers)
      && plan.offers.some((item) => item.key === 'trialPeriodDays' && Number(item.value) > 0);
    return hasTrialOffer ? 'Early Access Offer' : '';
  }

  // Warn before an accidental refresh/close/navigation wipes unsaved progress.
  // Nothing is persisted client- or server-side before a successful submit,
  // so this is the only guard against silent data loss.
  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.form?.dirty && !this.registrationSuccess) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  ngOnInit() {
    this.loadPlanConfig();
    this.config.getAppSettings().subscribe((settings) => {
      this.otpVerificationEnabled = !!settings.otpVerificationEnabled;
      this.cdr.detectChanges();
    });
    this.form = this.fb.group({
      name: ['', Validators.required],
      username: ['', [Validators.required, Validators.pattern('^[a-zA-Z0-9_\\-]+$')]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', Validators.required],
      dateOfBirth: [''],
      gender: [''],
      portfolio: [''],
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
      location: this.fb.group({
        state: ['', Validators.required],
        district: ['', Validators.required],
      }),
      paymentOption: ['free', Validators.required],
      profileVisibility: ['PUBLIC'],
      featuredInMarketing: [false],
      skills: [[]],
      equipment: [[]],
      payout: this.fb.group({
        upiId: [''],
        mobile: [''],
        accountHolderName: [''],
      }),
      contact: this.fb.group({
        whatsapp: [false],
        email: [false],
        call: [false],
      }, { validators: [atLeastOneContactRequired] }),
      collaborationAvailability: this.fb.group({
        enabled: [false],
        availableFor: [[]],
        preference: [''],
        openToTravel: [false],
      }),
    }, { validators: [passwordMatchValidator] });

    this.form.get('email')?.valueChanges.subscribe(() => { this.duplicateEmailError = ''; });
    this.form.get('phoneNumber')?.valueChanges.subscribe(() => { this.duplicatePhoneError = ''; });
    this.form.get('username')?.valueChanges.subscribe(value => {
      if (typeof value === 'string' && value.includes(' ')) {
        const sanitized = value.replace(/\s+/g, '-');
        this.form.get('username')?.setValue(sanitized, { emitEvent: false });
      }
      this.duplicateUsernameError = '';
    });

    // Auto-generate username from full name unless user edits username manually.
    this.form.get('name')?.valueChanges.subscribe((name: string) => {
      const usernameCtrl = this.form.get('username');
      if (usernameCtrl && !usernameCtrl.dirty) {
        const slug = this.slugifyUsername(name || '');
        usernameCtrl.setValue(slug, { emitEvent: false });
        usernameCtrl.markAsTouched();
      }
      this.duplicateUsernameError = '';
    });

    this.form.get('location.state')?.valueChanges.subscribe(stateId => {
      this.form.get('location.district')?.setValue('');
      this.districts = [];
      if (stateId) {
        const selectedState = this.states.find((s: any) => s._id === stateId || s.name === stateId);
        const stateName = selectedState?.name || stateId;
        const selectedStateId = selectedState?._id || stateId;
        this.config.getDistricts(stateName, selectedStateId).subscribe({
          next: d => { this.districts = Array.isArray(d) ? d : []; this.cdr.detectChanges(); },
          error: () => { this.districts = []; },
        });
      }
    });

    this.form.get('paymentOption')?.valueChanges.subscribe(() => {
      this.cdr.detectChanges();
    });

    this.config.getStates().subscribe(data => { this.states = data; this.cdr.detectChanges(); });
    this.config.getPhotographerCategories().subscribe((data: string[]) => {
      this.skillOptions = Array.isArray(data) ? data : [];
      this.cdr.detectChanges();
    });
    this.config.getEquipmentOptions().subscribe((data: any[]) => {
      const list = (Array.isArray(data) ? data : []);
      this.equipmentOptions = (list.length ? list : this.fallbackEquipment)
        .map((e: any) => String(typeof e === 'string' ? e : (e?.name || '')).trim())
        .filter((n: string) => !!n);
      this.cdr.detectChanges();
    });
    this.config.getPricingOptions().subscribe((data: any[]) => {
      const list = Array.isArray(data) ? data : [];
      this.pricingOptions = list.length ? list : this.fallbackPricing;
      this.pricingOptions.forEach(p => {
        this.pricingState[p.key] = { enabled: false, price: '' };
      });
      this.cdr.detectChanges();
    });
    this.config.getSocialMedia().subscribe(data => { this.socialMediaList = data; this.cdr.detectChanges(); });
    this.config.getCollaborationAvailabilityOptions().subscribe(data => {
      this.collaborationAvailabilityOptions = data || {};
      this.cdr.detectChanges();
    });
    this.config.getTiers().subscribe(data => { this.tiers = Array.isArray(data) ? data : []; });
  }

  setSkills(values: string[]): void {
    this.form.get('skills')?.setValue(values);
    this.form.get('skills')?.markAsTouched();
  }

  toggleEquipment(eq: string) {
    const arr: string[] = [...(this.form.get('equipment')?.value || [])];
    const idx = arr.indexOf(eq);
    idx > -1 ? arr.splice(idx, 1) : arr.push(eq);
    this.form.get('equipment')?.setValue(arr);
  }

  isEquipmentSelected(eq: string): boolean {
    return (this.form.get('equipment')?.value || []).includes(eq);
  }

  onEmailBlur(): void {
    const emailCtrl = this.form.get('email');
    const email = String(emailCtrl?.value || '').trim();

    this.duplicateEmailError = '';
    if (!emailCtrl || !email || emailCtrl.hasError('email')) {
      this.clearDuplicateError(emailCtrl);
      return;
    }

    this.config
      .checkRegistrationConflicts({
        userType: 'INFLUENCER',
        email,
      })
      .subscribe((result) => {
        if (result?.email) {
          this.duplicateEmailError = 'This email is already registered.';
          emailCtrl.setErrors({ ...(emailCtrl.errors || {}), duplicate: true });
          return;
        }
        this.clearDuplicateError(emailCtrl);
      });
  }

  onPhoneBlur(): void {
    const phoneCtrl = this.form.get('phoneNumber');
    const phoneNumber = String(phoneCtrl?.value || '').trim();

    this.duplicatePhoneError = '';
    if (!phoneCtrl || !phoneNumber) {
      this.clearDuplicateError(phoneCtrl);
      return;
    }

    this.config
      .checkRegistrationConflicts({
        userType: 'INFLUENCER',
        phoneNumber,
      })
      .subscribe((result) => {
        if (result?.phoneNumber) {
          this.duplicatePhoneError = 'This phone number is already registered.';
          phoneCtrl.setErrors({ ...(phoneCtrl.errors || {}), duplicate: true });
          return;
        }
        this.clearDuplicateError(phoneCtrl);
      });
  }

  onPhoneNumberBlur(): void {
    const phoneCtrl = this.form.get('phoneNumber');
    const phoneNumber = String(phoneCtrl?.value || '').trim();

    this.duplicatePhoneError = '';
    if (!phoneCtrl || !phoneNumber || phoneCtrl.hasError('required')) {
      this.clearDuplicateError(phoneCtrl);
      return;
    }

    this.config
      .checkRegistrationConflicts({
        userType: 'INFLUENCER',
        phoneNumber,
      })
      .subscribe((result) => {
        if (result?.phoneNumber) {
          this.duplicatePhoneError = 'This phone number is already registered.';
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

  // Social platform helpers
  isPlatformSelected(platform: any): boolean {
    return !!this.platformForms[platform._id];
  }

  getPlatformById(id: string | null): any {
    if (!id) return null;
    return (this.socialMediaList || []).find((p: any) => p._id === id) || null;
  }

  togglePlatform(platform: any) {
    if (this.isPlatformSelected(platform)) {
      this.removePlatformCard(platform);
    } else {
      this.platformForms[platform._id] = {
        handle: '',
        followersCount: '',
        tier: '',
        contentTypes: Object.fromEntries(
          (platform.contentTypes || []).map((ct: any) => [ct.name, { selected: false, price: '' }]),
        ),
      };
      this.activePlatformTab = platform._id;
    }
    this.cdr.detectChanges();
  }

  removePlatformCard(platform: any) {
    delete this.platformForms[platform._id];
    if (this.activePlatformTab === platform._id) {
      const remaining = this.selectedPlatforms();
      this.activePlatformTab = remaining.length ? remaining[0]._id : null;
    }
  }

  selectedPlatforms(): any[] {
    return this.socialMediaList.filter(p => this.platformForms[p._id]);
  }

  stripAtSign(platformId: string) {
    const pf = this.platformForms[platformId];
    if (pf) pf.handle = normalizeSocialHandle(pf.handle, this.socialMediaList.find(p => p._id === platformId)?.name || '');
  }

  getProfileUrl(platformName: string, handle: string): string {
    return buildSocialProfileUrl(platformName, handle);
  }

  getSocialHandleExample(platformName: string): string {
    return socialHandleExample(platformName);
  }

  getSocialHandleError(platform: any): string {
    const pf = this.platformForms[platform?._id];
    if (!pf) return 'Username is required.';
    return validateSocialHandle(pf.handle, platform?.name || '') || '';
  }

  get platformsValid(): boolean {
    const selected = this.selectedPlatforms();
    if (selected.length === 0) return false;
    return selected.every(p => {
      const pf = this.platformForms[p._id];
      return pf && !this.getSocialHandleError(p) && (pf.tier || '').trim() && this.hasSelectedPricedContentType(pf);
    });
  }

  hasSelectedPricedContentType(pf: any): boolean {
    const values = Object.values(pf?.contentTypes || {}) as any[];
    if (!values.length) return true;
    const selected = values.filter((ct: any) => ct?.selected === true);
    return selected.length > 0 && selected.every((ct: any) => Number(ct?.price) > 0);
  }

  getTierOptionLabel(tier: any): string {
    const name = String(tier?.name || '').trim();
    const desc = String(tier?.desc || '').trim();
    return desc ? `${name} (${desc})` : name;
  }

  get hasSelectedPricing(): boolean {
    return this.pricingOptions.some((p: any) =>
      p.key !== 'Starting Price' && this.pricingState[p.key]?.enabled && Number(this.pricingState[p.key]?.price) > 0);
  }

  /** Pricing options shown to the photographer — Starting Price itself is derived, never a manual option. */
  get visiblePricingOptions(): any[] {
    return (this.pricingOptions || []).filter((p: any) => p.key !== 'Starting Price');
  }

  /** Starting Price is always derived — never manually typed — as the lowest enabled service rate. */
  get computedStartingPriceRupees(): number {
    const prices = this.pricingOptions
      .filter((p: any) => p.key !== 'Starting Price' && this.pricingState[p.key]?.enabled && Number(this.pricingState[p.key]?.price) > 0)
      .map((p: any) => Number(this.pricingState[p.key].price));
    return prices.length ? Math.min(...prices) : 0;
  }

  get hasSelectedSkills(): boolean {
    const skills = this.form.get('skills')?.value;
    return Array.isArray(skills) && skills.length > 0;
  }

  // Profile image
  cropModalOpen = false;
  cropSourceFile: File | null = null;
  private profileImageInputEl: HTMLInputElement | null = null;

  onProfileImageFileChange(event: Event) {
    this.profileImageInputEl = event.target as HTMLInputElement;
    const file = this.profileImageInputEl.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) { alert(validationError); return; }
    this.cropSourceFile = file;
    this.cropModalOpen = true;
  }

  onProfileImageCropCancelled(): void {
    this.cropModalOpen = false;
    this.cropSourceFile = null;
    if (this.profileImageInputEl) this.profileImageInputEl.value = '';
  }

  async onProfileImageCropped(file: File) {
    this.cropModalOpen = false;
    this.cropSourceFile = null;
    if (this.profileImageInputEl) this.profileImageInputEl.value = '';
    this.uploadingImage = true;
    const compressedFile = await compressImageFile(file, 'profile');
    if (isOversizedAfterCompression(compressedFile)) {
      this.uploadingImage = false;
      this.registrationError = OVERSIZE_MESSAGE;
      this.cdr.detectChanges();
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => { this.profileImagePreview = e.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(compressedFile);
    const formData = new FormData();
    formData.append('file', compressedFile);
    formData.append('folder', 'photographers/_pending/profile');
    this.config.uploadImage(formData).subscribe({
      next: (res: any) => {
        if (!res?.url || !res?.public_id) {
          this.uploadingImage = false;
          this.profileImagePreview = '';
          this.registrationError = 'Image upload failed. Please try again.';
          this.cdr.detectChanges();
          return;
        }
        this.profileImageData = { url: res.url, public_id: res.public_id };
        this.uploadingImage = false;
        this.cdr.detectChanges();
      },
      error: () => { this.uploadingImage = false; this.profileImagePreview = ''; },
    });
  }

  removeProfileImage() {
    this.profileImagePreview = '';
    this.profileImageData = null;
  }

  // Step navigation
  goToStep(step: 1 | 2 | 3) {
    if (step === 2 && !this.step1Complete) return;
    if (step === 3 && !this.step2Complete) return;
    this.currentStep = step;
  }

  nextStep() {
    if (this.currentStep === 1) {
      this.submitted = true;
      const step1Fields = ['name', 'username', 'email', 'phoneNumber', 'password', 'confirmPassword', 'location'];
      const hasErrors = step1Fields.some(f => this.form.get(f)?.invalid);
      const pwMismatch = this.form.errors?.['passwordMismatch'];
      if (hasErrors || pwMismatch || !this.profileImagePreview) return;
      this.step1Complete = true;
      this.submitted = false;
      this.currentStep = 2;
    } else if (this.currentStep === 2) {
      this.submitted = true;
      if (!this.hasSelectedSkills) return;
      if (!this.hasSelectedPricing) return;
      if (!this.platformsValid) return;
      if (this.form.get('collaborationAvailability.enabled')?.value && !this.form.get('collaborationAvailability.preference')?.value) {
        this.registrationError = 'Please select a preferred collaboration type.';
        return;
      }
      this.step2Complete = true;
      this.submitted = false;
      this.currentStep = 3;
    }
    this.cdr.detectChanges();
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep = (this.currentStep - 1) as 1 | 2 | 3;
      this.cdr.detectChanges();
    }
  }

  isPremiumPlan(): boolean {
    return this.form.get('paymentOption')?.value === 'premium';
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
      if (this.phoneOtpTimer <= 0) clearInterval(this.phoneOtpInterval);
    }, 1000);
    setTimeout(() => this.canResendPhoneOtp = true, 30000);
  }

  sendPhoneOtp() {
    if (!this.otpVerificationEnabled) return;
    const phone = this.form.get('phoneNumber')?.value;
    this.mobileOtpVerificationToken = '';
    this.phoneVerified = false;
    this.otpService.sendOtp('phone', phone).subscribe({
      next: () => {
        this.phoneVerifyError = '';
        this.showPhoneOtp = true;
      },
      error: () => { this.phoneVerifyError = 'Failed to send OTP'; },
    });
    this.phoneOtpError = '';
    this.startPhoneOtpTimer();
  }

  confirmPhoneOtp() {
    this.verifyingPhoneOtp = true;
    this.phoneOtpError = '';
    const phone = this.form.get('phoneNumber')?.value;
    this.otpService.verifyOtp('phone', phone, this.phoneOtp.join('')).subscribe({
      next: (res: any) => {
        this.phoneVerified = true;
        this.mobileOtpVerificationToken = res?.verificationToken || '';
        this.showPhoneOtp = false;
        this.phoneVerifyError = '';
        this.verifyingPhoneOtp = false;
      },
      error: () => {
        this.phoneOtpError = 'Invalid or expired OTP.';
        this.verifyingPhoneOtp = false;
      },
    });
  }

  private buildCriticalProfileMessage(raw: any): string {
    const socials = this.selectedPlatforms().map((platform: any) => {
      const pf = this.platformForms[platform._id] || {};
      return `${platform.name}: ${pf.handle || '-'} | ${pf.tier || '-'} | ${pf.followersCount || 0} followers`;
    });
    const state = this.states.find((s: any) => s._id === raw?.location?.state)?.name || raw?.location?.state || '-';
    const district = this.districts.find((d: any) => d._id === raw?.location?.district)?.name || raw?.location?.district || '-';
    return [
      'Please verify these details before submitting:',
      '',
      `Email: ${raw?.email || '-'}`,
      `Mobile: ${raw?.phoneNumber || '-'}`,
      `Profile photo: ${this.profileImagePreview ? 'Uploaded' : 'Missing'}`,
      `Location: ${district} | ${state}`,
      `Social profile & tier: ${socials.length ? socials.join('; ') : '-'}`,
      `Payment details: ${raw?.payout?.upiId || raw?.payout?.mobile || raw?.payout?.accountHolderName ? 'Added' : 'Missing'}`,
      '',
      'Continue with registration?'
    ].join('\n');
  }

  private confirmCriticalProfileDetails(raw: any): Promise<boolean> {
    this.profileConfirmMessage = this.buildCriticalProfileMessage(raw);
    this.profileConfirmOpen = true;
    this.cdr.detectChanges();
    return new Promise((resolve) => {
      this.profileConfirmResolver = resolve;
    });
  }

  onProfileConfirmContinue(): void {
    this.profileConfirmOpen = false;
    this.profileConfirmResolver?.(true);
    this.profileConfirmResolver = null;
  }

  onProfileConfirmCancel(): void {
    this.profileConfirmOpen = false;
    this.profileConfirmResolver?.(false);
    this.profileConfirmResolver = null;
  }

  async onSubmit() {
    if (this.submitting) {
      return;
    }

    this.submitted = true;
    if (!this.hasSelectedSkills || !this.hasSelectedPricing || !this.platformsValid) {
      this.registrationError = 'Please complete the required Social Media & Skills details in Step 2.';
      this.currentStep = 2;
      this.cdr.detectChanges();
      return;
    }
    if (this.form.get('collaborationAvailability.enabled')?.value && !this.form.get('collaborationAvailability.preference')?.value) {
      this.registrationError = 'Please select a preferred collaboration type.';
      this.currentStep = 2;
      this.cdr.detectChanges();
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (!this.profileImagePreview) {
        this.registrationError = 'Profile photo is required.';
        this.currentStep = 1;
      } else {
        this.registrationError = 'Please complete all required fields.';
      }
      this.cdr.detectChanges();
      return;
    }
    if (!this.profileImagePreview) {
      this.registrationError = 'Profile photo is required.';
      this.currentStep = 1;
      this.cdr.detectChanges();
      return;
    }
    this.submitting = true;
    this.cdr.detectChanges();
    this.step2Complete = true;
    this.step3Complete = true;

    const v = this.form.value;
    if (!(await this.confirmCriticalProfileDetails(v))) {
      this.submitting = false;
      return;
    }
    const pricingArr = this.pricingOptions
      .filter(p => this.pricingState[p.key]?.enabled)
      .map(p => ({
        name: p.key,
        enabled: true,
        price: Number(this.pricingState[p.key].price) || 0,
      }));

    const normalizedStartingPrice = this.computedStartingPriceRupees;
    const startingPriceIndex = pricingArr.findIndex((entry: any) => String(entry?.name || '').trim() === 'Starting Price');
    if (startingPriceIndex > -1) {
      pricingArr[startingPriceIndex].enabled = true;
      pricingArr[startingPriceIndex].price = normalizedStartingPrice;
    } else {
      pricingArr.unshift({
        name: 'Starting Price',
        enabled: true,
        price: normalizedStartingPrice,
      });
    }

    const socialMedia = this.selectedPlatforms().map(p => {
      const pf = this.platformForms[p._id];
      const contentTypes = Object.entries(pf.contentTypes || {})
        .filter(([, ct]: any) => ct.selected)
        .map(([name, ct]: any) => ({
          name,
          enabled: true,
          price: Number(ct.price) || 0,
        }));
      return {
        platform: p.name,
        handle: normalizeSocialHandle(pf.handle, p.name),
        tier: pf.tier || '',
        followersCount: Number(pf.followersCount) || 0,
        contentTypes,
      };
    });

    const stateObj = this.states.find((s: any) => s._id === v.location?.state);
    const districtObj = this.districts.find((d: any) => d._id === v.location?.district);

    const payload = {
      name: v.name,
      username: this.slugifyUsername(v.username || v.name || ''),
      email: v.email,
      phoneNumber: v.phoneNumber,
      isMobileVerified: !!this.phoneVerified,
      mobileVerified: !!this.phoneVerified,
      mobileVerificationMethod: this.phoneVerified ? 'OTP' : '',
      mobileVerifiedAt: this.phoneVerified ? new Date() : null,
      mobileOtpVerificationToken: this.mobileOtpVerificationToken,
      dateOfBirth: v.dateOfBirth || null,
      gender: v.gender || '',
      portfolio: v.portfolio || '',
      password: v.password,
      confirmPassword: v.confirmPassword,
      location: {
        state: stateObj ? stateObj.name : v.location?.state,
        district: districtObj ? districtObj.name : v.location?.district,
      },
      paymentOption: v.paymentOption || 'free',
      profileVisibility: v.profileVisibility || 'PUBLIC',
      featuredInMarketing: !!v.featuredInMarketing,
      skills: v.skills || [],
      equipment: v.equipment || [],
      payout: v.payout || { upiId: '', mobile: '', accountHolderName: '' },
      contact: v.contact || { whatsapp: false, email: false, call: false },
      collaborationAvailability: v.collaborationAvailability,
      pricing: pricingArr,
      socialMedia,
      profileImages: this.profileImageData ? [this.profileImageData] : [],
      signupAttribution: captureSignupAttribution(
        this.route.snapshot.queryParamMap,
        typeof window !== 'undefined' ? window : undefined,
      ),
      trackingLinkCode: this.route.snapshot.queryParamMap.get('tlc') || '',
    };

    this.pendingVerificationEmail = v.email || '';
    this.registrationError = '';
    this.config.registerPhotographer(payload).subscribe({
      next: async () => {
        if (!this.localAuthBypassEnabled) {
          try {
            await this.firebaseAuth.sendVerificationEmail(v.email, v.password);
          } catch (error: any) {
            this.registrationError =
              this.firebaseAuth.getFirebaseAuthErrorMessage(error) ||
              'Verification email could not be sent.';
            this.registrationEmailSendFailed = true;
            this.submitting = false;
            this.registrationSuccess = false;
            this.cdr.detectChanges();
            return;
          }
        }
        this.submitting = false;
        this.registrationSuccess = true;
        this.registrationEmailSendFailed = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.submitting = false;
        const body = err?.error;
        if (body?.duplicateFields?.includes('email')) {
          this.duplicateEmailError = 'This email is already registered.';
          this.currentStep = 1;
        }
        if (body?.duplicateFields?.includes('phoneNumber')) {
          this.duplicatePhoneError = 'This phone number is already registered.';
          this.currentStep = 1;
        }
        if (body?.duplicateFields?.includes('username')) {
          this.duplicateUsernameError = 'This username is already taken.';
          this.currentStep = 1;
        }
        this.registrationError = body?.message || 'Registration failed. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  resendEmailVerification() {
    this.resendingEmailVerification = true;
    this.resendEmailVerificationSuccess = false;
    this.resendEmailVerificationError = null;
    const email = this.pendingVerificationEmail || this.form.get('email')?.value;
    if (!email) {
      this.resendingEmailVerification = false;
      this.resendEmailVerificationError = 'No email found for verification resend.';
      return;
    }
    this.config.sendEmailVerificationLink(email).subscribe({
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

  closeSuccessModal() {
    this.registrationSuccess = false;
    this.router.navigate(['/auth/login']);
  }

  closeEmailSendFailedModal() {
    this.registrationEmailSendFailed = false;
    this.router.navigate(['/auth/login']);
  }
}
