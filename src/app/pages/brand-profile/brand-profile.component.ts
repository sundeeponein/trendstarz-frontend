
import { environment } from '../../../environments/environment';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AsyncValidatorFn, AbstractControl } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { PlansService, Plan, PlanCapabilities, FREE_CAPABILITIES } from '../../shared/plans.service';
import { map, first, catchError } from 'rxjs/operators';
import { of, forkJoin, firstValueFrom } from 'rxjs';
import { OtpService } from '../../shared/otp.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { RouterModule } from '@angular/router';
import { TierInfoService } from '../../shared/components/tier-info-modal/tier-info.service';
import { ImageGuidelinesService } from '../../shared/components/image-guidelines-modal/image-guidelines.service';
import { ResetPasswordModalComponent } from '../../shared/components/reset-password-modal/reset-password-modal.component';
import { TIER_DESC_MAP } from '../../shared/tiers.constants';
import { ToastService } from '../../shared/toast/toast.service';
import { FirebaseAuthService } from '../../shared/firebase-auth.service';
import { ChipSelectionGroupComponent } from '../../shared/chip-selection-group/chip-selection-group.component';
import { buildSocialProfileUrl, normalizeSocialHandle, socialHandleExample, validateSocialHandle } from '../../shared/social-handle.util';
import {
  ProfileVerificationDashboard,
  ProfileVerificationService,
} from '../../services/profile-verification.service';
import { ProfileReviewSummaryComponent } from '../../shared/profile-verification/profile-review-summary.component';
import { RegistrationNoticeComponent } from '../../shared/components/registration-notice/registration-notice.component';
import { atLeastOneContactRequired } from '../brand-registration/brand-registration.component';
import { MobileBottomActionsComponent } from '../../shared/components/mobile-bottom-actions/mobile-bottom-actions.component';
import { ImageCropModalComponent } from '../../shared/components/image-crop-modal/image-crop-modal.component';
import { validateImageFile, compressImageFile, isOversizedAfterCompression, OVERSIZE_MESSAGE } from '../../shared/utils/image-upload.util';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'app-brand-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule, RouterModule, ResetPasswordModalComponent, ChipSelectionGroupComponent, ProfileReviewSummaryComponent, RegistrationNoticeComponent, MobileBottomActionsComponent, ImageCropModalComponent],
  templateUrl: './brand-profile.component.html',
  styleUrls: ['./brand-profile.component.scss']
})
export class BrandProfileComponent implements OnInit {
  premiumMonthlyPrice = 999;
  commissionAccessTags: string[] = [];
  platformCommissionPercent: number = 0;
  firstRegisteredAt: string | null = null;
  lastLoginAt: string | null = null;
  profileVerificationDashboard: ProfileVerificationDashboard | null = null;
  profileVerificationLoading = false;

  private extractCommissionAccessTags(tags: unknown): string[] {
    const all = Array.isArray(tags) ? tags : [];
    const allowed = new Set(['early access', 'partner', 'internal/test', 'internal test']);
    return all
      .map((tag: any) => String(tag || '').trim())
      .filter((tag: string) => !!tag && allowed.has(tag.toLowerCase()));
  }
  premiumOriginalMonthlyPrice: number | null = null;
  premiumOfferChip = '';
  readonly currentYear = new Date().getFullYear();
  readonly brandFoundedYears: number[] = Array.from(
    { length: this.currentYear - 1899 },
    (_, index) => this.currentYear - index,
  );

      
  setChipValues(field: 'languages' | 'categories', values: string[]): void {
    if (!this.isEditMode) return;
    this.registrationForm.get(field)?.setValue(values);
    this.registrationForm.get(field)?.markAsTouched();
  }

  openBrandImageGuidelines(): void {
    this.guidelinesService.open('brand');
  }

  getTierOptionLabel(tier: any): string {
    const name = String(tier?.name || '').trim();
    const descFromApi = String(tier?.desc || '').trim();
    const desc = descFromApi || TIER_DESC_MAP[name.toLowerCase()] || '';
    if (!desc) return name;
    return `${name} (${desc})`;
  }

  constructor(
    public fb: FormBuilder,
    private configService: ConfigService,
    private otpService: OtpService,
    private plansService: PlansService,
    private cd: ChangeDetectorRef,
    private guidelinesService: ImageGuidelinesService,
    private toast: ToastService,
    private firebaseAuth: FirebaseAuthService,
    private profileVerification: ProfileVerificationService,
    private session: SessionService,
  ) {}

  private loadProfileVerificationDashboard(): void {
    this.profileVerificationLoading = true;
    this.profileVerification.getMyDashboard().subscribe({
      next: (dashboard) => {
        this.profileVerificationDashboard = dashboard;
        this.profileVerificationLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.profileVerificationDashboard = null;
        this.profileVerificationLoading = false;
      },
    });
  }

  private showValidationMessage(message: string): void {
    this.registrationError = message;
    this.toast.error(message);
    this.cd.detectChanges();
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
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
  phoneEditRequested: boolean = false;
  verificationCallNumber = '';

  emailVerified: boolean = false;
  emailEditRequested: boolean = false;
  showEmailVerificationPrompt: boolean = false;
  emailJustChanged: boolean = false;
  previousVerifiedEmail: string = '';
  pendingVerificationEmail: string = '';
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


  phoneOtpTimer: number = 300;
  canResendPhoneOtp: boolean = false;
  verifyingPhoneOtp: boolean = false;
  phoneOtpError: string = '';
  private phoneOtpInterval: any;
  private firebasePhoneConfirmation: any = null;

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
      this.firebasePhoneConfirmation = await this.firebaseAuth.sendPhoneOtp(phone, 'brand-phone-recaptcha');
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
  brandUsernameError: string = '';
  get brandLogoFormArray(): FormArray {
    return this.registrationForm.get('brandLogo') as FormArray;
  }
  isEditMode = false;
  originalFormValue: any = null;
  premiumStart: Date | null = null;
  premiumEnd: Date | null = null;
  readonly currentDate = new Date();
  showPayment = false;
  selectedDuration: '1m' | '3m' | '1y' | '' = '';
  paymentSuccess = false;
  paymentError = '';
  myPayments: any[] = [];
  latestPendingPayment: any = null;

  // Razorpay payments store `amount` in paise; manual UPI/QR payments store it in plain rupees.
  get latestPendingPaymentAmount(): number {
    const p = this.latestPendingPayment;
    if (!p) return 0;
    return p.paymentMethod === 'razorpay' ? (p.amount || 0) / 100 : (p.amount || 0);
  }
  registrationSuccess = false;
  registrationError = '';
  submitted = false;
  saving = false;
  registrationForm!: FormGroup;
  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];
  protected tierInfo = inject(TierInfoService);
  languagesList: any[] = [];
  categoriesList: any[] = [];
  readonly maxCategories = 5;
  isPremium = false;
  planCaps: PlanCapabilities = FREE_CAPABILITIES;
  showChangePasswordModal = false;

  // --- Social Media Platform UI ---
  platformForms: { [platformId: string]: any } = {};
  activePlatformTab: string | null = null;
  private originalPlatformForms: { [platformId: string]: any } = {};

  brandLogoPreview: string | null = null;
  brandLogoFile: { url: string, public_id: string } | null = null;
  productImagesPreview: (string | null)[] = [];
  productImagesFiles: ({ url: string, public_id: string } | null)[] = [];
  // ...existing code...

  get maxProductImagesAllowed(): number {
    const capValue = Number(this.plansService.getLimitValue(this.planCaps, 'maxProductImages'));
    if (Number.isFinite(capValue) && capValue > 0) return capValue;
    return this.isPremium ? 5 : 1;
  }

  get hasPremiumPlan(): boolean {
    return !!this.planCaps?.hasPremium;
  }

  openChangePasswordModal() {
    this.showChangePasswordModal = true;
  }

  // Getter for brandLogo FormArray
  cropModalOpen = false;
  cropSourceFile: File | null = null;
  private brandLogoInputEl: HTMLInputElement | null = null;

  onBrandLogoFileChange(event: any) {
    if (!this.isEditMode) return;
    this.brandLogoInputEl = event.target as HTMLInputElement;
    const file = this.brandLogoInputEl.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      this.showValidationMessage(validationError);
      return;
    }
    this.cropSourceFile = file;
    this.cropModalOpen = true;
  }

  onBrandLogoCropCancelled(): void {
    this.cropModalOpen = false;
    this.cropSourceFile = null;
    if (this.brandLogoInputEl) this.brandLogoInputEl.value = '';
  }

  // Handle brand logo crop confirmation: compress, upload, and preview
  async onBrandLogoCropped(file: File) {
    this.cropModalOpen = false;
    this.cropSourceFile = null;
    if (this.brandLogoInputEl) this.brandLogoInputEl.value = '';
    // Compress image before upload
    try {
      const compressedFile = await compressImageFile(file, 'profile');
      if (isOversizedAfterCompression(compressedFile)) {
        this.registrationError = OVERSIZE_MESSAGE;
        return;
      }
      // Upload via backend so local/prod handling stays centralized
      this.brandLogoPreview = null;
      this.brandLogoFile = null;
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('folder', `brands/${this.session.getUser()?.id}/logo`);
      const response = await fetch(`${environment.apiBaseUrl}/auth/upload-image`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        this.registrationError = 'Brand logo upload failed.';
        return;
      }
      const data = await response.json();
      const uploaded = data?.data || data;
      if (uploaded?.url && uploaded?.public_id) {
  this.brandLogoPreview = uploaded.url;
  this.brandLogoFile = { url: uploaded.url, public_id: uploaded.public_id };
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
    const validationError = validateImageFile(file);
    if (validationError) {
      this.showValidationMessage(validationError);
      return;
    }
    // Compress image before upload
    try {
      const compressedFile = await compressImageFile(file, 'gallery');
      if (isOversizedAfterCompression(compressedFile)) {
        this.showValidationMessage(OVERSIZE_MESSAGE);
        return;
      }
      // Upload via backend so local/prod handling stays centralized
      this.productImagesPreview[index] = null;
      this.productImagesFiles[index] = null;
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('type', 'products');
      const response = await fetch(`${environment.apiBaseUrl}/auth/upload-authenticated-image`, {
        method: 'POST',
        body: formData,
        headers: { Authorization: `Bearer ${this.session.getToken()}` },
      });
      if (!response.ok) {
        this.registrationError = 'Product image upload failed.';
        return;
      }
      const data = await response.json();
      const uploaded = data?.data || data;
      if (uploaded?.url && uploaded?.public_id) {
        this.productImagesPreview[index] = uploaded.url;
        this.productImagesFiles[index] = { url: uploaded.url, public_id: uploaded.public_id };
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
    this.brandLogoFormArray.push(this.fb.control(''));
  }

  removeBrandLogo(index: number) {
    if (this.brandLogoFormArray.length > 1) {
      this.brandLogoFormArray.removeAt(index);
    }
  }

  ngOnInit() {
    this.loadProfileVerificationDashboard();
    this.loadPremiumMonthlyPrice();
    this.plansService.getMyCapabilities().subscribe((caps) => {
      this.planCaps = caps;
      this.isPremium = !!caps?.hasPremium;
      this.cd.detectChanges();
    });
    this.configService.getSupportContact().subscribe(s => {
      this.verificationCallNumber = s.verificationCallNumber || '';
    });
    this.configService.getAppSettings().subscribe(s => {
      if (typeof s.brandFeePercent === 'number') this.platformCommissionPercent = s.brandFeePercent;
    });

    // ngOnInit called

    this.registrationForm = this.fb.group({
      brandName: ['', Validators.required],
      contactPersonName: ['', Validators.required],
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
        district: ['', Validators.required],
        googleMapLink: ['']
      }),
      categories: [[], Validators.required],
      languages: [[], Validators.required],
      website: [''],
      foundedYear: [''],
      companySize: [''],
      googleMapAddress: [''],
      description: ['', Validators.required],
      brandLogo: this.fb.array([]),
      products: this.fb.array([]),
      productImages: this.fb.array([]),
      contact: this.fb.group({
        whatsapp: [false],
        email: [false],
        call: [false]
      }, { validators: [atLeastOneContactRequired] }),
      payout: this.fb.group({
        upiId: [''],
        mobile: [''],
        accountHolderName: [''],
      }),
    });

    // Username input sanitization
    this.registrationForm.get('brandUsername')?.valueChanges.subscribe(() => this.onBrandUsernameInput());
    this.registrationForm.valueChanges.subscribe(() => this.refreshStepCompletion());
    this.registrationForm.statusChanges.subscribe(() => this.refreshStepCompletion());

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
      categories: this.configService.getCategories('brand')
    }).subscribe({
      next: (dropdownData) => {
        this.states = dropdownData.states || [];
        const tierRows = Array.isArray(dropdownData.tiers) ? dropdownData.tiers : [];
        this.tiers = tierRows;
        this.socialMediaList = dropdownData.socialMedia || [];
        this.languagesList = dropdownData.languages || [];
        this.categoriesList = dropdownData.categories || [];

        const token = this.getToken();
        if (token) {
          this.configService.getBrandProfileById().subscribe({
        next: (profile: any) => {
          if (!profile) {
            this.registrationError = 'Profile not found or you are not logged in.';
            return;
          }

          this.emailVerified = !!profile?.isEmailVerified;
          this.phoneVerified = !!profile?.isMobileVerified;
          this.commissionAccessTags = this.extractCommissionAccessTags(profile?.adminTags);
          this.firstRegisteredAt = profile?.firstRegisteredAt || profile?.createdAt || null;
          this.lastLoginAt = profile?.lastLoginAt || null;
          this.showEmailVerificationPrompt = !this.emailVerified;
          this.cd.detectChanges();

          const stateId = this.states.find(s => s.name === profile.location?.state)?.['_id'] || '';
          const languageIds = (profile.languages || []).map((name: string) =>
            this.languagesList.find((l: any) => l.name === name)?._id
          ).filter(Boolean);
          // Robust category mapping with fallback and warning
          const categoryIds = (profile.categories || []).map((name: string) => {
            const found = this.categoriesList.find((c: any) => c.name === name);
            if (!found) {
              console.warn('[Profile] Category not found in list:', name);
              return null;
            }
            return found._id;
          }).filter(Boolean);
          const resolvedBrandUsername =
            profile.brandUsername ||
            profile.username ||
            (profile.brandName
              ? String(profile.brandName)
                  .trim()
                  .replace(/\s+/g, '-')
                  .replace(/[^a-zA-Z0-9_-]/g, '')
              : '');
          const doPatchBrandForm = (districtId: string) => {
            this.registrationForm.patchValue({
              brandName: profile.brandName || '',
              contactPersonName: profile.contactPersonName || '',
              brandUsername: resolvedBrandUsername,
              email: profile.email || '',
            phoneNumber: profile.phoneNumber || '',
            isPremium: !!profile.isPremium,
            paymentOption: profile.isPremium ? 'premium' : 'free',
              location: {
                state: stateId,
                district: districtId,
                googleMapLink: profile.location?.googleMapLink || ''
              },
            categories: categoryIds,
            languages: languageIds,
            website: profile.website || '',
            foundedYear: profile.foundedYear || '',
            companySize: profile.companySize || '',
            googleMapAddress: profile.googleMapAddress || profile.location?.googleMapLink || '',
            description: profile.description || '',
            contact: profile.contact || { whatsapp: false, email: false, call: false },
            payout: {
              upiId: profile.payout?.upiId || '',
              mobile: profile.payout?.mobile || profile.phoneNumber || '',
              accountHolderName: profile.payout?.accountHolderName || profile.brandName || '',
            }
            }, { emitEvent: false });

          const logoArr = this.registrationForm.get('brandLogo') as FormArray;
          logoArr.clear();
          (profile.brandLogo || []).forEach((img: any) => logoArr.push(this.fb.group({
            url: img.url,
            public_id: img.public_id
          })));
          this.brandLogoPreview = (profile.brandLogo && profile.brandLogo[0]?.url) || null;
          // Do not set brandLogoFile to the remote image object — only File objects should be used for upload
          this.brandLogoFile = null;

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

          this.platformForms = {};
          (profile.socialMedia || []).forEach((sm: any) => {
            const platformObj = this.socialMediaList.find((s: any) => s.name === sm.platform);
            if (!platformObj) return;
            this.platformForms[platformObj._id] = {
              handle: sm.handle || '',
              followersCount: sm.followersCount || '',
              tier: sm.tier || '',
              contentTypes: Object.fromEntries(
                (platformObj.contentTypes || []).map((ct: any) => {
                  const existing = (sm.contentTypes || []).find((c: any) => c.name === ct.name);
                  return [ct.name, { selected: !!existing, price: existing?.price || '' }];
                })
              )
            };
          });
          const pfKeys = Object.keys(this.platformForms);
          this.activePlatformTab = pfKeys.length ? pfKeys[0] : null;
          this.originalPlatformForms = JSON.parse(JSON.stringify(this.platformForms));

          this.originalFormValue = this.registrationForm.getRawValue();
          this.premiumStart = profile.premiumStart ? new Date(profile.premiumStart) : null;
          this.premiumEnd = profile.premiumEnd ? new Date(profile.premiumEnd) : null;
          // Load payment status
          this.configService.getMyPayments(5).subscribe(payments => {
            this.myPayments = payments;
            // Razorpay is auto-verified via webhook, never reviewed by an admin — a 'pending'
            // razorpay record only means checkout was abandoned/cancelled, not awaiting review.
            this.latestPendingPayment = payments.find((p: any) => p.status === 'pending' && p.paymentMethod !== 'razorpay') || null;
          });
          this.registrationForm.disable({ emitEvent: false });
          this.refreshStepCompletion();
          this.cd.detectChanges();
          };
          // Load districts for the saved state, then patch form
          if (profile.location?.state) {
            // prefer the resolved stateId when available
            this.configService.getDistricts(profile.location.state, stateId).subscribe({
              next: (dists) => {
                this.districts = Array.isArray(dists) ? dists : [];
                const savedDistrict = (profile.location?.district || '').toString().trim();
                let resolvedDistrict: any = null;
                if (savedDistrict) {
                  const lower = savedDistrict.toLowerCase();
                  resolvedDistrict =
                    this.districts.find((d: any) => d._id === savedDistrict) ||
                    this.districts.find((d: any) => (d.name || '').toString().trim().toLowerCase() === lower) ||
                    null;
                }
                const districtId = resolvedDistrict ? resolvedDistrict._id : '';
                if (!districtId && savedDistrict) {
                  console.warn('[Profile] District not found in list:', savedDistrict, 'available:', this.districts.map((d: any) => d.name));
                }
                doPatchBrandForm(districtId);
              },
              error: () => doPatchBrandForm('')
            });
          } else {
            doPatchBrandForm('');
          }
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
    const bonusMonths = this.getPlanDiscountPercent(plan, ['bonusMonthsMonthly']);
    const bonusSuffix = bonusMonths > 0 ? ` · +${bonusMonths} mo free` : '';
    if (plan?.discountLabel) return plan.discountLabel + bonusSuffix;
    if (discountPercent > 0) return `Founding member pricing · Save ${discountPercent}%${bonusSuffix}`;
    if (bonusMonths > 0) return `Pay 1 month, get ${1 + bonusMonths} months`;
    const hasTrialOffer = Array.isArray(plan?.offers)
      && plan.offers.some((item) => item.key === 'trialPeriodDays' && Number(item.value) > 0);
    return hasTrialOffer ? 'Early Access Offer' : '';
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

      // Helper to map district ID to name safely for template
      getDistrictName(districtId: string): string {
        if (!this.districts) return districtId;
        const found = this.districts.find((d: any) => d._id === districtId);
        return found ? found.name : districtId;
      }

  enableEdit(): void {
    this.isEditMode = true;
    this.registrationForm.enable({ emitEvent: false });
    this.emailEditRequested = !this.emailVerified;
    this.refreshStepCompletion();
    this.cd.detectChanges();
    this.ensureDistrictsForCurrentState();
  // Password fields are disabled and removed from the form
  }

  // Ensure districts are loaded when entering edit mode so dropdown shows correct options
  private ensureDistrictsForCurrentState(): void {
    const stateVal = this.registrationForm.get('location.state')?.value;
    if (!stateVal) return;
    const selectedState = this.states.find((s: any) => s._id === stateVal || s.id === stateVal || s.name === stateVal);
    const stateName = selectedState?.name || (typeof stateVal === 'string' ? stateVal : '');
    const stateId = selectedState?._id || selectedState?.id || (typeof stateVal === 'string' ? stateVal : '');
    this.configService.getDistricts(stateName, stateId).subscribe({
      next: d => { this.districts = Array.isArray(d) ? d : []; this.cd.detectChanges(); },
      error: () => { this.districts = []; this.cd.detectChanges(); }
    });
  }

  cancelEdit(): void {
    this.isEditMode = false;
    this.emailEditRequested = false;
    if (this.originalFormValue) {
      this.registrationForm.reset(this.originalFormValue, { emitEvent: false });
    }
    this.platformForms = JSON.parse(JSON.stringify(this.originalPlatformForms));
    const pfKeys = Object.keys(this.platformForms);
    this.activePlatformTab = pfKeys.length ? pfKeys[0] : null;
    this.registrationForm.disable({ emitEvent: false });
    this.registrationForm.get('password')?.disable();
    this.registrationForm.get('confirmPassword')?.disable();
    this.refreshStepCompletion();
    // restore districts for the original state so view mode shows names
    const origState = this.originalFormValue?.location?.state;
    if (origState) {
      const selectedState = this.states.find((s: any) => s._id === origState || s.id === origState || s.name === origState);
      const stateName = selectedState?.name || (typeof origState === 'string' ? origState : '');
      const stateId = selectedState?._id || selectedState?.id || (typeof origState === 'string' ? origState : '');
      this.configService.getDistricts(stateName, stateId).subscribe({ next: d => { this.districts = Array.isArray(d) ? d : []; this.cd.detectChanges(); }, error: () => { this.districts = []; } });
    }
  }

  payAndUpgrade() {
    this.paymentError = '';
    this.paymentSuccess = false;
    const duration = this.selectedDuration;
    if (!duration) {
      this.paymentError = 'Please select a premium duration.';
      setTimeout(() => {
        this.showPayment = false;
        this.paymentError = '';
      }, 1200);
      return;
    }
    const token = this.getToken();
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
        this.configService.setPremiumForUser(profile._id, true, duration).subscribe({
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

  /** Selected platforms missing handle or tier. */
  invalidPlatforms(): any[] {
    return this.selectedPlatforms().filter(p => {
      const pf = this.platformForms[p._id];
      return !pf || !!this.getSocialHandleError(p) || !(pf.tier || '').trim();
    });
  }

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
    return buildSocialProfileUrl(platformName, handle);
  }

  stripAtSign(platformId: string) {
    const pf = this.platformForms[platformId];
    if (!pf) return;
    pf.handle = normalizeSocialHandle(pf.handle, this.getPlatformById(platformId)?.name || '');
  }

  getSocialHandleExample(platformName: string): string {
    return socialHandleExample(platformName);
  }

  getSocialHandleError(platform: any): string {
    const pf = this.platformForms[platform?._id];
    if (!pf) return 'Username is required.';
    return validateSocialHandle(pf.handle, platform?.name || '') || '';
  }

  get productImagesFormArray(): FormArray {
    return this.registrationForm.get('productImages') as FormArray;
  }

  addProductImage() {
    if (this.productImagesFormArray.length < this.maxProductImagesAllowed) {
      this.productImagesFormArray.push(this.fb.control('', Validators.required));
    }
  }

  removeProductImage(index: number) {
    this.productImagesFormArray.removeAt(index);
    this.refreshStepCompletion();
  }

  private hasBrandLogo(): boolean {
    const logo = this.brandLogoFormArray.at(0)?.value;
    return !!(
      this.brandLogoPreview ||
      (logo && typeof logo === 'object' && 'url' in logo && logo.url)
    );
  }

  private computeStepComplete(step: number): boolean {
    if (step === 1) {
      return !!(
        this.registrationForm.get('brandName')?.valid &&
        this.registrationForm.get('contactPersonName')?.valid &&
        this.registrationForm.get('brandUsername')?.valid &&
        this.registrationForm.get('email')?.valid &&
        this.registrationForm.get('phoneNumber')?.valid &&
        this.registrationForm.get('categories')?.valid &&
        this.registrationForm.get('description')?.valid &&
        this.hasBrandLogo()
      );
    }

    if (step === 2) {
      return !!(
        this.registrationForm.get('location.state')?.valid &&
        this.registrationForm.get('location.district')?.valid &&
        this.registrationForm.get('languages')?.valid &&
        true /* social media optional */
      );
    }

    if (step === 3) {
      return !!(
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
      const fields = ['brandName', 'contactPersonName', 'brandUsername', 'email', 'phoneNumber', 'categories', 'description'];
      fields.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      return fields.every((path) => this.registrationForm.get(path)?.valid) && this.hasBrandLogo();
    }

    if (this.currentStep === 2) {
      this.step2Attempted = true;
      const required = ['location.state', 'location.district', 'languages'];
      required.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      return required.every((path) => this.registrationForm.get(path)?.valid);
    }

    if (this.currentStep === 3) {
      this.registrationForm.get('contact')?.markAsTouched();
      return !!this.registrationForm.get('contact')?.valid;
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

  async onSubmit() {
    if (this.saving) {
      return;
    }

    this.submitted = true;
    this.cd.detectChanges();
    if (!this.isEditMode || this.registrationForm.invalid || !this.hasBrandLogo()) {
      if (!this.hasBrandLogo()) {
        this.registrationError = 'Brand logo is required.';
      } else if (this.registrationForm.invalid) {
        this.registrationForm.markAllAsTouched();
        this.registrationError = 'Please complete all required fields before saving.';
        if (!this.computeStepComplete(1)) this.currentStep = 1;
        else if (!this.computeStepComplete(2)) this.currentStep = 2;
        else if (!this.computeStepComplete(3)) this.currentStep = 3;
      }
      this.cd.detectChanges();
      return;
    }
    if (!this.arePlatformsValid()) {
      // Inline error already rendered in template.
      this.registrationError = '';
      return;
    }
    this.registrationError = '';
    this.registrationSuccess = false;
    this.saving = true;
    this.cd.detectChanges();
    const raw = this.registrationForm.getRawValue();
    const previousEmail = String(this.originalFormValue?.email || '').trim().toLowerCase();
    const currentEmail = String(raw?.email || '').trim().toLowerCase();
    const emailChanged = !!currentEmail && previousEmail !== currentEmail;
    const previousEmailWasVerified = this.emailVerified;
    const previousPhone = String(this.originalFormValue?.phoneNumber || '').trim();
    const currentPhone = String(raw?.phoneNumber || '').trim();
    const phoneChanged = !!currentPhone && previousPhone !== currentPhone;
    // Map state ID to name
    const stateObj = this.states.find(s => s._id === raw.location.state);
    let districtObj = this.districts.find(d => d._id === raw.location.district);
    // If districts not loaded or districtObj not found, try fetching districts for the state and resolve by id
    if (!districtObj && raw.location?.district) {
      try {
        const selectedState = this.states.find((s: any) => s._id === raw.location.state || s.id === raw.location.state || s.name === raw.location.state);
        const stateNameForLookup = selectedState?.name || (typeof raw.location.state === 'string' ? raw.location.state : '');
        const stateIdForLookup = selectedState?._id || selectedState?.id || (typeof raw.location.state === 'string' ? raw.location.state : '');
        const dists = await firstValueFrom(this.configService.getDistricts(stateNameForLookup, stateIdForLookup).pipe(catchError(() => of([]))));
        this.districts = Array.isArray(dists) ? dists : [];
        districtObj = this.districts.find((d: any) => d._id === raw.location.district) || undefined;
      } catch (err) {
        // ignore and proceed — we'll send raw value if we can't resolve
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
    const socialMedia = this.selectedPlatforms().map((platform: any) => {
      const pf = this.platformForms[platform._id];
      return {
        platform: platform.name,
        handle: normalizeSocialHandle(pf.handle, platform.name),
        followersCount: Number(pf.followersCount) || 0,
        tier: pf.tier,
        contentTypes: Object.keys(pf.contentTypes)
          .filter(ctName => pf.contentTypes[ctName].selected)
          .map(ctName => ({ name: ctName }))
      };
    });
    // Handle Cloudinary upload for brand logo if file selected
    // Only send image objects from file input handlers
    const products = this.productImagesFiles.filter((img): img is { url: string, public_id: string } => !!img && typeof img === 'object' && 'url' in img && 'public_id' in img);
    const brandLogoObjs = this.brandLogoFile ? [this.brandLogoFile] : [];
    const location = {
      state: stateObj ? stateObj.name : raw.location.state,
      district: districtObj ? districtObj.name : raw.location.district,
      googleMapLink: raw.googleMapAddress || raw.location.googleMapLink || undefined
    };
    const payload: any = {
  ...raw,
  foundedYear: raw.foundedYear ? Number(raw.foundedYear) : undefined,
  location,
  languages: languageNames,
  categories: categoryNames,
  socialMedia,
  brandLogo: brandLogoObjs.length > 0 ? brandLogoObjs : (raw.brandLogo || []),
  products: products.length > 0 ? products : (raw.products || []),
  contact: raw.contact
    };
    // Remove fields not in DTO; never allow profile save to set isPremium — payment-gated
    delete payload.password;
    delete payload.confirmPassword;
    delete payload.paymentOption;
    delete payload.isPremium;
    delete payload.premiumEnd;
    delete payload.premiumStart;
    delete payload.premiumDuration;
    delete payload.productImages;
    delete payload.googleMapAddress;
    this.configService.updateBrandProfile(payload).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.registrationSuccess = true;
        this.isEditMode = false;
        this.registrationForm.disable({ emitEvent: false });
        this.registrationForm.get('password')?.disable();
        this.registrationForm.get('confirmPassword')?.disable();
        this.originalFormValue = this.registrationForm.getRawValue();
        this.originalPlatformForms = JSON.parse(JSON.stringify(this.platformForms));
        this.cd.detectChanges();
        const serverUser = res?.user;
        if (emailChanged) {
          // Server may have auto-verified the new email (local dev bypass) —
          // trust its returned state instead of assuming it's pending.
          this.emailVerified = !!serverUser?.isEmailVerified;
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
        this.submitted = false;
        // Ensure districts loaded for the saved state so the view shows district name
        const stateVal = this.registrationForm.get('location.state')?.value;
        if (stateVal) {
          const selectedState = this.states.find((s: any) => s._id === stateVal || s.id === stateVal || s.name === stateVal);
          const stateName = selectedState?.name || (typeof stateVal === 'string' ? stateVal : '');
          const stateId = selectedState?._id || selectedState?.id || (typeof stateVal === 'string' ? stateVal : '');
          this.configService.getDistricts(stateName, stateId).subscribe({ next: d => { this.districts = Array.isArray(d) ? d : []; this.cd.detectChanges(); }, error: () => { this.districts = []; } });
        }
      },
      error: err => {
        this.saving = false;
        this.registrationError = 'Update failed. Please try again.';
        this.submitted = false;
        this.cd.detectChanges();
      }
    });
  }

  requestEmailEdit(): void {
    if (!this.isEditMode) return;
    if (
      this.emailVerified &&
      !window.confirm(
        'Your email is currently verified. Changing it will mark it as unverified, and some features may be restricted until you verify the new address. Continue?',
      )
    ) {
      return;
    }
    this.emailEditRequested = true;
  }

  requestPhoneEdit(): void {
    if (!this.isEditMode) return;
    if (
      this.phoneVerified &&
      !window.confirm(
        'Your mobile number is currently verified. Changing it will mark it as unverified, and you will need to re-verify the new number before some features are available again. Continue?',
      )
    ) {
      return;
    }
    this.phoneEditRequested = true;
  }

}
