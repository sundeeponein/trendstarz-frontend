
import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import imageCompression from 'browser-image-compression';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AsyncValidatorFn, AbstractControl } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { PlansService } from '../../shared/plans.service';
import { map, first, catchError } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';
import { OtpService } from '../../shared/otp.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { RouterModule } from '@angular/router';
import { TierInfoModalComponent } from '../../shared/components/tier-info-modal/tier-info-modal.component';

@Component({
  selector: 'app-brand-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule, RouterModule, TierInfoModalComponent],
  templateUrl: './brand-profile.component.html',
  styleUrls: ['./brand-profile.component.scss']
})
export class BrandProfileComponent implements OnInit {
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

  constructor(
    public fb: FormBuilder,
    private configService: ConfigService,
    private otpService: OtpService,
    private plansService: PlansService,
    private cd: ChangeDetectorRef
  ) {}

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
  registrationSuccess = false;
  registrationError = '';
  submitted = false;
  registrationForm!: FormGroup;
  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];
  showTierInfoModal = false;
  languagesList: any[] = [];
  categoriesList: any[] = [];
  isPremium = false;

  // --- Social Media Platform UI ---
  platformForms: { [platformId: string]: any } = {};
  activePlatformTab: string | null = null;
  private originalPlatformForms: { [platformId: string]: any } = {};

  brandLogoPreview: string | null = null;
  brandLogoFile: { url: string, public_id: string } | null = null;
  productImagesPreview: (string | null)[] = [];
  productImagesFiles: ({ url: string, public_id: string } | null)[] = [];
  // ...existing code...

  // Getter for brandLogo FormArray
  // Handle brand logo file selection, compress, upload, and preview
  async onBrandLogoFileChange(event: any) {
    if (!this.isEditMode) return;
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be below 2MB.');
      return;
    }
    // Compress image before upload
    const options = {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };
    try {
      const compressedFile = await imageCompression(file, options);
      // Upload to Cloudinary
      this.brandLogoPreview = null;
      this.brandLogoFile = null;
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.secure_url && data.public_id) {
  this.brandLogoPreview = data.secure_url;
  this.brandLogoFile = { url: data.secure_url, public_id: data.public_id };
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
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be below 2MB.');
      return;
    }
    // Compress image before upload
    const options = {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };
    try {
      const compressedFile = await imageCompression(file, options);
      // Upload to Cloudinary
      this.productImagesPreview[index] = null;
      this.productImagesFiles[index] = null;
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.secure_url && data.public_id) {
        this.productImagesPreview[index] = data.secure_url;
        this.productImagesFiles[index] = { url: data.secure_url, public_id: data.public_id };
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
    console.log('BrandProfileComponent ngOnInit called');

    this.registrationForm = this.fb.group({
      brandName: ['', Validators.required],
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
      googleMapAddress: [''],
      brandLogo: this.fb.array([]),
      products: this.fb.array([]),
      productImages: this.fb.array([]),
      contact: this.fb.group({
        whatsapp: [false],
        email: [false],
        call: [false]
      }),
    });

    // Username input sanitization
    this.registrationForm.get('brandUsername')?.valueChanges.subscribe(() => this.onBrandUsernameInput());
    this.registrationForm.valueChanges.subscribe(() => this.refreshStepCompletion());
    this.registrationForm.statusChanges.subscribe(() => this.refreshStepCompletion());

    // Load districts when state changes
    this.registrationForm.get('location.state')?.valueChanges.subscribe(stateId => {
      this.registrationForm.get('location.district')?.setValue('');
      this.districts = [];
      if (stateId) {
        const stateObj = this.states.find(s => s._id === stateId);
        const stateName = stateObj ? stateObj.name : '';
        if (stateName) {
          this.configService.getDistricts(stateName).subscribe(data => this.districts = data);
        }
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
        this.tiers = dropdownData.tiers || [];
        this.socialMediaList = dropdownData.socialMedia || [];
        this.languagesList = dropdownData.languages || [];
        this.categoriesList = dropdownData.categories || [];

        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (token) {
          this.configService.getBrandProfileById().subscribe({
        next: (profile: any) => {
          if (!profile) {
            this.registrationError = 'Profile not found or you are not logged in.';
            return;
          }

          this.emailVerified = !!profile?.isEmailVerified;
          this.showEmailVerificationPrompt = !this.emailVerified;
          this.cd.detectChanges();

          const stateId = this.states.find(s => s.name === profile.location?.state)?.['_id'] || '';
          const languageIds = (profile.languages || []).map((name: string) =>
            this.languagesList.find((l: any) => l.name === name)?._id
          ).filter(Boolean);
          const categoryIds = (profile.categories || []).map((name: string) =>
            this.categoriesList.find((c: any) => c.name === name)?._id
          ).filter(Boolean);
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
            googleMapAddress: profile.googleMapAddress || profile.location?.googleMapLink || '',
            contact: profile.contact || { whatsapp: false, email: false, call: false }
          });

          const logoArr = this.registrationForm.get('brandLogo') as FormArray;
          logoArr.clear();
          (profile.brandLogo || []).forEach((img: any) => logoArr.push(this.fb.group({
            url: img.url,
            public_id: img.public_id
          })));
          this.brandLogoPreview = (profile.brandLogo && profile.brandLogo[0]?.url) || null;
          this.brandLogoFile = (profile.brandLogo && profile.brandLogo[0]) || null;

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
            this.latestPendingPayment = payments.find((p: any) => p.status === 'pending') || null;
          });
          this.registrationForm.disable();
          this.refreshStepCompletion();
          this.cd.detectChanges();
          };
          // Load districts for the saved state, then patch form
          if (profile.location?.state) {
            this.configService.getDistricts(profile.location.state).subscribe({
              next: (dists) => {
                this.districts = dists;
                const districtId = dists.find((d: any) => d.name === profile.location?.district)?._id || '';
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

  enableEdit(): void {
    this.isEditMode = true;
    this.registrationForm.enable();
    this.refreshStepCompletion();
  // Password fields are disabled and removed from the form
  }

  cancelEdit(): void {
    this.isEditMode = false;
    if (this.originalFormValue) {
      this.registrationForm.reset(this.originalFormValue);
    }
    this.platformForms = JSON.parse(JSON.stringify(this.originalPlatformForms));
    const pfKeys = Object.keys(this.platformForms);
    this.activePlatformTab = pfKeys.length ? pfKeys[0] : null;
    this.registrationForm.disable();
    this.registrationForm.get('password')?.disable();
    this.registrationForm.get('confirmPassword')?.disable();
    this.refreshStepCompletion();
  }

  payAndUpgrade() {
    this.paymentError = '';
    this.paymentSuccess = false;
    if (!this.selectedDuration) {
      this.paymentError = 'Please select a premium duration.';
      setTimeout(() => {
        this.showPayment = false;
        this.paymentError = '';
      }, 1200);
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
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
        const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        this.configService['http'].patch(
          `${this.configService['apiUrl']}/users/${profile._id}/premium`,
          { isPremium: true, premiumDuration: this.selectedDuration },
          headers
        ).subscribe({
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

  get productImagesFormArray(): FormArray {
    return this.registrationForm.get('productImages') as FormArray;
  }

  addProductImage() {
    const maxImages = this.isPremium ? 5 : 1;
    if (this.productImagesFormArray.length < maxImages) {
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
        this.registrationForm.get('brandUsername')?.valid &&
        this.registrationForm.get('email')?.valid &&
        this.registrationForm.get('phoneNumber')?.valid &&
        this.hasBrandLogo()
      );
    }

    if (step === 2) {
      return !!(
        this.registrationForm.get('paymentOption')?.valid &&
        this.registrationForm.get('location.state')?.valid &&
        this.registrationForm.get('location.district')?.valid &&
        this.registrationForm.get('languages')?.valid &&
        this.registrationForm.get('categories')?.valid &&
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
  }

  private validateCurrentStep(): boolean {
    if (this.currentStep === 1) {
      const fields = ['brandName', 'brandUsername', 'email', 'phoneNumber'];
      fields.forEach((path) => this.registrationForm.get(path)?.markAsTouched());
      return fields.every((path) => this.registrationForm.get(path)?.valid) && this.hasBrandLogo();
    }

    if (this.currentStep === 2) {
      this.step2Attempted = true;
      const required = ['paymentOption', 'location.state', 'location.district', 'languages', 'categories'];
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

  async onSubmit() {
    this.submitted = true;
    if (!this.isEditMode || this.registrationForm.invalid || !this.hasBrandLogo()) {
      if (!this.hasBrandLogo()) {
        this.registrationError = 'Brand logo is required.';
      }
      return;
    }
    this.registrationError = '';
    this.registrationSuccess = false;
    const raw = this.registrationForm.getRawValue();
    // Map state ID to name
    const stateObj = this.states.find(s => s._id === raw.location.state);
    const districtObj = this.districts.find(d => d._id === raw.location.district);
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
        handle: pf.handle,
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
    let token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
    this.configService.updateBrandProfile(payload).subscribe({
      next: () => {
        this.registrationSuccess = true;
        this.isEditMode = false;
        this.registrationForm.disable();
        this.registrationForm.get('password')?.disable();
        this.registrationForm.get('confirmPassword')?.disable();
        this.originalFormValue = this.registrationForm.getRawValue();
        this.originalPlatformForms = JSON.parse(JSON.stringify(this.platformForms));
        this.submitted = false;
      },
      error: err => {
        this.registrationError = 'Update failed. Please try again.';
        this.submitted = false;
      }
    });
  }
  
}
