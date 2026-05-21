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
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-photographer-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, ResetPasswordModalComponent],
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
  errorMsg = '';
  isEditMode = false;
  currentStep: 1 | 2 | 3 = 1;
  step1Complete = false;
  step2Complete = false;
  step3Complete = false;
  selectedPlan: 'free' | 'premium' = 'free';
  premiumMonthlyPrice = 399;
  showResetPasswordModal = false;
  private originalFormValue: any = null;
  private originalPricingState: any = null;
  private originalPlatformForms: any = null;
  phoneVerified = false;
  verificationCallNumber = '';

  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];
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
  commissionAccessTags: string[] = [];

  private apiUrl = environment.apiBaseUrl || '/api';

  constructor(
    private fb: FormBuilder,
    private config: ConfigService,
    private session: SessionService,
    private toast: ToastService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

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

  ngOnInit() {
    this.form = this.fb.group({
      name: [{ value: '', disabled: true }, Validators.required],
      username: [{ value: '', disabled: true }],
      phoneNumber: [{ value: '', disabled: true }, Validators.required],
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
    this.config.getTiers().subscribe(data => { this.tiers = Array.isArray(data) ? data : []; });

    // Wait for both pricing options and social media before loading profile
    // to avoid race condition where pricingState isn't ready when profile data arrives
    forkJoin({
      pricing: this.config.getPricingOptions(),
      social: this.config.getSocialMedia(),
    }).subscribe(({ pricing, social }) => {
      const list = Array.isArray(pricing) ? pricing : [];
      this.pricingOptions = list.length ? list : this.fallbackPricing;
      this.pricingOptions.forEach(p => {
        this.pricingState[p.key] = { enabled: false, price: '' };
      });
      this.socialMediaList = Array.isArray(social) ? social : [];
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
        const profile = data?.user ?? data?.profile ?? data?.data ?? data ?? {};
        this.commissionAccessTags = this.extractCommissionAccessTags(profile?.adminTags);
        this.phoneVerified = !!profile?.phoneVerified;
        this.verificationCallNumber = String(profile?.verificationCallNumber || '');
        this.form.patchValue({
          name: profile.name || '',
          username: profile.username || '',
          phoneNumber: profile.phoneNumber || '',
          dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().slice(0, 10) : '',
          gender: profile.gender || '',
          portfolio: profile.portfolio || '',
          location: {
            state: profile.location?.state || '',
            district: profile.location?.district || '',
          },
          skills: profile.skills || [],
          equipment: profile.equipment || [],
          contact: {
            whatsapp: !!profile.contact?.whatsapp,
            email: !!profile.contact?.email,
            call: !!profile.contact?.call,
          },
          payout: {
            upiId: profile.payout?.upiId || '',
            mobile: profile.payout?.mobile || '',
            accountHolderName: profile.payout?.accountHolderName || '',
          },
        });

        this.selectedPlan = profile.isPremium ? 'premium' : 'free';

        if (profile.location?.state) {
          const selectedState = this.states.find((s: any) => s.name === profile.location.state);
          const stateId = selectedState?._id || profile.location.state;
          const stateName = selectedState?.name || profile.location.state;
          this.config.getDistricts(stateName, stateId).subscribe({
            next: d => { this.districts = Array.isArray(d) ? d : []; this.cdr.detectChanges(); },
            error: () => { this.districts = []; },
          });
        }

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
        const imgUrl = profile.profileImage || profile.profileImages?.[0]?.url;
        if (imgUrl) {
          this.profileImagePreview = imgUrl;
          this.profileImageData = {
            url: imgUrl,
            public_id: profile.profileImagePublicId || profile.profileImages?.[0]?.public_id || '',
          };
        }

        this.loading = false;
        this.isEditMode = false;
        this.form.disable({ emitEvent: false });
        // Snapshot originals for cancel
        this.originalFormValue = this.form.getRawValue();
        this.originalPricingState = JSON.parse(JSON.stringify(this.pricingState));
        this.originalPlatformForms = JSON.parse(JSON.stringify(this.platformForms));
        this.refreshStepCompletion();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  toggleSkill(skill: string) {
    if (!this.isEditMode) return;
    const arr: string[] = [...(this.form.get('skills')?.value || [])];
    const idx = arr.indexOf(skill);
    idx > -1 ? arr.splice(idx, 1) : arr.push(skill);
    this.form.get('skills')?.setValue(arr);
    this.refreshStepCompletion();
  }

  isSkillSelected(skill: string): boolean {
    return (this.form.get('skills')?.value || []).includes(skill);
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
      const phone = String(this.form.get('phoneNumber')?.value || '').trim();
      return !!name && !!phone;
    }
    if (step === 2) {
      const state = String(this.form.get('location.state')?.value || '').trim();
      const district = String(this.form.get('location.district')?.value || '').trim();
      const hasSkills = Array.isArray(this.form.get('skills')?.value) && this.form.get('skills')?.value.length > 0;
      return !!(state || district || hasSkills || this.selectedPlatforms().length);
    }
    if (this.selectedPlan !== 'premium') return this.step1Complete && this.step2Complete;
    const c = this.form.get('contact')?.value || {};
    return this.step1Complete && this.step2Complete && !!(c.whatsapp || c.email || c.call);
  }

  isContactEditable(): boolean {
    return this.isEditMode && this.selectedPlan === 'premium';
  }

  selectPlan(plan: 'free' | 'premium') {
    if (!this.isEditMode) return;
    this.selectedPlan = plan;
    if (plan !== 'premium') {
      this.form.patchValue({
        contact: { whatsapp: false, email: false, call: false },
      }, { emitEvent: false });
    }
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

  getTierOptionLabel(tier: any): string {
    const name = String(tier?.name || '').trim();
    const desc = String(tier?.desc || '').trim();
    return desc ? `${name} (${desc})` : name;
  }

  async onProfileImageFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.toast.error('Please select a valid image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { this.toast.error('Image size must be below 5MB.'); return; }
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

  enableEdit(): void {
    this.isEditMode = true;
    this.form.enable({ emitEvent: false });
    this.form.get('username')?.disable({ emitEvent: false });
    this.originalFormValue = this.form.getRawValue();
    this.originalPricingState = JSON.parse(JSON.stringify(this.pricingState));
    this.originalPlatformForms = JSON.parse(JSON.stringify(this.platformForms));
    this.refreshStepCompletion();
    this.cdr.detectChanges();
  }

  cancelEdit(): void {
    this.isEditMode = false;
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
    this.form.disable({ emitEvent: false });
    this.refreshStepCompletion();
    this.cdr.detectChanges();
  }

  onSave() {
    if (!this.isEditMode || this.form.invalid || this.saving) return;
    const v = this.form.getRawValue();
    const pricingArr = this.pricingOptions
      .filter(p => this.pricingState[p.key]?.enabled)
      .map(p => ({ name: p.key, enabled: true, price: Number(this.pricingState[p.key].price) || 0 }));

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

    const payload: any = {
      ...v,
      username: this.form.get('username')?.value || '',
      pricing: pricingArr,
      socialMedia,
      payout: v.payout || { upiId: '', mobile: '', accountHolderName: '' },
    };
    if (this.profileImageData) {
      payload.profileImage = this.profileImageData.url;
      payload.profileImagePublicId = this.profileImageData.public_id;
      payload.profileImages = [this.profileImageData];
    }

    const token = this.session.getToken();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
    this.saving = true;
    this.http.patch(`${this.apiUrl}/users/photographers/me/profile`, payload, { headers }).subscribe({
      next: () => {
        this.saving = false;
        this.saved = true;
        this.isEditMode = false;
        this.form.disable({ emitEvent: false });
        this.originalFormValue = this.form.getRawValue();
        this.originalPricingState = JSON.parse(JSON.stringify(this.pricingState));
        this.originalPlatformForms = JSON.parse(JSON.stringify(this.platformForms));
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
}
