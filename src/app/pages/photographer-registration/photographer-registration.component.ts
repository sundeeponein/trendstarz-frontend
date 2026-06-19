import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
import { captureSignupAttribution } from '../../shared/signup-attribution.util';

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
  imports: [CommonModule, ReactiveFormsModule, FormsModule, CollaborationAvailabilityFormComponent, ChipSelectionGroupComponent, ConfirmDialogComponent],
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
  galleryUploadWarning = '';
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
  photoshootImagesPreview: string[] = [];
  photoshootImagesData: { url: string; public_id: string }[] = [];
  freeTotalImageLimit = 3;
  premiumTotalImageLimit = 10;

  duplicateEmailError = '';
  duplicatePhoneError = '';
  duplicateUsernameError = '';
  showPassword = false;
  showConfirmPassword = false;
  premiumMonthlyPrice = 399;

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

  openGalleryImageGuidelines(): void {
    this.guidelinesService.open('influencer');
  }

  private loadPlanConfig(): void {
    this.plansService.getActivePlans('PHOTOGRAPHER').subscribe((plans) => {
      const freePlan = plans.find((plan) => (plan?.price?.monthly ?? 0) === 0);
      const paidPlan = plans.find((plan) => (plan?.price?.monthly ?? 0) > 0);

      const resolveImageLimit = (plan: Plan | undefined, fallback: number): number => {
        if (!plan?.limits?.length) return fallback;
        const hit = plan.limits.find((limit) => String(limit?.key || '').trim() === 'maxPortfolioImages');
        const value = Number(hit?.value);
        return Number.isFinite(value) && value > 0 ? value : fallback;
      };

      this.freeTotalImageLimit = resolveImageLimit(freePlan, this.freeTotalImageLimit);
      this.premiumTotalImageLimit = resolveImageLimit(paidPlan, this.premiumTotalImageLimit);

      if (paidPlan) {
        const monthly = Number(paidPlan?.price?.monthly || 0);
        if (monthly > 0) this.premiumMonthlyPrice = monthly;
      }

      this.cdr.detectChanges();
    });
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
      startingPrice: ['', [Validators.required, Validators.min(0)]],
      location: this.fb.group({
        state: ['', Validators.required],
        district: ['', Validators.required],
      }),
      paymentOption: ['free', Validators.required],
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
      this.enforceGalleryLimit();
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
    return this.pricingOptions.some((p: any) => this.pricingState[p.key]?.enabled);
  }

  get hasSelectedSkills(): boolean {
    const skills = this.form.get('skills')?.value;
    return Array.isArray(skills) && skills.length > 0;
  }

  // Profile image
  async onProfileImageFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select a valid image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image size must be below 5MB.'); return; }
    this.uploadingImage = true;
    const reader = new FileReader();
    reader.onload = (e) => { this.profileImagePreview = e.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(file);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'photographer_profiles');
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

  async onPhotoshootImagesChange(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files || []);
    if (!files.length) return;

    const remainingSlots = this.maxPhotoshootImages - this.photoshootImagesData.length;
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

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'photographer_gallery');

      const uploaded = await new Promise<{ url: string; public_id: string } | null>((resolve) => {
        this.config.uploadImage(formData).subscribe({
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

      this.photoshootImagesPreview.push(preview);
      this.photoshootImagesData.push(uploaded);
      this.cdr.detectChanges();
    }

    this.galleryUploadWarning = failedUploads
      ? `${failedUploads} gallery image${failedUploads > 1 ? 's' : ''} could not be uploaded. Uploaded images are saved and you can continue.`
      : '';

    this.cdr.detectChanges();
  }

  removePhotoshootImage(index: number) {
    if (index < 0 || index >= this.photoshootImagesData.length) return;
    this.photoshootImagesPreview.splice(index, 1);
    this.photoshootImagesData.splice(index, 1);
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

  get selectedTotalImageLimit(): number {
    return this.isPremiumPlan() ? this.premiumTotalImageLimit : this.freeTotalImageLimit;
  }

  get maxPhotoshootImages(): number {
    return Math.max(0, this.selectedTotalImageLimit - 1);
  }

  private enforceGalleryLimit(): void {
    if (this.photoshootImagesData.length <= this.maxPhotoshootImages) return;
    this.photoshootImagesData = this.photoshootImagesData.slice(0, this.maxPhotoshootImages);
    this.photoshootImagesPreview = this.photoshootImagesPreview.slice(0, this.maxPhotoshootImages);
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
    if (this.form.invalid) return;
    if (!this.profileImagePreview) return;
    if (!this.platformsValid) return;
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

    const normalizedStartingPrice = Number(v.startingPrice) || 0;
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
      skills: v.skills || [],
      equipment: v.equipment || [],
      payout: v.payout || { upiId: '', mobile: '', accountHolderName: '' },
      contact: v.contact || { whatsapp: false, email: false, call: false },
      collaborationAvailability: v.collaborationAvailability,
      pricing: pricingArr,
      socialMedia,
      profileImages: [
        ...(this.profileImageData ? [this.profileImageData] : []),
        ...this.photoshootImagesData,
      ],
      signupAttribution: captureSignupAttribution(
        this.route.snapshot.queryParamMap,
        typeof window !== 'undefined' ? window : undefined,
      ),
    };

    this.registrationError = '';
    this.galleryUploadWarning = '';
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

  closeSuccessModal() {
    this.registrationSuccess = false;
    this.router.navigate(['/auth/login']);
  }

  closeEmailSendFailedModal() {
    this.registrationEmailSendFailed = false;
    this.router.navigate(['/auth/login']);
  }
}
