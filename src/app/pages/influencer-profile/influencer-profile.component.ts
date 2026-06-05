import { environment } from '../../../environments/environment';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AsyncValidatorFn, AbstractControl } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { OtpService } from '../../shared/otp.service';
import { map, first, catchError, debounceTime } from 'rxjs/operators';
import { firstValueFrom, of, forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { RouterModule } from '@angular/router';
import { TierInfoService } from '../../shared/components/tier-info-modal/tier-info.service';
import { ImageGuidelinesService } from '../../shared/components/image-guidelines-modal/image-guidelines.service';
import { ResetPasswordModalComponent } from '../../shared/components/reset-password-modal/reset-password-modal.component';
import imageCompression from 'browser-image-compression';
import { PlansService, PlanCapabilities, FREE_CAPABILITIES, Plan } from '../../shared/plans.service';
import { ToastService } from '../../shared/toast/toast.service';
import { CollaborationAvailabilityFormComponent } from '../../shared/collaboration-availability/collaboration-availability-form.component';
import { FirebaseAuthService } from '../../shared/firebase-auth.service';
import { ChipSelectionGroupComponent } from '../../shared/chip-selection-group/chip-selection-group.component';
import { buildSocialProfileUrl, normalizeSocialHandle, socialHandleExample, validateSocialHandle } from '../../shared/social-handle.util';

@Component({
  selector: 'app-influencer-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule, RouterModule, ResetPasswordModalComponent, CollaborationAvailabilityFormComponent, ChipSelectionGroupComponent],
  templateUrl: './influencer-profile.component.html',
  styleUrls: ['./influencer-profile.component.scss']
})
export class InfluencerProfileComponent implements OnInit {
  readonly maxCategories = 5;
  readonly maxCreatorTypes = 3;
  readonly maxCollaborationTypes = 3;
  readonly maxAvailableFor = 2;
  premiumMonthlyPrice = 399;
  premiumOriginalMonthlyPrice: number | null = null;
  premiumOfferChip = '';
  showProfessionalOptional = false;
  verificationDocuments: Array<{ url: string; public_id: string; originalName?: string; mimeType?: string }> = [];
  verificationUploading = false;
  verificationUploadError = '';
  verificationConsentError = '';
  verificationStatusDisplay = 'not_submitted';
  verificationAdminNotesDisplay = '';
  commissionAccessTags: string[] = [];
  firstRegisteredAt: string | null = null;
  lastLoginAt: string | null = null;

  private extractCommissionAccessTags(tags: unknown): string[] {
    const all = Array.isArray(tags) ? tags : [];
    const allowed = new Set(['early access', 'partner', 'internal/test', 'internal test']);
    return all
      .map((tag: any) => String(tag || '').trim())
      .filter((tag: string) => !!tag && allowed.has(tag.toLowerCase()));
  }

  setChipValues(field: 'languages' | 'categories' | 'creatorTypes', values: string[]): void {
    if (!this.isEditMode) return;
    this.registrationForm.get(field)?.setValue(values);
    this.registrationForm.get(field)?.markAsTouched();
  }

  openProfilePhotoGuidelines(): void {
    this.guidelinesService.open('influencer');
  }

  // --- New Social Media Platform UI ---
  constructor(
    public fb: FormBuilder,
    private configService: ConfigService,
    private otpService: OtpService,
    private plansService: PlansService,
    private cd: ChangeDetectorRef,
    private guidelinesService: ImageGuidelinesService,
    private toast: ToastService,
    private firebaseAuth: FirebaseAuthService,
  ) {}

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
  }
  platformForms: { [platformId: string]: any } = {};
  originalPlatformForms: { [platformId: string]: any } = {};
  /** Currently visible platform tab in the social media section. */
  activePlatformTab: string | null = null;

  isPlatformSelected(platform: any): boolean {
    return !!this.platformForms[platform._id];
  }

  togglePlatform(platform: any) {
    if (!this.isEditMode) return;
    if (this.isPlatformSelected(platform)) {
      this.removePlatformCard(platform);
      if (this.activePlatformTab === platform._id) {
        const remaining = this.selectedPlatforms();
        this.activePlatformTab = remaining.length ? remaining[0]._id : null;
      }
    } else {
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
    if (!this.isEditMode) return;
    delete this.platformForms[platform._id];
    if (this.activePlatformTab === platform._id) {
      const remaining = this.selectedPlatforms();
      this.activePlatformTab = remaining.length ? remaining[0]._id : null;
    }
    this.refreshStepCompletion();
  }

  getPlatformById(id: string | null): any {
    if (!id) return null;
    return (this.socialMediaList || []).find((p: any) => p._id === id) || null;
  }

  selectedPlatforms(): any[] {
    return (this.socialMediaList || []).filter(p => this.platformForms[p._id]);
  }

  /** Selected platforms missing handle or tier. */
  invalidPlatforms(): any[] {
    return this.selectedPlatforms().filter(p => {
      const pf = this.platformForms[p._id];
      return !pf || !!this.getSocialHandleError(p) || !(pf.tier || '').trim() || !this.hasSelectedPricedContentType(pf);
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
      if (ct.selected && ct.price) total += Number(ct.price) || 0;
    }
    return total;
  }

  getGrandTotal(): number {
    return this.selectedPlatforms().reduce((sum, p) => sum + this.getPlatformTotal(p), 0);
  }

  getProfileUrl(platformName: string, handle: string): string {
    return buildSocialProfileUrl(platformName, handle);
  }

  normalizePlatformHandle(platformId: string): void {
    const pf = this.platformForms[platformId];
    if (!pf) return;
    pf.handle = normalizeSocialHandle(pf.handle, this.getPlatformById(platformId)?.name || '');
    this.refreshStepCompletion();
  }

  getSocialHandleExample(platformName: string): string {
    return socialHandleExample(platformName);
  }

  getSocialHandleError(platform: any): string {
    const pf = this.platformForms[platform?._id];
    if (!pf) return 'Username is required.';
    return validateSocialHandle(pf.handle, platform?.name || '') || '';
  }

  getTierOptionLabel(tier: any): string {
    const name = String(tier?.name || '').trim();
    const range = String(tier?.desc || '').trim();
    if (!range) return name;
    return `${name} (${range})`;
  }


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
  verificationCallNumber = '';

  emailVerified: boolean = false;
  emailEditRequested: boolean = false;
  showEmailVerificationPrompt: boolean = false;
  phoneVerifyError: string = '';
  emailVerifyError: string = '';

  phoneOtpTimer: number = 300;
  canResendPhoneOtp: boolean = false;
  verifyingPhoneOtp: boolean = false;
  phoneOtpError: string = '';
  private phoneOtpInterval: any;
  private firebasePhoneConfirmation: any = null;


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
  // (Removed duplicate constructor)

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
    void this.sendFirebasePhoneOtp();
  }

  private formatFirebasePhone(phone: string): string {
    const value = String(phone || '').trim();
    if (value.startsWith('+')) return value;
    const digits = value.replace(/\D/g, '');
    return digits.length === 10 ? `+91${digits}` : `+${digits}`;
  }

  private async sendFirebasePhoneOtp(): Promise<void> {
    try {
      const phone = this.formatFirebasePhone(this.registrationForm.get('phoneNumber')?.value);
      this.firebasePhoneConfirmation = await this.firebaseAuth.sendPhoneOtp(phone, 'influencer-phone-recaptcha');
      this.phoneVerifyError = '';
      this.phoneOtpError = '';
      this.showPhoneOtp = true;
      this.startPhoneOtpTimer();
    } catch (error: any) {
      this.phoneVerifyError = error?.message || 'Failed to send OTP';
    }
  }

  confirmPhoneOtp() {
    void this.confirmFirebasePhoneOtp();
  }

  private async confirmFirebasePhoneOtp(): Promise<void> {
    if (!this.firebasePhoneConfirmation) {
      this.phoneOtpError = 'Please request an OTP first.';
      return;
    }
    this.verifyingPhoneOtp = true;
    this.phoneOtpError = '';
    try {
      await this.firebaseAuth.confirmPhoneOtp(this.firebasePhoneConfirmation, this.phoneOtp.join(''));
      this.phoneVerified = true;
      this.showPhoneOtp = false;
      this.phoneVerifyError = '';
    } catch (error: any) {
      this.phoneOtpError = error?.message || 'Invalid or expired OTP.';
    } finally {
      this.verifyingPhoneOtp = false;
    }
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
  premiumStart: Date | null = null;
  premiumEnd: Date | null = null;
  readonly currentDate = new Date();
  showPayment = false;
  selectedDuration: '1m' | '3m' | '1y' | '' = '';
  paymentSuccess = false;
  paymentError = '';
  myPayments: any[] = [];
  latestPendingPayment: any = null;

  // Plan capabilities
  planCaps: PlanCapabilities = FREE_CAPABILITIES;
  get maxImages(): number { return this.plansService.getLimitValue(this.planCaps, 'maxProductImages'); }
  get maxGalleryImages(): number { return Math.max(0, this.maxImages - 1); }
  get currentImageCount(): number { return 1 + this.galleryImagesData.length; }
  get imageUploadAllowed(): boolean { return this.currentImageCount < this.maxImages; }
  get hasPremiumPlan(): boolean { return !!this.planCaps?.hasPremium; }
  registrationSuccess = false;
  registrationError = '';
  registrationSuccessMessage = '';
  registrationForm!: FormGroup;
  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];
  collaborationAvailabilityOptions: any = {};
  creatorTypeOptions: any[] = [];
  tiers: any[] = [];
  protected tierInfo = inject(TierInfoService);
  profileImagePreview: string | null = null;
  profileImageFile: File | null = null;
  galleryImagesPreview: string[] = [];
  galleryImagesData: { url: string; public_id: string }[] = [];
  galleryUploadWarning = '';
  readonly MAX_IMAGE_SIZE_MB = 5; // allow up to 5 MB before rejecting
  languagesList: any[] = [];
  categoriesList: any[] = [];
  isEditMode = false;
  originalFormValue: any = null;
  submitted = false;
  usernameError: string = '';
  showChangePasswordModal = false;

  openChangePasswordModal() {
    this.showChangePasswordModal = true;
  }

  // Utility to slugify username
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

  ngOnInit() {
    this.loadPremiumMonthlyPrice();
    this.configService.getSupportContact().subscribe(s => {
      this.verificationCallNumber = s.verificationCallNumber || '';
      this.cd.markForCheck();
    });

    // Load plan capabilities
    this.plansService.getMyCapabilities().subscribe(caps => {
      this.planCaps = caps;
    });
    // Initialize form first
    this.registrationForm = this.fb.group({
      name: [{ value: '', disabled: true }, Validators.required],
      username: [
        { value: '', disabled: true },
        [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]+$/)],
        [this.usernameUniqueValidator()]
      ],
      phoneNumber: [{ value: '', disabled: true }, Validators.required],
      email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      dateOfBirth: [{ value: '', disabled: true }, Validators.required],
      gender: [{ value: '', disabled: true }],
      influencerCategory: [{ value: '', disabled: true }],
      professionalStatus: [{ value: false, disabled: true }],
      expertiseArea: [{ value: '', disabled: true }],
      verificationDocuments: [{ value: [], disabled: true }],
      verificationDisclaimerAccepted: [{ value: false, disabled: true }],
      paymentOption: [{ value: 'free', disabled: true }, Validators.required],
      location: this.fb.group({
        state: [{ value: '', disabled: true }, Validators.required],
        district: [{ value: '', disabled: true }, Validators.required]
      }),
      promotionalPrice: [{ value: '', disabled: true }, Validators.required],
      languages: [{ value: [], disabled: true }, Validators.required],
      categories: [{ value: [], disabled: true }, Validators.required],
      creatorTypes: [{ value: [], disabled: true }],
      profileImages: this.fb.array([]),
      contact: this.fb.group({
        whatsapp: [{ value: false, disabled: true }],
        email: [{ value: false, disabled: true }],
        call: [{ value: false, disabled: true }]
      }),
      collaborationAvailability: this.fb.group({
        enabled: [{ value: false, disabled: true }],
        collaborationTypes: [{ value: [], disabled: true }],
        preference: [{ value: '', disabled: true }],
        availableFor: [{ value: [], disabled: true }],
        openToTravel: [{ value: false, disabled: true }],
      }),
      website: [{ value: '', disabled: true }],
      payout: this.fb.group({
        upiId: [{ value: '', disabled: true }],
        mobile: [{ value: '', disabled: true }],
        accountHolderName: [{ value: '', disabled: true }],
      }),
    });
    // Auto-replace spaces with hyphens in username input
    this.registrationForm.get('username')?.valueChanges.subscribe(value => {
      if (typeof value === 'string' && value.includes(' ')) {
        const sanitized = value.replace(/\s+/g, '-');
        this.registrationForm.get('username')?.setValue(sanitized, { emitEvent: false });
      }
      // Clear username error on change
      this.usernameError = '';
    });

    this.registrationForm.valueChanges.subscribe(() => this.refreshStepCompletion());
    this.registrationForm.statusChanges.subscribe(() => this.refreshStepCompletion());

    // Clear professional fields when professionalStatus is unchecked
    // Dynamic validator for influencerCategory based on professionalStatus
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

    // Load districts when state changes (robust: accept id or name, request by name+id)
    this.registrationForm.get('location.state')?.valueChanges.subscribe(stateIdOrName => {
      this.registrationForm.get('location.district')?.setValue('');
      this.districts = [];
      if (stateIdOrName) {
        const selectedState = this.states.find((s: any) => s._id === stateIdOrName || s.id === stateIdOrName || s.name === stateIdOrName);
        const stateName = selectedState?.name || (typeof stateIdOrName === 'string' ? stateIdOrName : '');
        const selectedStateId = selectedState?._id || selectedState?.id || (typeof stateIdOrName === 'string' ? stateIdOrName : '');
        this.configService.getDistricts(stateName, selectedStateId).subscribe({
          next: data => { this.districts = Array.isArray(data) ? data : []; this.cd.detectChanges(); },
          error: () => { this.districts = []; this.cd.detectChanges(); }
        });
      }
    });

    // Fetch dropdown data first, then profile
    forkJoin({
      states: this.configService.getStates(),
      tiers: this.configService.getTiers(),
      socialMedia: this.configService.getSocialMedia(),
      languages: this.configService.getLanguages(),
      categories: this.configService.getCategories('influencer'),
      collaborationAvailabilityOptions: this.configService.getCollaborationAvailabilityOptions(),
      creatorTypeOptions: this.configService.getCreatorTypeOptions(),
    }).subscribe({
      next: (dropdownData) => {
        this.states = dropdownData.states || [];
        const tierRows = Array.isArray(dropdownData.tiers) ? dropdownData.tiers : [];
        this.tiers = tierRows;
        this.socialMediaList = dropdownData.socialMedia || [];
        this.languagesList = dropdownData.languages || [];
        this.categoriesList = dropdownData.categories || [];
        this.collaborationAvailabilityOptions = dropdownData.collaborationAvailabilityOptions || {};
        this.creatorTypeOptions = dropdownData.creatorTypeOptions || [];

        // Now fetch influencer profile after dropdown data is loaded
        const token = this.getToken();
        if (token) {
          this.configService.getInfluencerProfileById().subscribe({
        next: (profile) => {
          if (!profile) {
            this.registrationError = 'Profile not found or you are not logged in.';
            return;
          }
          this.emailVerified = !!profile.isEmailVerified;
          this.phoneVerified = !!profile.isMobileVerified;
          this.commissionAccessTags = this.extractCommissionAccessTags(profile.adminTags);
          this.firstRegisteredAt = profile.firstRegisteredAt || profile.createdAt || null;
          this.lastLoginAt = profile.lastLoginAt || null;
          this.showEmailVerificationPrompt = !this.emailVerified;
          this.cd.detectChanges();
          // Map state name to ID
          const stateId = this.states.find(s => s.name === profile.location?.state)?.['_id'] || '';
          // Map language names to IDs
          const languageIds = (profile.languages || []).map((name: string) =>
            this.languagesList.find(l => l.name === name)?._id
          ).filter(Boolean);
          // Map category names to IDs
          const categoryIds = (profile.categories || []).map((name: string) =>
            this.categoriesList.find(c => c.name === name)?._id
          ).filter(Boolean);
          const creatorTypeIds = (profile.creatorTypes || []).map((name: string) =>
            this.creatorTypeOptions.find((item: any) => item.name === name)?._id || name
          ).filter(Boolean);
          // Load districts for the state, then patch form
            const patchForm = (districtId: string) => {
            this.registrationForm.patchValue({
              name: profile.name || '',
              username: profile.username || '',
              phoneNumber: profile.phoneNumber || '',
              email: profile.email || '',
              dateOfBirth: this.normalizeDateForInput(profile.dateOfBirth),
              gender: profile.gender || '',
              influencerCategory:
                this.categoriesList.find((c: any) => c.name === profile.influencerCategory)?._id ||
                '',
              professionalStatus: !!profile.professionalStatus,
              expertiseArea: profile.expertiseArea || '',
              verificationDocuments: profile.verificationDocuments || [],
              verificationDisclaimerAccepted: !!profile.verificationDisclaimerAccepted,
              paymentOption: profile.isPremium ? 'premium' : 'free',
              location: { state: stateId, district: districtId },
              promotionalPrice: profile.promotionalPrice || '',
              languages: languageIds,
            categories: categoryIds,
            creatorTypes: creatorTypeIds,
            contact: profile.contact || { whatsapp: false, email: false, call: false },
            collaborationAvailability: profile.collaborationAvailability || {
              enabled: false,
              collaborationTypes: [],
              preference: '',
              availableFor: [],
              openToTravel: false,
            },
            website: profile.website || '',
            payout: {
              upiId: profile.payout?.upiId || '',
              mobile: profile.payout?.mobile || profile.phoneNumber || '',
              accountHolderName: profile.payout?.accountHolderName || profile.name || '',
            }
          }, { emitEvent: false });
          // Patch profileImages
          const arr = this.registrationForm.get('profileImages') as FormArray;
          arr.clear();
          (profile.profileImages || []).forEach((img: any) => arr.push(this.fb.group({
            url: this.normalizeImageUrl(img.url),
            public_id: img.public_id
          })));
          this.verificationDocuments = Array.isArray(profile.verificationDocuments)
            ? profile.verificationDocuments
            : [];
          this.verificationStatusDisplay = profile.verificationStatus || 'not_submitted';
          this.verificationAdminNotesDisplay = profile.verificationAdminNotes || '';
          // Show first image as preview on load (normalize backend-local asset paths)
          this.profileImagePreview = (profile.profileImages && profile.profileImages[0]?.url) ? this.normalizeImageUrl(profile.profileImages[0].url) : null;
          // Do not set profileImageFile to the remote image object — only File objects should be used for upload
          this.profileImageFile = null;
          // Populate gallery images from index 1 onward
          const gallerySource = (profile.profileImages || []).slice(1).filter((img: any) => !!img?.url);
          this.galleryImagesData = gallerySource.map((img: any) => ({ url: img.url, public_id: img.public_id }));
          this.galleryImagesPreview = gallerySource.map((img: any) => this.normalizeImageUrl(img.url) || img.url);
          // Patch socialMedia into platformForms
          this.platformForms = {};
          (profile.socialMedia || []).forEach((sm: any) => {
            const platformObj = this.socialMediaList.find(s => s.name === sm.platform);
            if (platformObj) {
              this.platformForms[platformObj._id] = {
                handle: sm.handle || '',
                followersCount: sm.followersCount || '',
                tier: sm.tier || '',
                contentTypes: Object.fromEntries(
                  (platformObj.contentTypes || []).map((ct: any) => {
                    const saved = (sm.contentTypes || []).find((c: any) => c.name === ct.name);
                    return [ct.name, { selected: saved?.enabled || false, price: saved?.price || '' }];
                  })
                )
              };
            }
          });
          const _pfKeys = Object.keys(this.platformForms);
          this.activePlatformTab = _pfKeys.length ? _pfKeys[0] : null;
          this.originalPlatformForms = JSON.parse(JSON.stringify(this.platformForms));
          this.originalFormValue = this.registrationForm.getRawValue();
          // Trigger change detection so profile image, fields and platform cards render
          // under Angular zoneless change detection (no microtask/zone tick fires this).
          this.cd.detectChanges();
          };
          // Load districts for the saved state, then patch form
          if (profile.location?.state) {
            this.configService.getDistricts(profile.location.state, stateId).subscribe({
              next: (dists) => {
                this.districts = Array.isArray(dists) ? dists : [];
                const savedDistrict = (profile.location?.district || '').toString().trim();
                const lower = savedDistrict.toLowerCase();
                const resolved = savedDistrict
                  ? (this.districts.find((d: any) => d._id === savedDistrict) ||
                     this.districts.find((d: any) => (d.name || '').toString().trim().toLowerCase() === lower))
                  : null;
                const districtId = resolved ? resolved._id : '';
                patchForm(districtId);
              },
              error: () => patchForm('')
            });
          } else {
            patchForm('');
          }
          // Set premium period if available
          this.premiumStart = profile.premiumStart ? new Date(profile.premiumStart) : null;
          this.premiumEnd = profile.premiumEnd ? new Date(profile.premiumEnd) : null;
          // Load payment status
          this.configService.getMyPayments(5).subscribe(payments => {
            this.myPayments = payments;
            this.latestPendingPayment = payments.find((p: any) => p.status === 'pending') || null;
          });
          this.refreshStepCompletion();
        },
        error: (err) => {
          this.registrationError = 'Error fetching profile.';
        }
          });
        }
      },
      error: (err) => {
        this.registrationError = 'Error fetching dropdown data.';
        console.error('[Dropdown data error]', err);
      }
    });

    this.refreshStepCompletion();
  }

  private loadPremiumMonthlyPrice(): void {
    this.plansService.getActivePlans('INFLUENCER').subscribe((plans) => {
      const paidPlan = plans.find((plan) => (plan?.price?.monthly ?? 0) > 0);
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

  private hasExistingProfileImage(): boolean {
    const arr = this.profileImagesFormArray;
    return !!(
      this.profileImagePreview ||
      (arr && arr.controls.length > 0 &&
        arr.at(0)?.value &&
        arr.at(0)?.value.url)
    );
  }

  private computeStepComplete(step: number): boolean {
    if (step === 1) {
      return !!(
        this.registrationForm.get('name')?.valid &&
        this.registrationForm.get('username')?.valid &&
        this.registrationForm.get('phoneNumber')?.valid &&
        this.registrationForm.get('email')?.valid &&
        this.registrationForm.get('dateOfBirth')?.valid &&
        this.hasExistingProfileImage()
      );
    }

    if (step === 2) {
      return !!(
        this.registrationForm.get('location.state')?.valid &&
        this.registrationForm.get('location.district')?.valid &&
        this.registrationForm.get('languages')?.valid &&
        this.registrationForm.get('categories')?.valid &&
        (!this.registrationForm.get('professionalStatus')?.value || this.registrationForm.get('influencerCategory')?.valid) &&
        this.selectedPlatforms().length > 0
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

  refreshStepCompletion() {
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

  goToStep(step: 1 | 2 | 3) {
    this.currentStep = step;
    this.submitted = false;
    this.registrationError = '';
    if (step === 2) {
      this.step2Attempted = false;
    }
    this.refreshStepCompletion();
    this.scrollToTop();
  }

  private scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private validateCurrentStep(): boolean {
    this.submitted = true;

    if (this.currentStep === 1) {
      const fields = ['name', 'username', 'phoneNumber', 'email', 'dateOfBirth'];
      fields.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      const fieldsValid = fields.every((path) => this.registrationForm.get(path)?.valid);
      return fieldsValid && this.hasExistingProfileImage();
    }

    if (this.currentStep === 2) {
      this.step2Attempted = true;
      const required = ['location.state', 'location.district', 'languages', 'categories'];
      required.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      const isProfessional = !!this.registrationForm.get('professionalStatus')?.value;
      if (isProfessional) {
        this.registrationForm.get('influencerCategory')?.markAsTouched();
      }
      if (this.verificationDocuments.length > 0 && !this.registrationForm.get('verificationDisclaimerAccepted')?.value) {
        this.verificationConsentError = 'Please confirm the declaration for submitted verification documents.';
        return false;
      }
      this.verificationConsentError = '';
      const requiredValid = required.every((path) => this.registrationForm.get(path)?.valid);
      const influencerCatValid = !isProfessional || !!this.registrationForm.get('influencerCategory')?.valid;
      if (!requiredValid || !influencerCatValid) return false;
      if (this.selectedPlatforms().length === 0) {
        this.registrationError = 'Please select at least one social media platform.';
        return false;
      }
      if (!this.arePlatformsValid()) {
        this.registrationError = '';
        return false;
      }
      this.registrationError = '';
      return true;
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
      this.scrollToTop();
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
      this.scrollToTop();
    }
  }

  payAndUpgrade() {
    this.paymentError = '';
    this.paymentSuccess = false;
    if (!this.selectedDuration) {
      this.paymentError = 'Please select a premium duration.';
      // Close the modal after showing the error
      setTimeout(() => {
        this.showPayment = false;
        this.paymentError = '';
      }, 1200);
      return;
    }
    // Simulate payment (replace with real payment integration as needed)
    // On success, call backend to set premium
    const token = this.getToken();
    if (!token) {
      this.paymentError = 'Not logged in.';
      return;
    }
    // Call backend PATCH to set premium
    this.configService.setPremiumForCurrentUser(true, this.selectedDuration).subscribe({
      next: (res: any) => {
        this.paymentSuccess = true;
        this.showPayment = false;
        // Refresh profile to show premium status
        this.ngOnInit();
      },
      error: (err) => {
        this.paymentError = 'Payment failed or could not upgrade. Please try again.';
      }
    });
  }

  async enableEdit(): Promise<void> {
    // Always fetch and patch the latest profile before edit
    await this.fetchAndPatchProfile();
  this.isEditMode = true;
  this.registrationForm.enable({ emitEvent: false });
  this.emailEditRequested = !this.emailVerified;
  // Enable username for editing
  this.registrationForm.get('username')?.enable({ emitEvent: false });
  // Keep password fields disabled for security
  this.registrationForm.get('password')?.disable();
  this.registrationForm.get('confirmPassword')?.disable();
  this.refreshStepCompletion();
  this.cd.detectChanges();
  }

  cancelEdit(): void {
    this.isEditMode = false;
    this.emailEditRequested = false;
    if (this.originalFormValue) {
      this.registrationForm.reset(this.originalFormValue, { emitEvent: false });
    }
    this.platformForms = JSON.parse(JSON.stringify(this.originalPlatformForms));
    this.registrationForm.disable({ emitEvent: false });
    this.registrationForm.get('password')?.disable();
    this.registrationForm.get('confirmPassword')?.disable();
    this.registrationForm.get('username')?.disable();
    this.refreshStepCompletion();
    // Restore districts for the original state so view mode shows the district name
    const origState = this.originalFormValue?.location?.state;
    if (origState) {
      const selectedState = this.states.find((s: any) => s._id === origState || s.id === origState || s.name === origState);
      const stateName = selectedState?.name || (typeof origState === 'string' ? origState : '');
      const stateId = selectedState?._id || selectedState?.id || (typeof origState === 'string' ? origState : '');
      this.configService.getDistricts(stateName, stateId).subscribe({
        next: d => { this.districts = Array.isArray(d) ? d : []; this.cd.detectChanges(); },
        error: () => { this.districts = []; this.cd.detectChanges(); }
      });
    }
  }

  // Async validator to check username uniqueness (for edit profile)
  usernameUniqueValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return Promise.resolve(null);
      // Skip validation if username hasn't changed from the loaded profile
      if (this.originalFormValue && control.value === this.originalFormValue.username) {
        return Promise.resolve(null);
      }
      return this.configService.checkUsernameExists(control.value).pipe(
        map((exists: boolean) => (exists ? { usernameTaken: true } : null)),
        catchError(() => of(null)),
        first()
      );
    };
  }

  get profileImagesFormArray() {
    return this.registrationForm?.get('profileImages') as FormArray;
  }


      // Helper to map district ID to name safely for template
      getDistrictName(districtId: string): string {
        if (!this.districts) return districtId;
        const found = this.districts.find((d: any) => d._id === districtId);
        return found ? found.name : districtId;
      }

  // Normalize image URLs coming from backend. If the URL is a backend-local path
  // (e.g. `/assets/local-images/...`) prefix it with the backend origin derived
  // from `environment.apiBaseUrl` so the browser can fetch it during dev.
  private normalizeImageUrl(url?: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('/assets/') || url.startsWith('/assets')) {
      const api = environment.apiBaseUrl || '';
      const backend = api.replace(/\/api\/?$/, '') || api.replace(/\/api$/, '');
      // If api doesn't include origin (rare), just return the original url
      if (!backend) return url;
      return backend + url;
    }
    return url;
  }

  private isValidImageFile(file: any, maxMB = 5): { valid: boolean; reason?: string } {
    if (!file) return { valid: false, reason: 'No file selected.' };
    if (!(file instanceof File)) return { valid: false, reason: 'Selected value is not a file.' };
    if (!file.type || !file.type.startsWith('image/')) return { valid: false, reason: 'Please select an image file.' };
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxMB) return { valid: false, reason: `Image exceeds ${maxMB} MB limit.` };
    return { valid: true };
  }

  // Some browsers/libraries return Blob after compression; normalize it to File for FormData upload.
  private normalizeUploadFile(candidate: File | Blob | null | undefined, fallbackName = 'profile-image.jpg'): File | null {
    if (!candidate) return null;
    if (candidate instanceof File) return candidate;
    if (candidate instanceof Blob) {
      const type = candidate.type || 'image/jpeg';
      return new File([candidate], fallbackName, { type });
    }
    return null;
  }


  // Only allow 1 image for now (can extend for premium)
  async onProfileImageFileChange(event: any) {
    if (!this.isEditMode) return;
    this.profileImagePreview = null;
    this.profileImageFile = null;
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    const validation = this.isValidImageFile(file, this.MAX_IMAGE_SIZE_MB);
    if (!validation.valid) {
      this.toast.error(validation.reason || 'Please select a valid image file.');
      return;
    }
    // Compress and resize before upload
    try {
      const options = {
        maxSizeMB: 0.2, // 200 KB
        maxWidthOrHeight: 1024,
        useWebWorker: true
      };
      const compressedFile = await imageCompression(file, options);
      const uploadFile = this.normalizeUploadFile(compressedFile as File | Blob, file.name || 'profile-image.jpg');
      if (!uploadFile) {
        this.toast.error('Please select a valid image file.');
        return;
      }
      this.profileImageFile = uploadFile;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profileImagePreview = e.target.result;
        this.refreshStepCompletion();
      };
      reader.readAsDataURL(uploadFile);
    } catch (err) {
      this.toast.error('Image compression failed.');
      return;
    }
  }

  removeProfileImage(index: number) {
    if (!this.isEditMode) return;
    this.profileImagesFormArray?.removeAt(index);
    this.refreshStepCompletion();
  }

  async onGalleryImagesChange(event: Event) {
    if (!this.isEditMode) return;
    const files = Array.from((event.target as HTMLInputElement).files || []);
    if (!files.length) return;
    const remainingSlots = this.maxGalleryImages - this.galleryImagesData.length;
    const selectedFiles = files.slice(0, Math.max(0, remainingSlots));
    if (!selectedFiles.length) return;
    let failedUploads = 0;
    for (const file of selectedFiles) {
      if (!file.type.startsWith('image/')) { failedUploads++; continue; }
      if (file.size > 5 * 1024 * 1024) { failedUploads++; continue; }
      const preview = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result || ''));
        reader.onerror = () => reject(new Error('preview_failed'));
        reader.readAsDataURL(file);
      }).catch(() => '');
      if (!preview) { failedUploads++; continue; }
      const fd = new FormData();
      fd.append('file', file, file.name || 'gallery.jpg');
      fd.append('folder', 'influencer_gallery_images');
      try {
        const resp = await fetch(`${environment.apiBaseUrl}/auth/upload-image`, { method: 'POST', body: fd });
        if (!resp.ok) { failedUploads++; continue; }
        const data = await resp.json();
        if (data?.url && data?.public_id) {
          this.galleryImagesPreview.push(preview);
          this.galleryImagesData.push({ url: data.url, public_id: data.public_id });
          this.cd.detectChanges();
        } else { failedUploads++; }
      } catch { failedUploads++; }
    }
    this.galleryUploadWarning = failedUploads
      ? `${failedUploads} gallery image${failedUploads > 1 ? 's' : ''} could not be uploaded. Uploaded images are saved and you can continue.`
      : '';
    this.cd.detectChanges();
  }

  removeGalleryImage(index: number) {
    if (!this.isEditMode) return;
    this.galleryImagesPreview.splice(index, 1);
    this.galleryImagesData.splice(index, 1);
    this.galleryUploadWarning = '';
    this.cd.detectChanges();
  }



  async onSubmit() {
    this.submitted = true;
    this.cd.detectChanges();

    if (!this.isEditMode || this.registrationForm.invalid || (!this.profileImagePreview && (!this.profileImagesFormArray.controls.length || !this.profileImagesFormArray.at(0).value || !this.profileImagesFormArray.at(0).value.url))) {
      if (!this.profileImagePreview && (!this.profileImagesFormArray.controls.length || !this.profileImagesFormArray.at(0).value || !this.profileImagesFormArray.at(0).value.url)) {
        this.registrationError = 'Profile image is required.';
      } else if (this.registrationForm.invalid) {
        this.registrationError = 'Please complete all required fields before saving.';
        if (!this.computeStepComplete(1)) this.currentStep = 1;
        else if (!this.computeStepComplete(2)) this.currentStep = 2;
      }
      this.cd.detectChanges();
      return;
    }
    if (!this.arePlatformsValid()) {
      // Inline error is rendered in template; clear registrationError to avoid duplicate.
      this.registrationError = '';
      this.registrationSuccess = false;
      this.registrationSuccessMessage = '';
      return;
    }
    this.registrationError = '';
    this.registrationSuccess = false;
    this.registrationSuccessMessage = '';
    const raw = this.registrationForm.getRawValue();
    const previousEmail = String(this.originalFormValue?.email || '').trim().toLowerCase();
    const currentEmail = String(raw?.email || '').trim().toLowerCase();
    const emailChanged = !!currentEmail && previousEmail !== currentEmail;
    if (this.verificationDocuments.length > 0 && !raw.verificationDisclaimerAccepted) {
      this.verificationConsentError = 'Please confirm the declaration for submitted verification documents.';
      return;
    }
    this.verificationConsentError = '';
    // Always slugify username before saving
    if (raw.username) {
      raw.username = this.slugifyUsername(raw.username);
    }
    // Map state ID to name
    const stateObj = this.states.find(s => s._id === raw.location.state);
    let districtObj = this.districts.find(d => d._id === raw.location.district);
    // If district not resolved locally, fetch districts for the state and try to resolve by id
    if (!districtObj && raw.location?.district) {
      try {
        const selectedState = this.states.find((s: any) => s._id === raw.location.state || s.id === raw.location.state || s.name === raw.location.state);
        const stateNameForLookup = selectedState?.name || (typeof raw.location.state === 'string' ? raw.location.state : '');
        const stateIdForLookup = selectedState?._id || selectedState?.id || (typeof raw.location.state === 'string' ? raw.location.state : '');
        const dists = await firstValueFrom(this.configService.getDistricts(stateNameForLookup, stateIdForLookup).pipe(catchError(() => of([]))));
        this.districts = Array.isArray(dists) ? dists : [];
        districtObj = this.districts.find((d: any) => d._id === raw.location.district) || undefined;
      } catch (err) {
        // ignore and proceed
      }
    }
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
    const creatorTypeNames = (raw.creatorTypes || []).map((id: string) => {
      const item = this.creatorTypeOptions.find((x: any) => x._id === id || x.name === id);
      return item ? item.name : id;
    }).filter((name: string) => !!String(name || '').trim());
    const influencerCategoryName = raw.influencerCategory
      ? (this.categoriesList.find((c: any) => c._id === raw.influencerCategory)?.name || raw.influencerCategory)
      : '';
    // Build social media from platformForms
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
    // Handle Cloudinary upload for profile image if file selected
    let profileImages: { url: string, public_id: string }[] = [];
    if (this.profileImageFile) {
      const uploadFile = this.normalizeUploadFile(this.profileImageFile, this.profileImageFile.name || 'profile-image.jpg');
      if (!uploadFile || !uploadFile.type || !uploadFile.type.startsWith('image/')) {
        this.registrationError = 'Invalid profile image file.';
        return;
      }
      try {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('folder', 'influencer_profile_images');
        const response = await fetch(`${environment.apiBaseUrl}/auth/upload-image`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          this.registrationError = 'Profile image upload failed.';
          return;
        }
        const data = await response.json();
        if (data.url && data.public_id) {
          // New profile image at index 0, keep gallery images
          profileImages = [{ url: data.url, public_id: data.public_id }, ...this.galleryImagesData];
        } else {
          this.registrationError = 'Profile image upload failed.';
          return;
        }
      } catch (err) {
        this.registrationError = 'Profile image upload failed.';
        return;
      }
    } else if (raw.profileImages && Array.isArray(raw.profileImages) && raw.profileImages.length > 0) {
      // Keep existing profile image (index 0), combine with current gallery
      const existingProfile = raw.profileImages.slice(0, 1).filter((img: any) => img && typeof img === 'object' && 'url' in img && 'public_id' in img);
      profileImages = [...existingProfile, ...this.galleryImagesData];
    }
    const payload: any = {
      ...raw,
      username: raw.username, // ensure slugified username is sent
      location: {
        state: stateObj ? stateObj.name : raw.location.state,
        district: districtObj ? districtObj.name : raw.location.district
      },
      promotionalPrice: raw.promotionalPrice,
      languages: languageNames,
      categories: categoryNames,
      creatorTypes: creatorTypeNames,
      influencerCategory: influencerCategoryName,
      professionalStatus: !!raw.professionalStatus,
      expertiseArea: raw.expertiseArea || '',
      verificationDocuments: this.verificationDocuments,
      verificationDisclaimerAccepted: !!raw.verificationDisclaimerAccepted,
      collaborationAvailability: raw.collaborationAvailability,
      socialMedia,
      profileImages,
      contact: raw.contact,
      payout: {
        upiId: String(raw?.payout?.upiId || '').trim(),
        mobile: String(raw?.payout?.mobile || '').trim(),
        accountHolderName: String(raw?.payout?.accountHolderName || '').trim(),
      },
    };
    // Never allow profile save to set isPremium or paymentOption — those are payment-gated
    delete payload.paymentOption;
    delete payload.isPremium;
    delete payload.premiumEnd;
    delete payload.premiumStart;
    delete payload.premiumDuration;
    this.configService.updateInfluencerProfile(payload).subscribe({
      next: (res: any) => {
        this.registrationSuccess = true;
        const payoutSummary = payload.payout?.upiId
          ? ` Payout saved: ${payload.payout.upiId}`
          : payload.payout?.mobile
            ? ` Payout mobile saved: ${payload.payout.mobile}`
            : '';
        this.registrationSuccessMessage = `Profile updated successfully.${payoutSummary}`;
        this.isEditMode = false;
        this.registrationForm.disable({ emitEvent: false });
        this.profileImagePreview = null;
        this.profileImageFile = null;

        // Prefer server-returned user object to update saved images
        const serverUser = res && (res.user || res.user === null) ? res.user : (res && res.user) || res?.user || res;
        const savedImages = (serverUser && Array.isArray(serverUser.profileImages)) ? serverUser.profileImages : [];

        const arr = this.profileImagesFormArray;
        if (arr) arr.clear();

        if (savedImages.length) {
          savedImages.forEach((img: any) => {
            arr.push(this.fb.group({ url: this.normalizeImageUrl(img.url), public_id: img.public_id }));
          });
          this.profileImagePreview = this.normalizeImageUrl(savedImages[0]?.url) || null;
          this.profileImageFile = null;
        } else {
          // If server didn't return images, fetch the latest profile to ensure frontend matches backend
          this.fetchAndPatchProfile().catch(() => {});
        }

        this.registrationForm.get('password')?.disable();
        this.registrationForm.get('confirmPassword')?.disable();
        this.originalFormValue = this.registrationForm.getRawValue();
        if (emailChanged) {
          this.emailVerified = false;
          this.showEmailVerificationPrompt = true;
          this.emailEditRequested = true;
          this.resendEmailVerification();
        } else {
          this.emailEditRequested = false;
        }
        this.fetchAndPatchProfile().catch(() => {});
      },
      error: err => {
        this.registrationSuccessMessage = '';
        this.registrationError = 'Update failed. Please try again.';
        console.error('[PATCH error]', err);
        this.cd.detectChanges();
      }
    });
  }

  requestEmailEdit(): void {
    if (!this.isEditMode) return;
    this.emailEditRequested = true;
  }

  async fetchAndPatchProfile(): Promise<void> {
    const token = this.getToken();
    if (token) {
      await new Promise<void>((resolve) => {
        this.configService.getInfluencerProfileById().subscribe({
          next: (profile: any) => {
            if (!profile || !this.registrationForm) {
              this.registrationError = 'Profile not found or you are not logged in.';
              resolve();
              return;
            }
            this.emailVerified = !!profile.isEmailVerified;
            this.phoneVerified = !!profile.isMobileVerified;
            this.commissionAccessTags = this.extractCommissionAccessTags(profile.adminTags);
            this.firstRegisteredAt = profile.firstRegisteredAt || profile.createdAt || null;
            this.lastLoginAt = profile.lastLoginAt || null;
            this.showEmailVerificationPrompt = !this.emailVerified;
            const stateId = (this.states || []).find((s: any) => s.name === profile.location?.state)?.['_id'] || '';
            const languageIds = (profile.languages || []).map((name: string) =>
              (this.languagesList || []).find((l: any) => l.name === name)?._id
            ).filter(Boolean);
            const categoryIds = (profile.categories || []).map((name: string) =>
              (this.categoriesList || []).find((c: any) => c.name === name)?._id
            ).filter(Boolean);
            const creatorTypeIds = (profile.creatorTypes || []).map((name: string) =>
              (this.creatorTypeOptions || []).find((item: any) => item.name === name)?._id || name
            ).filter(Boolean);
            const doPatch = (districtId: string) => {
              this.registrationForm.patchValue({
                name: profile.name || '',
                username: profile.username || '',
                phoneNumber: profile.phoneNumber || '',
                email: profile.email || '',
                dateOfBirth: this.normalizeDateForInput(profile.dateOfBirth),
                gender: profile.gender || '',
                influencerCategory:
                  (this.categoriesList || []).find((c: any) => c.name === profile.influencerCategory)?._id ||
                  '',
                professionalStatus: !!profile.professionalStatus,
                expertiseArea: profile.expertiseArea || '',
                verificationDocuments: profile.verificationDocuments || [],
                verificationDisclaimerAccepted: !!profile.verificationDisclaimerAccepted,
                paymentOption: profile.isPremium ? 'premium' : 'free',
                location: { state: stateId, district: districtId },
                languages: languageIds,
                categories: categoryIds,
                creatorTypes: creatorTypeIds,
                contact: profile.contact || { whatsapp: false, email: false, call: false },
                collaborationAvailability: profile.collaborationAvailability || {
                  enabled: false,
                  collaborationTypes: [],
                  preference: '',
                  availableFor: [],
                  openToTravel: false,
                },
                website: profile.website || '',
                payout: {
                  upiId: profile.payout?.upiId || '',
                  mobile: profile.payout?.mobile || profile.phoneNumber || '',
                  accountHolderName: profile.payout?.accountHolderName || profile.name || '',
                }
              }, { emitEvent: false });
              const arr = this.registrationForm.get('profileImages') as FormArray;
              if (arr) {
                arr.clear();
                (profile.profileImages || []).forEach((img: any) => arr.push(this.fb.group({
                  url: this.normalizeImageUrl(img.url),
                  public_id: img.public_id
                })));
                this.verificationDocuments = Array.isArray(profile.verificationDocuments)
                  ? profile.verificationDocuments
                  : [];
                this.verificationStatusDisplay = profile.verificationStatus || 'not_submitted';
                this.verificationAdminNotesDisplay = profile.verificationAdminNotes || '';
                // set preview for fetched profile; keep file null to avoid attempting to upload a non-File object
                this.profileImagePreview = (profile.profileImages && profile.profileImages[0]?.url) ? this.normalizeImageUrl(profile.profileImages[0].url) : null;
                this.profileImageFile = null;
              }
              // Patch socialMedia into platformForms
              this.platformForms = {};
              (profile.socialMedia || []).forEach((sm: any) => {
                const platformObj = (this.socialMediaList || []).find((s: any) => s.name === sm.platform);
                if (platformObj) {
                  this.platformForms[platformObj._id] = {
                    handle: sm.handle || '',
                    followersCount: sm.followersCount || '',
                    tier: sm.tier || '',
                    contentTypes: Object.fromEntries(
                      (platformObj.contentTypes || []).map((ct: any) => {
                        const saved = (sm.contentTypes || []).find((c: any) => c.name === ct.name);
                        return [ct.name, { selected: saved?.enabled || false, price: saved?.price || '' }];
                      })
                    )
                  };
                }
              });
              const _pfKeys2 = Object.keys(this.platformForms);
              this.activePlatformTab = _pfKeys2.length ? _pfKeys2[0] : null;
              this.originalPlatformForms = JSON.parse(JSON.stringify(this.platformForms));
              this.originalFormValue = this.registrationForm.getRawValue();
              this.premiumStart = profile.premiumStart ? new Date(profile.premiumStart) : null;
              this.premiumEnd = profile.premiumEnd ? new Date(profile.premiumEnd) : null;
              this.refreshStepCompletion();
              resolve();
            };
            if (profile.location?.state) {
              this.configService.getDistricts(profile.location.state, stateId).subscribe({
                next: (dists) => {
                  this.districts = Array.isArray(dists) ? dists : [];
                  const savedDistrict = (profile.location?.district || '').toString().trim();
                  const lower = savedDistrict.toLowerCase();
                  const resolved = savedDistrict
                    ? (this.districts.find((d: any) => d._id === savedDistrict) ||
                       this.districts.find((d: any) => (d.name || '').toString().trim().toLowerCase() === lower))
                    : null;
                  const districtId = resolved ? resolved._id : '';
                  doPatch(districtId);
                },
                error: () => doPatch('')
              });
            } else {
              doPatch('');
            }
          },
          error: () => {
            this.registrationError = 'Error fetching profile.';
            resolve();
          }
        });
      });
    }
  }

  toggleProfessionalOptional(): void {
    this.showProfessionalOptional = !this.showProfessionalOptional;
  }

  async onVerificationFilesChange(event: any): Promise<void> {
    if (!this.isEditMode) return;
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
      this.cd.detectChanges();
    } catch {
      this.verificationUploadError = 'Verification upload failed. Please try again.';
    } finally {
      this.verificationUploading = false;
      if (event?.target) event.target.value = '';
    }
  }

  removeVerificationDocument(index: number): void {
    if (!this.isEditMode) return;
    this.verificationDocuments = this.verificationDocuments.filter((_, i) => i !== index);
    this.registrationForm.get('verificationDocuments')?.setValue(this.verificationDocuments);
    if (!this.verificationDocuments.length) {
      this.registrationForm.get('verificationDisclaimerAccepted')?.setValue(false);
      this.verificationConsentError = '';
    }
  }

  private normalizeDateForInput(value: unknown): string {
    if (!value) return '';
    const dt = new Date(String(value));
    if (Number.isNaN(dt.getTime())) return '';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
