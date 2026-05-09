import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
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
import { ResetPasswordModalComponent } from '../../shared/components/reset-password-modal/reset-password-modal.component';
import imageCompression from 'browser-image-compression';
import { PlansService, PlanCapabilities, FREE_CAPABILITIES } from '../../shared/plans.service';

@Component({
  selector: 'app-influencer-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule, RouterModule, ResetPasswordModalComponent],
  templateUrl: './influencer-profile.component.html',
  styleUrls: ['./influencer-profile.component.scss']
})
export class InfluencerProfileComponent implements OnInit {
  premiumMonthlyPrice = 399;

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

  // --- New Social Media Platform UI ---
  constructor(
    public fb: FormBuilder,
    private configService: ConfigService,
    private otpService: OtpService,
    private plansService: PlansService,
    private cd: ChangeDetectorRef
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
      return !pf || !(pf.handle || '').trim() || !(pf.tier || '').trim();
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

  phoneOtpTimer: number = 300;
  canResendPhoneOtp: boolean = false;
  verifyingPhoneOtp: boolean = false;
  phoneOtpError: string = '';
  private phoneOtpInterval: any;


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
  get currentImageCount(): number { return this.profileImagesFormArray?.length ?? 0; }
  get imageUploadAllowed(): boolean { return this.currentImageCount < this.maxImages; }
  registrationSuccess = false;
  registrationError = '';
  registrationSuccessMessage = '';
  registrationForm!: FormGroup;
  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];
  protected tierInfo = inject(TierInfoService);
  profileImagePreview: string | null = null;
  profileImageFile: File | null = null;
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
      paymentOption: [{ value: 'free', disabled: true }, Validators.required],
      location: this.fb.group({
        state: [{ value: '', disabled: true }, Validators.required],
        district: [{ value: '', disabled: true }, Validators.required]
      }),
      promotionalPrice: [{ value: '', disabled: true }, Validators.required],
      languages: [{ value: [], disabled: true }, Validators.required],
      categories: [{ value: [], disabled: true }, Validators.required],
      profileImages: this.fb.array([]),
      contact: this.fb.group({
        whatsapp: [{ value: false, disabled: true }],
        email: [{ value: false, disabled: true }],
        call: [{ value: false, disabled: true }]
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
      categories: this.configService.getCategories()
    }).subscribe({
      next: (dropdownData) => {
        this.states = dropdownData.states || [];
        const tierRows = Array.isArray(dropdownData.tiers) ? dropdownData.tiers : [];
        this.tiers = tierRows;
        this.socialMediaList = dropdownData.socialMedia || [];
        this.languagesList = dropdownData.languages || [];
        this.categoriesList = dropdownData.categories || [];

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
          // Load districts for the state, then patch form
            const patchForm = (districtId: string) => {
            this.registrationForm.patchValue({
              name: profile.name || '',
              username: profile.username || '',
              phoneNumber: profile.phoneNumber || '',
              email: profile.email || '',
              paymentOption: profile.isPremium ? 'premium' : 'free',
              location: { state: stateId, district: districtId },
              promotionalPrice: profile.promotionalPrice || '',
              languages: languageIds,
            categories: categoryIds,
            contact: profile.contact || { whatsapp: false, email: false, call: false },
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
          // Show first image as preview on load (normalize backend-local asset paths)
          this.profileImagePreview = (profile.profileImages && profile.profileImages[0]?.url) ? this.normalizeImageUrl(profile.profileImages[0].url) : null;
          // Do not set profileImageFile to the remote image object — only File objects should be used for upload
          this.profileImageFile = null;
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
      if (paidPlan?.price?.monthly) {
        this.premiumMonthlyPrice = paidPlan.price.monthly;
      }
    });
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
        this.hasExistingProfileImage()
      );
    }

    if (step === 2) {
      return !!(
        this.registrationForm.get('paymentOption')?.valid &&
        this.registrationForm.get('location.state')?.valid &&
        this.registrationForm.get('location.district')?.valid &&
        this.registrationForm.get('languages')?.valid &&
        this.registrationForm.get('categories')?.valid &&
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
      const fields = ['name', 'username', 'phoneNumber', 'email'];
      fields.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      const fieldsValid = fields.every((path) => this.registrationForm.get(path)?.valid);
      return fieldsValid && this.hasExistingProfileImage();
    }

    if (this.currentStep === 2) {
      this.step2Attempted = true;
      const required = ['paymentOption', 'location.state', 'location.district', 'languages', 'categories'];
      required.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      return required.every((path) => this.registrationForm.get(path)?.valid) && this.selectedPlatforms().length > 0;
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
  // Enable username for editing
  this.registrationForm.get('username')?.enable({ emitEvent: false });
  // Keep password fields disabled for security
  this.registrationForm.get('password')?.disable();
  this.registrationForm.get('confirmPassword')?.disable();
  this.refreshStepCompletion();
  }

  cancelEdit(): void {
    this.isEditMode = false;
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


  // Helper to map category ID to name safely for template
    getCategoryName(catId: string): string {
      if (!this.categoriesList) return catId;
      const found = this.categoriesList.find((c: any) => c._id === catId);
      return found ? found.name : catId;
    }

    // Helper to map language ID to name safely for template
    getLanguageName(langId: string): string {
      if (!this.languagesList) return langId;
      const found = this.languagesList.find((l: any) => l._id === langId);
      return found ? found.name : langId;
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


  // Only allow 1 image for now (can extend for premium)
  async onProfileImageFileChange(event: any) {
    if (!this.isEditMode) return;
    this.profileImagePreview = null;
    this.profileImageFile = null;
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    const validation = this.isValidImageFile(file, this.MAX_IMAGE_SIZE_MB);
    if (!validation.valid) {
      alert(validation.reason || 'Please select a valid image file.');
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
      this.profileImageFile = compressedFile;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profileImagePreview = e.target.result;
        this.refreshStepCompletion();
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      alert('Image compression failed.');
      return;
    }
  }

  removeProfileImage(index: number) {
    if (!this.isEditMode) return;
    this.profileImagesFormArray?.removeAt(index);
    this.refreshStepCompletion();
  }



  async onSubmit() {
    if (!this.isEditMode || this.registrationForm.invalid || (!this.profileImagePreview && (!this.profileImagesFormArray.controls.length || !this.profileImagesFormArray.at(0).value || !this.profileImagesFormArray.at(0).value.url))) {
      if (!this.profileImagePreview && (!this.profileImagesFormArray.controls.length || !this.profileImagesFormArray.at(0).value || !this.profileImagesFormArray.at(0).value.url)) {
        this.registrationError = 'Profile image is required.';
      }
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
    // Build social media from platformForms
    const socialMedia = this.selectedPlatforms().map(platform => {
      const pf = this.platformForms[platform._id];
      return {
        platform: platform.name,
        handle: pf.handle,
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
      if (!(this.profileImageFile instanceof File)) {
        this.registrationError = 'Invalid profile image file.';
        return;
      }
      try {
        const formData = new FormData();
        formData.append('file', this.profileImageFile);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (data.secure_url && data.public_id) {
          // Always include all images present in the FormArray (old image)
          profileImages = [
            ...raw.profileImages.filter((img: any) => img && typeof img === 'object' && 'url' in img && 'public_id' in img),
            { url: data.secure_url, public_id: data.public_id }
          ];
        } else {
          this.registrationError = 'Profile image upload failed.';
          return;
        }
      } catch (err) {
        this.registrationError = 'Profile image upload failed.';
        return;
      }
    } else if (raw.profileImages && Array.isArray(raw.profileImages) && raw.profileImages.length > 0) {
      // If editing and image already exists, just send it as-is
      profileImages = raw.profileImages.filter((img: any) => img && typeof img === 'object' && 'url' in img && 'public_id' in img);
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
    // debug: payload prepared for PATCH
    const token = this.getToken();
    this.configService.updateInfluencerProfile(payload).subscribe({
      next: (res: any) => {
        // debug: PATCH response received
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
        this.fetchAndPatchProfile().catch(() => {});
      },
      error: err => {
        this.registrationSuccessMessage = '';
        this.registrationError = 'Update failed. Please try again.';
        console.error('[PATCH error]', err);
      }
    });
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
            this.showEmailVerificationPrompt = !this.emailVerified;
            const stateId = (this.states || []).find((s: any) => s.name === profile.location?.state)?.['_id'] || '';
            const languageIds = (profile.languages || []).map((name: string) =>
              (this.languagesList || []).find((l: any) => l.name === name)?._id
            ).filter(Boolean);
            const categoryIds = (profile.categories || []).map((name: string) =>
              (this.categoriesList || []).find((c: any) => c.name === name)?._id
            ).filter(Boolean);
            const doPatch = (districtId: string) => {
              this.registrationForm.patchValue({
                name: profile.name || '',
                username: profile.username || '',
                phoneNumber: profile.phoneNumber || '',
                email: profile.email || '',
                paymentOption: profile.isPremium ? 'premium' : 'free',
                location: { state: stateId, district: districtId },
                languages: languageIds,
                categories: categoryIds,
                contact: profile.contact || { whatsapp: false, email: false, call: false },
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
}

