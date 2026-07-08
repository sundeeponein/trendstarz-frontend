import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ResetPasswordModalComponent } from '../../shared/components/reset-password-modal/reset-password-modal.component';
import { ImageGuidelinesService } from '../../shared/components/image-guidelines-modal/image-guidelines.service';
import { PlansService, PlanCapabilities, FREE_CAPABILITIES, Plan } from '../../shared/plans.service';
import { environment } from '../../../environments/environment';
import { CollaborationAvailabilityFormComponent } from '../../shared/collaboration-availability/collaboration-availability-form.component';
import { FirebaseAuthService } from '../../shared/firebase-auth.service';
import { ChipSelectionGroupComponent } from '../../shared/chip-selection-group/chip-selection-group.component';
import { buildSocialProfileUrl, normalizeSocialHandle, socialHandleExample, validateSocialHandle } from '../../shared/social-handle.util';
import {
  ProfileVerificationDashboard,
  ProfileVerificationService,
} from '../../services/profile-verification.service';
import { ProfileReviewSummaryComponent } from '../../shared/profile-verification/profile-review-summary.component';
import { validateImageFile, compressImageFile, isOversizedAfterCompression, OVERSIZE_MESSAGE } from '../../shared/utils/image-upload.util';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { RegistrationNoticeComponent } from '../../shared/components/registration-notice/registration-notice.component';
import { MobileBottomActionsComponent } from '../../shared/components/mobile-bottom-actions/mobile-bottom-actions.component';
import { WhatsappCommunityCardComponent } from '../../shared/whatsapp-community-card/whatsapp-community-card.component';
import { ImageCropModalComponent } from '../../shared/components/image-crop-modal/image-crop-modal.component';

@Component({
  selector: 'app-photographer-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, ResetPasswordModalComponent, CollaborationAvailabilityFormComponent, ChipSelectionGroupComponent, ProfileReviewSummaryComponent, ConfirmDialogComponent, WhatsappCommunityCardComponent, RegistrationNoticeComponent, MobileBottomActionsComponent, ImageCropModalComponent],
  templateUrl: './photographer-profile.component.html',
  styleUrls: ['./photographer-profile.component.scss'],
})
export class PhotographerProfileComponent implements OnInit {
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

  form!: FormGroup;
  loading = true;
  saving = false;
  saved = false;
  submitted = false;
  errorMsg = '';
  isEditMode = false;
  currentStep: 1 | 2 | 3 = 1;
  step1Complete = false;
  step2Complete = false;
  step3Complete = false;
  selectedPlan: 'free' | 'premium' = 'free';
  planCaps: PlanCapabilities = FREE_CAPABILITIES;
  premiumMonthlyPrice = 399;
  premiumOriginalMonthlyPrice: number | null = null;
  premiumOfferChip = '';
  showResetPasswordModal = false;
  startingPriceRequiredError = false;
  private originalFormValue: any = null;
  private originalPricingState: any = null;
  private originalPlatformForms: any = null;
  phoneVerified = false;
  phoneEditRequested = false;
  emailVerified = false;
  communityProfileUser: any | null = null;
  emailEditRequested = false;
  showEmailVerificationPrompt = false;
  emailJustChanged = false;
  previousVerifiedEmail = '';
  pendingVerificationEmail = '';
  resendingEmailVerification = false;
  resendEmailVerificationSuccess = false;
  resendEmailVerificationError: string | null = null;
  showPhoneOtp = false;
  phoneOtp: string[] = ['', '', '', '', '', ''];
  phoneVerifyError = '';
  verifyingPhoneOtp = false;
  phoneOtpError = '';
  private firebasePhoneConfirmation: any = null;
  verificationCallNumber = '';
  otpVerificationEnabled = false;
  profileConfirmOpen = false;
  profileConfirmMessage = '';
  private profileConfirmResolver: ((confirmed: boolean) => void) | null = null;
  readonly maxSkills = 3;
  readonly maxAvailableFor = 2;

  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];
  collaborationAvailabilityOptions: any = {};
  tiers: any[] = [];

  pricingState: { [key: string]: { enabled: boolean; price: string } } = {};
  platformForms: {
    [platformId: string]: {
      handle: string;
      followersCount: string;
      tier: string;
      contentTypes: { [name: string]: { selected: boolean; price: string } };
    };
  } = {};
  activePlatformTab: string | null = null;

  profileImagePreview = '';
  profileImageData: { url: string; public_id: string } | null = null;
  uploadingImage = false;
  photoshootImagesPreview: string[] = [];
  photoshootImagesData: { url: string; public_id: string }[] = [];
  galleryUploadWarning = '';
  readonly MAX_PHOTOSHOOT_IMAGES = 2;
  private originalPhotoshootImagesPreview: string[] = [];
  private originalPhotoshootImagesData: { url: string; public_id: string }[] = [];
  commissionAccessTags: string[] = [];
  platformCommissionPercent: number = 0;
  firstRegisteredAt: string | null = null;
  lastLoginAt: string | null = null;
  profileVerificationDashboard: ProfileVerificationDashboard | null = null;
  profileVerificationLoading = false;

  private apiUrl = environment.apiBaseUrl || '/api';

  constructor(
    private fb: FormBuilder,
    private config: ConfigService,
    private plansService: PlansService,
    private session: SessionService,
    private toast: ToastService,
    private http: HttpClient,
    private guidelinesService: ImageGuidelinesService,
    private cdr: ChangeDetectorRef,
    private firebaseAuth: FirebaseAuthService,
    private profileVerification: ProfileVerificationService,
  ) {}

  private loadProfileVerificationDashboard(): void {
    this.profileVerificationLoading = true;
    this.profileVerification.getMyDashboard().subscribe({
      next: (dashboard) => {
        this.profileVerificationDashboard = dashboard;
        this.profileVerificationLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.profileVerificationDashboard = null;
        this.profileVerificationLoading = false;
      },
    });
  }

  private formatFirebasePhone(phone: string): string {
    const value = String(phone || '').trim();
    if (value.startsWith('+')) return value;
    const digits = value.replace(/\D/g, '');
    return digits.length === 10 ? `+91${digits}` : `+${digits}`;
  }

  sendPhoneOtp(): void {
    if (!this.otpVerificationEnabled) return;
    void this.sendFirebasePhoneOtp();
  }

  private async sendFirebasePhoneOtp(): Promise<void> {
    try {
      const phone = this.formatFirebasePhone(this.form.get('phoneNumber')?.value);
      this.firebasePhoneConfirmation = await this.firebaseAuth.sendPhoneOtp(phone, 'photographer-phone-recaptcha');
      this.phoneVerifyError = '';
      this.phoneOtpError = '';
      this.showPhoneOtp = true;
    } catch (error: any) {
      this.phoneVerifyError = error?.message || 'Failed to send OTP';
    }
  }

  confirmPhoneOtp(): void {
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

  private buildCriticalProfileMessage(raw: any): string {
    const socials = this.selectedPlatforms().map((platform: any) => {
      const pf = this.platformForms[platform._id] || {};
      return `${platform.name}: ${pf.handle || '-'} | ${pf.tier || '-'} | ${pf.followersCount || 0} followers`;
    });
    const stateValue = String(raw?.location?.state || '').trim();
    const districtValue = String(raw?.location?.district || '').trim();
    const state = this.states.find((s: any) => String(s?._id || '') === stateValue || String(s?.name || '').toLowerCase() === stateValue.toLowerCase())?.name || stateValue || '-';
    const district = this.districts.find((d: any) => String(d?._id || '') === districtValue || String(d?.name || '').toLowerCase() === districtValue.toLowerCase())?.name || districtValue || '-';
    const hasProfilePhoto = !!(this.profileImagePreview || this.profileImageData?.url);
    return [
      'Please verify these details before saving:',
      '',
      `Email: ${raw?.email || '-'}`,
      `Mobile: ${raw?.phoneNumber || '-'}`,
      `Profile photo: ${hasProfilePhoto ? 'Uploaded' : 'Missing'}`,
      `Location: ${district} | ${state}`,
      `Social profile & tier: ${socials.length ? socials.join('; ') : '-'}`,
      '',
      'Continue saving profile?'
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

  private confirmEditVerifiedEmail(): Promise<boolean> {
    this.profileConfirmMessage = 'Your email is currently verified. Changing it will mark it as unverified, and some features may be restricted until you verify the new address. Continue?';
    this.profileConfirmOpen = true;
    this.cdr.detectChanges();
    return new Promise((resolve) => {
      this.profileConfirmResolver = resolve;
    });
  }

  private confirmEditVerifiedPhone(): Promise<boolean> {
    this.profileConfirmMessage = 'Your mobile number is currently verified. Changing it will mark it as unverified, and you will need to re-verify the new number before some features are available again. Continue?';
    this.profileConfirmOpen = true;
    this.cdr.detectChanges();
    return new Promise((resolve) => {
      this.profileConfirmResolver = resolve;
    });
  }

  async requestPhoneEdit(): Promise<void> {
    if (!this.isEditMode) return;
    if (this.phoneVerified && !(await this.confirmEditVerifiedPhone())) return;
    this.phoneEditRequested = true;
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

  openProfilePhotoGuidelines(): void {
    this.guidelinesService.open('influencer');
  }

  openGalleryImageGuidelines(): void {
    this.guidelinesService.open('influencer');
  }

  private loadPremiumMonthlyPrice(): void {
    this.plansService.getActivePlans('PHOTOGRAPHER').subscribe((plans) => {
      const paidPlan = plans.find((plan) => (plan?.price?.monthly ?? 0) > 0);
      if (!paidPlan) return;
      const monthly = Number(paidPlan?.price?.monthly || 0);
      if (monthly > 0) this.premiumMonthlyPrice = monthly;

      const discountPercent = this.getPlanDiscountPercent(paidPlan, ['discountOnPhotographerPro', 'discountMonthly']);
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

  get totalImageLimit(): number {
    const fromPortfolio = Number(this.plansService.getLimitValue(this.planCaps, 'maxPortfolioImages'));
    if (Number.isFinite(fromPortfolio) && fromPortfolio > 0) return fromPortfolio;
    const fromFallback = Number(this.plansService.getLimitValue(this.planCaps, 'maxProductImages'));
    if (Number.isFinite(fromFallback) && fromFallback > 0) return fromFallback;
    return 3;
  }

  get maxPhotoshootImages(): number {
    return Math.max(0, this.totalImageLimit - 1);
  }

  private enforceGalleryLimit(): void {
    if (this.photoshootImagesData.length <= this.maxPhotoshootImages) return;
    this.photoshootImagesData = this.photoshootImagesData.slice(0, this.maxPhotoshootImages);
    this.photoshootImagesPreview = this.photoshootImagesPreview.slice(0, this.maxPhotoshootImages);
  }

  get hasContactVisibility(): boolean {
    return this.plansService.getFeatureValue(this.planCaps, 'contactVisibility');
  }

  private extractCommissionAccessTags(tags: unknown): string[] {
    const all = Array.isArray(tags) ? tags : [];
    const allowed = new Set(['early access', 'partner', 'internal/test', 'internal test']);
    return all
      .map((tag: any) => String(tag || '').trim())
      .filter((tag: string) => !!tag && allowed.has(tag.toLowerCase()));
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

  private asText(value: any): string {
    return String(value ?? '').trim();
  }

  private resolveStateValue(rawState: any): string {
    const value = this.asText(rawState);
    if (!value) return '';
    const byId = this.states.find((s: any) => String(s?._id || '') === value);
    if (byId) return String(byId._id || byId.name || value);
    const byName = this.states.find((s: any) => this.asText(s?.name).toLowerCase() === value.toLowerCase());
    if (byName) return String(byName._id || byName.name || value);
    return value;
  }

  private getProfileImage(profile: any, sessionUser: any): { url: string; public_id: string } | null {
    const getImageUrl = (entry: any): string => {
      if (!entry) return '';
      if (typeof entry === 'string') return this.asText(entry);
      return this.asText(entry?.url) || this.asText(entry?.secure_url);
    };
    const getImagePublicId = (entry: any): string => {
      if (!entry || typeof entry === 'string') return '';
      return this.asText(entry?.public_id) || this.asText(entry?.publicId);
    };

    const firstProfileImage = profile?.profileImages?.[0] || sessionUser?.profileImages?.[0] || null;
    // profileImages[0] is the live source of truth; profileImage is a legacy
    // field that can go stale after a re-upload/recrop, so prefer the array.
    const imgUrl =
      getImageUrl(firstProfileImage) ||
      this.asText(profile?.profileImage) ||
      this.asText(sessionUser?.profileImage);

    if (!imgUrl) return null;
    return {
      url: imgUrl,
      public_id:
        this.asText(profile?.profileImagePublicId) ||
        getImagePublicId(firstProfileImage),
    };
  }

  private syncLocationDisplay(): void {
    const stateControl = this.form.get('location.state');
    const districtControl = this.form.get('location.district');
    if (!stateControl || !districtControl) return;

    const currentState = this.asText(stateControl.value);
    const currentDistrict = this.asText(districtControl.value);
    if (!currentState) return;

    const stateMatch = this.states.find(
      (s: any) =>
        this.asText(s?._id) === currentState ||
        this.asText(s?.name).toLowerCase() === currentState.toLowerCase(),
    );

    if (!stateMatch && !this.states.some((s: any) => this.asText(s?._id) === currentState || this.asText(s?.name) === currentState)) {
      this.states = [...this.states, { _id: currentState, name: currentState }];
      this.cdr.detectChanges();
      return;
    }

    const stateId = this.asText(stateMatch?._id) || currentState;
    const stateName = this.asText(stateMatch?.name) || currentState;
    const canonicalState = stateId || stateName;
    if (canonicalState && canonicalState !== currentState) {
      stateControl.setValue(canonicalState, { emitEvent: false });
    }

    this.config.getDistricts(stateName, stateId).subscribe({
      next: d => {
        this.districts = Array.isArray(d) ? d : [];
        const matchedDistrict = this.districts.find(
          (x: any) =>
            this.asText(x?._id) === currentDistrict ||
            this.asText(x?.name).toLowerCase() === currentDistrict.toLowerCase(),
        );
        if (currentDistrict && matchedDistrict) {
          const canonicalDistrict = this.asText(matchedDistrict?._id) || this.asText(matchedDistrict?.name);
          if (canonicalDistrict && canonicalDistrict !== currentDistrict) {
            districtControl.setValue(canonicalDistrict, { emitEvent: false });
          }
        }
        if (currentDistrict && !matchedDistrict) {
          this.districts = [...this.districts, { _id: currentDistrict, name: currentDistrict }];
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.districts = currentDistrict ? [{ _id: currentDistrict, name: currentDistrict }] : [];
        this.cdr.detectChanges();
      },
    });
  }

  ngOnInit() {
    this.config.getAppSettings().subscribe((settings) => {
      this.otpVerificationEnabled = !!settings.otpVerificationEnabled;
      if (typeof settings.photographerFeePercent === 'number') this.platformCommissionPercent = settings.photographerFeePercent;
      this.cdr.detectChanges();
    });
    this.loadProfileVerificationDashboard();
    this.loadPremiumMonthlyPrice();
    this.plansService.getMyCapabilities().subscribe((caps) => {
      this.planCaps = caps;
      this.selectedPlan = caps?.hasPremium ? 'premium' : 'free';
      this.enforceGalleryLimit();
      // Keep saved contact preferences visible even if the current plan
      // does not allow editing them.
      this.cdr.detectChanges();
    });

    this.form = this.fb.group({
      name: [{ value: '', disabled: true }, Validators.required],
      username: [{ value: '', disabled: true }, [Validators.required, Validators.pattern('^[a-zA-Z0-9_\\-]+$')]],
      phoneNumber: [{ value: '', disabled: true }, Validators.required],
      email: [{ value: '', disabled: true }, [Validators.email]],
      dateOfBirth: [{ value: '', disabled: true }],
      gender: [{ value: '', disabled: true }],
      portfolio: [{ value: '', disabled: true }],
      location: this.fb.group({
        state: [{ value: '', disabled: true }],
        district: [{ value: '', disabled: true }],
      }),
      skills: [{ value: [], disabled: true }],
      equipment: [{ value: [], disabled: true }],
      contact: this.fb.group({
        whatsapp: [{ value: false, disabled: true }],
        email: [{ value: false, disabled: true }],
        call: [{ value: false, disabled: true }],
      }),
      collaborationAvailability: this.fb.group({
        enabled: [{ value: false, disabled: true }],
        availableFor: [{ value: [], disabled: true }],
        preference: [{ value: '', disabled: true }],
        openToTravel: [{ value: false, disabled: true }],
      }),
      payout: this.fb.group({
        upiId: [{ value: '', disabled: true }],
        mobile: [{ value: '', disabled: true }],
        accountHolderName: [{ value: '', disabled: true }],
      }),
    });

    this.form.valueChanges.subscribe(() => this.refreshStepCompletion());
    this.form.statusChanges.subscribe(() => this.refreshStepCompletion());

    // Keep username synced from Full Name during profile edit (influencer-style behavior).
    this.form.get('name')?.valueChanges.subscribe((name: string) => {
      if (!this.isEditMode) return;
      this.form.get('username')?.setValue(this.slugifyUsername(name || ''), { emitEvent: false });
    });

    this.form.get('location.state')?.valueChanges.subscribe(stateId => {
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

    this.config.getStates().subscribe(data => {
      this.states = Array.isArray(data) ? data : [];
      this.syncLocationDisplay();
      this.cdr.detectChanges();
    });
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
    this.config.getTiers().subscribe(data => { this.tiers = Array.isArray(data) ? data : []; });

    // Wait for both pricing options and social media before loading profile
    // to avoid race condition where pricingState isn't ready when profile data arrives
    forkJoin({
      pricing: this.config.getPricingOptions(),
      social: this.config.getSocialMedia(),
      collaborationAvailabilityOptions: this.config.getCollaborationAvailabilityOptions(),
    }).subscribe(({ pricing, social, collaborationAvailabilityOptions }) => {
      const list = Array.isArray(pricing) ? pricing : [];
      this.pricingOptions = list.length ? list : this.fallbackPricing;
      this.pricingOptions.forEach(p => {
        this.pricingState[p.key] = { enabled: false, price: '' };
      });
      this.socialMediaList = Array.isArray(social) ? social : [];
      this.collaborationAvailabilityOptions = collaborationAvailabilityOptions || {};
      this.loadProfile();
      this.cdr.detectChanges();
    });
  }

  private loadProfile() {
    const token = this.session.getToken();
    if (!token) {
      this.loading = false;
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http.get<any>(`${this.apiUrl}/users/photographers/me/profile`, { headers }).subscribe({
      next: (data) => {
        const sessionUser = this.session.getUser() || {};
        const profile = data?.data?.user ?? data?.user ?? data?.profile ?? data?.data ?? data ?? {};
        const username = this.asText(profile?.username) || this.asText(profile?.userName) || this.asText(sessionUser?.username) || this.asText(sessionUser?.userName);
        const resolvedState = this.resolveStateValue(profile?.location?.state ?? profile?.state ?? sessionUser?.location?.state ?? sessionUser?.state);
        const resolvedDistrict = this.asText(profile?.location?.district ?? profile?.district ?? sessionUser?.location?.district ?? sessionUser?.district);
        this.commissionAccessTags = this.extractCommissionAccessTags(profile?.adminTags);
        this.firstRegisteredAt = profile?.firstRegisteredAt || profile?.createdAt || null;
        this.lastLoginAt = profile?.lastLoginAt || null;
        this.phoneVerified = !!(profile?.phoneVerified ?? profile?.isMobileVerified ?? sessionUser?.phoneVerified ?? sessionUser?.isMobileVerified);
        this.emailVerified = !!(profile?.isEmailVerified ?? sessionUser?.isEmailVerified);
        this.communityProfileUser = {
          ...profile,
          isEmailVerified: this.emailVerified,
          isMobileVerified: this.phoneVerified,
          location: profile?.location || { state: resolvedState, district: resolvedDistrict },
        };
        this.showEmailVerificationPrompt = !this.emailVerified;
        this.verificationCallNumber = String(profile?.verificationCallNumber || '');
        this.form.patchValue({
          name: profile.name || sessionUser?.name || '',
          username,
          phoneNumber: profile.phoneNumber || sessionUser?.phoneNumber || '',
          email: profile.email || sessionUser?.email || '',
          dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().slice(0, 10) : '',
          gender: profile.gender || '',
          portfolio: profile.portfolio || '',
          location: {
            state: resolvedState,
            district: resolvedDistrict,
          },
          skills: profile.skills || [],
          equipment: profile.equipment || [],
          contact: {
            whatsapp: !!profile.contact?.whatsapp,
            email: !!profile.contact?.email,
            call: !!profile.contact?.call,
          },
          collaborationAvailability: profile.collaborationAvailability || {
            enabled: false,
            availableFor: [],
            preference: '',
            openToTravel: false,
          },
          payout: {
            upiId: profile.payout?.upiId || '',
            mobile: profile.payout?.mobile || '',
            accountHolderName: profile.payout?.accountHolderName || '',
          },
        });

        this.selectedPlan = this.planCaps?.hasPremium ? 'premium' : (profile.isPremium ? 'premium' : 'free');
        this.syncLocationDisplay();

        // Pricing
        if (Array.isArray(profile.pricing)) {
          profile.pricing.forEach((p: any) => {
            if (this.pricingState[p.name]) {
              this.pricingState[p.name].enabled = !!p.enabled;
              this.pricingState[p.name].price = p.price ? String(p.price) : '';
            }
          });
        }

        // Social media
        if (Array.isArray(profile.socialMedia)) {
          profile.socialMedia.forEach((sm: any) => {
            const platform = this.socialMediaList.find(p => p.name === sm.platform || p._id === sm.platform);
            if (platform) {
              const contentTypesFromDb = Array.isArray(sm.contentTypes) ? sm.contentTypes : [];
              const contentTypesMap = Object.fromEntries(
                (platform.contentTypes || []).map((ct: any) => {
                  const existing = contentTypesFromDb.find((x: any) => x?.name === ct.name);
                  return [ct.name, {
                    selected: !!existing?.enabled,
                    price: existing?.price ? String(existing.price) : '',
                  }];
                }),
              );
              this.platformForms[platform._id] = {
                handle: sm.handle || '',
                followersCount: sm.followersCount ? String(sm.followersCount) : '',
                tier: sm.tier || '',
                contentTypes: contentTypesMap,
              };
            }
          });
          const firstPlatform = this.selectedPlatforms();
          if (firstPlatform.length) this.activePlatformTab = firstPlatform[0]._id;
        }

        // Profile image
        const profileImage = this.getProfileImage(profile, sessionUser);
        if (profileImage?.url) {
          this.profileImagePreview = profileImage.url;
          this.profileImageData = profileImage;
        }

        const sourceImages = Array.isArray(profile?.profileImages)
          ? profile.profileImages
          : Array.isArray(sessionUser?.profileImages)
            ? sessionUser.profileImages
            : [];
        const gallerySource = sourceImages.slice(1).filter((img: any) => !!img?.url);
        this.photoshootImagesData = gallerySource.map((img: any) => ({
          url: String(img.url),
          public_id: String(img.public_id || img.publicId || ''),
        }));
        this.photoshootImagesPreview = this.photoshootImagesData.map((img) => img.url);
        this.enforceGalleryLimit();
        this.galleryUploadWarning = '';

        this.loading = false;
        this.isEditMode = false;
        this.form.disable({ emitEvent: false });
        // Snapshot originals for cancel
        this.originalFormValue = this.form.getRawValue();
        this.originalPricingState = JSON.parse(JSON.stringify(this.pricingState));
        this.originalPlatformForms = JSON.parse(JSON.stringify(this.platformForms));
        this.originalPhotoshootImagesPreview = [...this.photoshootImagesPreview];
        this.originalPhotoshootImagesData = this.photoshootImagesData.map((img) => ({ ...img }));
        this.refreshStepCompletion();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  setSkills(values: string[]): void {
    if (!this.isEditMode) return;
    this.form.get('skills')?.setValue(values);
    this.form.get('skills')?.markAsTouched();
    this.refreshStepCompletion();
  }

  toggleEquipment(eq: string) {
    if (!this.isEditMode) return;
    const arr: string[] = [...(this.form.get('equipment')?.value || [])];
    const idx = arr.indexOf(eq);
    idx > -1 ? arr.splice(idx, 1) : arr.push(eq);
    this.form.get('equipment')?.setValue(arr);
    this.refreshStepCompletion();
  }

  isEquipmentSelected(eq: string): boolean {
    return (this.form.get('equipment')?.value || []).includes(eq);
  }

  isPlatformSelected(platform: any): boolean {
    return !!this.platformForms[platform._id];
  }

  getPlatformById(id: string | null): any {
    if (!id) return null;
    return (this.socialMediaList || []).find((p: any) => p._id === id) || null;
  }

  togglePlatform(platform: any) {
    if (!this.isEditMode) return;
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
    this.refreshStepCompletion();
    this.cdr.detectChanges();
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

  private computeStepComplete(step: 1 | 2 | 3): boolean {
    if (step === 1) {
      const name = String(this.form.get('name')?.value || '').trim();
      const username = String(this.form.get('username')?.value || '').trim();
      const phone = String(this.form.get('phoneNumber')?.value || '').trim();
      return !!name && !!username && !!phone;
    }
    if (step === 2) {
      const state = String(this.form.get('location.state')?.value || '').trim();
      const district = String(this.form.get('location.district')?.value || '').trim();
      const hasSkills = Array.isArray(this.form.get('skills')?.value) && this.form.get('skills')?.value.length > 0;
      return !!(state || district || hasSkills || this.selectedPlatforms().length);
    }
    if (!this.hasContactVisibility) return this.step1Complete && this.step2Complete;
    const c = this.form.get('contact')?.value || {};
    return this.step1Complete && this.step2Complete && !!(c.whatsapp || c.email || c.call);
  }

  isContactEditable(): boolean {
    return this.isEditMode && this.hasContactVisibility;
  }

  selectPlan(plan: 'free' | 'premium') {
    // Profile plan state is admin/payment managed; cards are informational here.
    this.selectedPlan = this.planCaps?.hasPremium ? 'premium' : 'free';
    this.refreshStepCompletion();
  }

  getStartingPrice(): string {
    return this.pricingState['Starting Price']?.price || '';
  }

  setStartingPrice(value: string) {
    if (!this.pricingState['Starting Price']) {
      this.pricingState['Starting Price'] = { enabled: true, price: '' };
    }
    this.pricingState['Starting Price'].enabled = true;
    this.pricingState['Starting Price'].price = value;
    if (String(value ?? '').trim()) {
      this.startingPriceRequiredError = false;
    }
  }

  goToStep(step: 1 | 2 | 3) {
    if (this.isEditMode && step > this.currentStep && !this.validateCurrentStep()) return;
    this.currentStep = step;
    this.refreshStepCompletion();
  }

  nextStep() {
    if (this.isEditMode && !this.validateCurrentStep()) return;
    this.currentStep = Math.min(3, this.currentStep + 1) as 1 | 2 | 3;
    this.refreshStepCompletion();
  }

  prevStep() {
    this.currentStep = Math.max(1, this.currentStep - 1) as 1 | 2 | 3;
    this.refreshStepCompletion();
  }

  private validateCurrentStep(): boolean {
    if (this.currentStep !== 1) return true;
    const name = this.form.get('name');
    const phone = this.form.get('phoneNumber');
    name?.markAsTouched();
    phone?.markAsTouched();
    return !!name?.valid && !!phone?.valid;
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
    return selected.every((p: any) => {
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

  cropModalOpen = false;
  cropSourceFile: File | null = null;
  private profileImageInputEl: HTMLInputElement | null = null;

  onProfileImageFileChange(event: Event) {
    this.profileImageInputEl = event.target as HTMLInputElement;
    const file = this.profileImageInputEl.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) { this.toast.error(validationError); return; }
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
      this.toast.error(OVERSIZE_MESSAGE);
      this.cdr.detectChanges();
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => { this.profileImagePreview = e.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(compressedFile);
    const formData = new FormData();
    formData.append('file', compressedFile);
    formData.append('folder', `photographers/${this.session.getUser()?.id}/profile`);
    this.config.uploadImage(formData).subscribe({
      next: (res: any) => {
        if (!res?.url || !res?.public_id) {
          this.uploadingImage = false;
          this.profileImagePreview = '';
          this.toast.error('Image upload failed. Please try again.');
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
    if (!this.isEditMode) return;

    const files = Array.from((event.target as HTMLInputElement).files || []);
    if (!files.length) return;

    const remainingSlots = this.maxPhotoshootImages - this.photoshootImagesData.length;
    const selectedFiles = files.slice(0, Math.max(0, remainingSlots));
    if (!selectedFiles.length) return;

    let failedUploads = 0;

    for (const file of selectedFiles) {
      if (validateImageFile(file)) {
        failedUploads += 1;
        continue;
      }

      const compressedFile = await compressImageFile(file, 'gallery');
      if (isOversizedAfterCompression(compressedFile)) {
        failedUploads += 1;
        continue;
      }

      const preview = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result || ''));
        reader.onerror = () => reject(new Error('preview_failed'));
        reader.readAsDataURL(compressedFile);
      }).catch(() => '');

      if (!preview) {
        failedUploads += 1;
        continue;
      }

      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('type', 'gallery');

      const uploaded = await new Promise<{ url: string; public_id: string } | null>((resolve) => {
        this.config.uploadAuthenticatedImage(formData, this.session.getToken()).subscribe({
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
    if (!this.isEditMode) return;
    if (index < 0 || index >= this.photoshootImagesData.length) return;
    this.photoshootImagesPreview.splice(index, 1);
    this.photoshootImagesData.splice(index, 1);
    this.galleryUploadWarning = '';
  }

  enableEdit(): void {
    this.isEditMode = true;
    this.submitted = false;
    this.startingPriceRequiredError = false;
    this.form.enable({ emitEvent: false });
    this.emailEditRequested = !this.emailVerified;
    this.originalFormValue = this.form.getRawValue();
    this.originalPricingState = JSON.parse(JSON.stringify(this.pricingState));
    this.originalPlatformForms = JSON.parse(JSON.stringify(this.platformForms));
    this.originalPhotoshootImagesPreview = [...this.photoshootImagesPreview];
    this.originalPhotoshootImagesData = this.photoshootImagesData.map((img) => ({ ...img }));
    this.refreshStepCompletion();
    this.cdr.detectChanges();
  }

  cancelEdit(): void {
    this.isEditMode = false;
    this.submitted = false;
    this.startingPriceRequiredError = false;
    this.emailEditRequested = false;
    if (this.originalFormValue) {
      this.form.reset(this.originalFormValue, { emitEvent: false });
    }
    if (this.originalPricingState) {
      this.pricingState = JSON.parse(JSON.stringify(this.originalPricingState));
    }
    if (this.originalPlatformForms) {
      this.platformForms = JSON.parse(JSON.stringify(this.originalPlatformForms));
      const platforms = this.selectedPlatforms();
      this.activePlatformTab = platforms.length ? platforms[0]._id : null;
    }
    this.photoshootImagesPreview = [...this.originalPhotoshootImagesPreview];
    this.photoshootImagesData = this.originalPhotoshootImagesData.map((img) => ({ ...img }));
    this.galleryUploadWarning = '';
    this.form.disable({ emitEvent: false });
    this.refreshStepCompletion();
    this.cdr.detectChanges();
  }

  async onSave() {
    this.submitted = true;
    if (!this.isEditMode || this.form.invalid || this.saving) return;
    if (this.selectedPlatforms().length > 0 && !this.platformsValid) {
      this.toast.error('Please select at least one content type and enter a starting rate.');
      this.cdr.detectChanges();
      return;
    }
    const startingPriceInput = String(this.getStartingPrice() ?? '').trim();
    if (!startingPriceInput) {
      this.startingPriceRequiredError = true;
      this.cdr.detectChanges();
      return;
    }
    this.startingPriceRequiredError = false;
    const v = this.form.getRawValue();
    if (!(await this.confirmCriticalProfileDetails(v))) {
      return;
    }
    const previousEmail = String(this.originalFormValue?.email || '').trim().toLowerCase();
    const currentEmail = String(v?.email || '').trim().toLowerCase();
    const emailChanged = !!currentEmail && previousEmail !== currentEmail;
    const previousEmailWasVerified = this.emailVerified;
    const previousPhone = String(this.originalFormValue?.phoneNumber || '').trim();
    const currentPhone = String(v?.phoneNumber || '').trim();
    const phoneChanged = !!currentPhone && previousPhone !== currentPhone;
    const stateValue = String(v?.location?.state || '').trim();
    const districtValue = String(v?.location?.district || '').trim();
    const stateObj = this.states.find(
      (s: any) => String(s?._id || '').trim() === stateValue || String(s?.name || '').trim().toLowerCase() === stateValue.toLowerCase(),
    );
    const districtObj = this.districts.find(
      (d: any) => String(d?._id || '').trim() === districtValue || String(d?.name || '').trim().toLowerCase() === districtValue.toLowerCase(),
    );
    const pricingArr = this.pricingOptions
      .filter(p => this.pricingState[p.key]?.enabled)
      .map(p => ({ name: p.key, enabled: true, price: Number(this.pricingState[p.key].price) || 0 }));
    const normalizedStartingPrice = Number(startingPriceInput) || 0;
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

    const payload: any = {
      ...v,
      username: this.slugifyUsername(this.form.get('username')?.value || v?.name || ''),
      location: {
        state: stateObj ? stateObj.name : stateValue,
        district: districtObj ? districtObj.name : districtValue,
      },
      pricing: pricingArr,
      socialMedia,
      collaborationAvailability: v.collaborationAvailability,
      payout: v.payout || { upiId: '', mobile: '', accountHolderName: '' },
    };
    const profileImages = [
      ...(this.profileImageData ? [this.profileImageData] : []),
      ...this.photoshootImagesData,
    ];
    if (profileImages.length) {
      payload.profileImages = profileImages;
    }
    if (this.profileImageData) {
      payload.profileImage = this.profileImageData.url;
      payload.profileImagePublicId = this.profileImageData.public_id;
    }

    const token = this.session.getToken();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
    this.saving = true;
    this.http.patch(`${this.apiUrl}/users/photographers/me/profile`, payload, { headers }).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.saved = true;
        this.submitted = false;
        this.isEditMode = false;
        this.form.disable({ emitEvent: false });
        this.originalFormValue = this.form.getRawValue();
        this.originalPricingState = JSON.parse(JSON.stringify(this.pricingState));
        this.originalPlatformForms = JSON.parse(JSON.stringify(this.platformForms));
        this.originalPhotoshootImagesPreview = [...this.photoshootImagesPreview];
        this.originalPhotoshootImagesData = this.photoshootImagesData.map((img) => ({ ...img }));
        this.galleryUploadWarning = '';
        if (emailChanged) {
          // Server may have auto-verified the new email (local dev bypass) —
          // trust its returned state instead of assuming it's pending.
          this.emailVerified = !!res?.isEmailVerified;
          this.emailEditRequested = true;
          if (!this.emailVerified) {
            this.showEmailVerificationPrompt = true;
            this.emailJustChanged = true;
            this.previousVerifiedEmail = previousEmailWasVerified ? previousEmail : '';
            this.pendingVerificationEmail = currentEmail;
            this.resendEmailVerification();
          }
        } else {
          this.emailEditRequested = false;
        }
        if (phoneChanged) {
          this.phoneVerified = false;
          this.phoneEditRequested = true;
        } else {
          this.phoneEditRequested = false;
        }
        this.refreshStepCompletion();
        this.toast.success('Profile saved!');
        setTimeout(() => { this.saved = false; this.cdr.detectChanges(); }, 3000);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.saving = false;
        this.toast.error(err?.error?.message || 'Failed to save profile.');
        this.cdr.detectChanges();
      },
    });
  }

  async requestEmailEdit(): Promise<void> {
    if (!this.isEditMode) return;
    if (this.emailVerified && !(await this.confirmEditVerifiedEmail())) return;
    this.emailEditRequested = true;
  }

  resendEmailVerification(): void {
    const email = String(this.form.get('email')?.value || '').trim();
    if (!email) {
      this.resendEmailVerificationError = 'Please enter a valid email first.';
      return;
    }
    this.resendingEmailVerification = true;
    this.resendEmailVerificationSuccess = false;
    this.resendEmailVerificationError = null;
    this.config.sendEmailVerificationLink(email).subscribe({
      next: () => {
        this.resendingEmailVerification = false;
        this.resendEmailVerificationSuccess = true;
      },
      error: (err: any) => {
        this.resendingEmailVerification = false;
        this.resendEmailVerificationError = err?.error?.message || 'Failed to resend verification email.';
      },
    });
  }
}
