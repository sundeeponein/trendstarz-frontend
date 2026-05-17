import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../shared/toast/toast.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-photographer-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
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

  ngOnInit() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      dateOfBirth: [''],
      gender: [''],
      portfolio: [''],
      location: this.fb.group({
        state: [''],
        district: [''],
      }),
      skills: [[]],
      equipment: [[]],
      contact: this.fb.group({
        whatsapp: [false],
        email: [false],
        call: [false],
      }),
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
    this.config.getPricingOptions().subscribe((data: any[]) => {
      const list = Array.isArray(data) ? data : [];
      this.pricingOptions = list.length ? list : this.fallbackPricing;
      this.pricingOptions.forEach(p => {
        this.pricingState[p.key] = { enabled: false, price: '' };
      });
      this.cdr.detectChanges();
    });
    this.config.getSocialMedia().subscribe(data => { this.socialMediaList = data; this.loadProfile(); this.cdr.detectChanges(); });
    this.config.getTiers().subscribe(data => { this.tiers = Array.isArray(data) ? data : []; });
  }

  private loadProfile() {
    const token = this.session.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http.get<any>(`${this.apiUrl}/users/photographers/me/profile`, { headers }).subscribe({
      next: (data) => {
        this.commissionAccessTags = this.extractCommissionAccessTags(data?.adminTags);
        this.form.patchValue({
          name: data.name || '',
          phoneNumber: data.phoneNumber || '',
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().slice(0, 10) : '',
          gender: data.gender || '',
          portfolio: data.portfolio || '',
          location: {
            state: data.location?.state || '',
            district: data.location?.district || '',
          },
          skills: data.skills || [],
          equipment: data.equipment || [],
          contact: {
            whatsapp: !!data.contact?.whatsapp,
            email: !!data.contact?.email,
            call: !!data.contact?.call,
          },
        });

        if (data.location?.state) {
          const selectedState = this.states.find((s: any) => s.name === data.location.state);
          const stateId = selectedState?._id || data.location.state;
          const stateName = selectedState?.name || data.location.state;
          this.config.getDistricts(stateName, stateId).subscribe({
            next: d => { this.districts = Array.isArray(d) ? d : []; this.cdr.detectChanges(); },
            error: () => { this.districts = []; },
          });
        }

        // Pricing
        if (Array.isArray(data.pricing)) {
          data.pricing.forEach((p: any) => {
            if (this.pricingState[p.name]) {
              this.pricingState[p.name].enabled = !!p.enabled;
              this.pricingState[p.name].price = p.price ? String(p.price) : '';
            }
          });
        }

        // Social media
        if (Array.isArray(data.socialMedia)) {
          data.socialMedia.forEach((sm: any) => {
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
        const imgUrl = data.profileImage || data.profileImages?.[0]?.url;
        if (imgUrl) {
          this.profileImagePreview = imgUrl;
          this.profileImageData = {
            url: imgUrl,
            public_id: data.profileImagePublicId || data.profileImages?.[0]?.public_id || '',
          };
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
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

  onSave() {
    if (this.form.invalid || this.saving) return;
    const v = this.form.value;
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
      pricing: pricingArr,
      socialMedia,
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
