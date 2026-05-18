import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { passwordStrengthValidator, getPasswordChecks } from '../../shared/password-strength';

export const passwordMatchValidator: ValidatorFn = (group: AbstractControl) => {
  const pw = group.get('password')?.value;
  const cpw = group.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-photographer-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
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
  registrationError = '';
  galleryUploadWarning = '';

  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];

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
  readonly MAX_PHOTOSHOOT_IMAGES = 10;

  duplicateEmailError = '';
  duplicatePhoneError = '';
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

  constructor(
    private fb: FormBuilder,
    private config: ConfigService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      name: ['', Validators.required],
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
    }, { validators: [passwordMatchValidator] });

    this.form.get('email')?.valueChanges.subscribe(() => { this.duplicateEmailError = ''; });
    this.form.get('phoneNumber')?.valueChanges.subscribe(() => { this.duplicatePhoneError = ''; });
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
    this.config.getTiers().subscribe(data => { this.tiers = Array.isArray(data) ? data : []; });
  }

  toggleSkill(skill: string) {
    const arr: string[] = [...(this.form.get('skills')?.value || [])];
    const idx = arr.indexOf(skill);
    idx > -1 ? arr.splice(idx, 1) : arr.push(skill);
    this.form.get('skills')?.setValue(arr);
  }

  isSkillSelected(skill: string): boolean {
    return (this.form.get('skills')?.value || []).includes(skill);
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
    if (pf) pf.handle = (pf.handle || '').replace(/^@+/, '').trim();
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

  get platformsValid(): boolean {
    const selected = this.selectedPlatforms();
    if (selected.length === 0) return false;
    return selected.every(p => {
      const pf = this.platformForms[p._id];
      return pf && (pf.handle || '').trim() && (pf.tier || '').trim();
    });
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

    const remainingSlots = this.MAX_PHOTOSHOOT_IMAGES - this.photoshootImagesData.length;
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
      formData.append('folder', 'photographer_profiles');

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
      const step1Fields = ['name', 'email', 'phoneNumber', 'password', 'confirmPassword', 'location'];
      const hasErrors = step1Fields.some(f => this.form.get(f)?.invalid);
      const pwMismatch = this.form.errors?.['passwordMismatch'];
      if (hasErrors || pwMismatch) return;
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

  onSubmit() {
    this.submitted = true;
    if (this.form.invalid) return;
    if (!this.platformsValid) return;
    this.step2Complete = true;
    this.step3Complete = true;

    const v = this.form.value;
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
        handle: (pf.handle || '').trim(),
        tier: pf.tier || '',
        followersCount: Number(pf.followersCount) || 0,
        contentTypes,
      };
    });

    const payload = {
      name: v.name,
      email: v.email,
      phoneNumber: v.phoneNumber,
      dateOfBirth: v.dateOfBirth || null,
      gender: v.gender || '',
      portfolio: v.portfolio || '',
      password: v.password,
      confirmPassword: v.confirmPassword,
      location: v.location,
      paymentOption: v.paymentOption || 'free',
      skills: v.skills || [],
      equipment: v.equipment || [],
      pricing: pricingArr,
      socialMedia,
      profileImages: [
        ...(this.profileImageData ? [this.profileImageData] : []),
        ...this.photoshootImagesData,
      ],
      signupAttribution: {
        source: 'direct',
        referrerPath: typeof window !== 'undefined' ? window.location.pathname : undefined,
      },
    };

    this.submitting = true;
    this.registrationError = '';
    this.galleryUploadWarning = '';
    this.config.registerPhotographer(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.registrationSuccess = true;
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
        this.registrationError = body?.message || 'Registration failed. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  closeSuccessModal() {
    this.registrationSuccess = false;
    this.router.navigate(['/auth/login']);
  }
}
