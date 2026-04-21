import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Campaign, CampaignInfluencer } from '../campaign.model';
import { ConfigService } from '../../config.service';
import { environment } from '../../../../environments/environment';



@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './campaign-form.component.html',
  styleUrls: ['./campaign-form.component.scss']
})
export class CampaignFormComponent implements OnInit {
    selectionLimitError = '';

    canSelectMoreInfluencers(): boolean {
      const max = Number(this.f['maxInfluencers']?.value || 0);
      return max === 0 || this.selectedInfluencerIds.size < max;
    }
  campaignInvites: any[] = [];
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() campaign: Campaign | null = null;
  @Input() preSelectedInfluencers: CampaignInfluencer[] = [];
  @Output() save = new EventEmitter<Partial<Campaign> & { inviteInfluencerIds?: string[] }>();
  @Output() cancel = new EventEmitter<void>();
  form!: FormGroup;

  // ── Step 3 influencers ───────────────────────────────────────
  allInfluencers: any[] = [];
  influencersLoading = false;
  influencerSearch = '';
  selectedInfluencerIds = new Set<string>();
  filterCategory = '';
  filterFollowers = '';
  filterPlatform = '';
  imagePreview: string | null = null;
  selectedFile: File | null = null;
  uploading = false;
  currentStep = 1;
  trustLabels = [
    'You pay only for accepted influencers',
    'Payment secured by TrendStarz',
    'Released after campaign approval',
  ];
  categoriesList: any[] = [];
  selectedCategories: string[] = [];
  selectedPlatforms: string[] = [];
  activePlatformTab = '';
  platformDeliverables: { platform: string; contentTypes: { name: string; enabled: boolean; price: number | null }[] }[] = [];
  platformsList: any[] = [];
  // Add ChangeDetectorRef
  constructor(private fb: FormBuilder, private config: ConfigService, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    this.form = this.fb.group({
      title: [this.campaign?.title || '', [Validators.required, Validators.minLength(3)]],
      description: [this.campaign?.description || ''],
      campaignType: [(this.campaign as any)?.campaignType || 'paid_collab', [Validators.required]],
      status: [this.campaign?.status || 'draft'],
      pricePerInfluencer: [this.getInitialPricePerInfluencer(), [Validators.required, Validators.min(1)]],
      maxInfluencers: [(this.campaign as any)?.maxInfluencers || null, [Validators.required, Validators.min(1)]],
      timelineStart: [this.formatDate(this.campaign?.timelineStart), Validators.required],
      timelineEnd: [this.formatDate(this.campaign?.timelineEnd), Validators.required],
      minFollowerCount: [this.campaign?.minFollowerCount || null, [Validators.min(0)]],
      platformPreference: [this.campaign?.platformPreference || ''],
      specialInstructions: [this.campaign?.specialInstructions || ''],
    }, { validators: [this.dateRangeValidator] });

    if (this.campaign?.image?.url) {
      this.imagePreview = this.campaign.image.url;
    }

    // If editing, fetch current invites for this campaign
    if (this.isEdit && this.campaign?._id) {
      this.fetchCampaignInvites();
    }

    // Pre-populate multi-selects when editing
    if (this.campaign) {
      this.selectedCategories = [...(this.campaign.categories || [])];
      const existingSocialMedia = (this.campaign as any).socialMedia;
      if (Array.isArray(existingSocialMedia) && existingSocialMedia.length) {
        this.platformDeliverables = existingSocialMedia.map((sm: any) => ({
          platform: sm.platform,
          contentTypes: (sm.contentTypes || []).map((ct: any) => ({
            name: ct.name, enabled: ct.enabled ?? false, price: ct.price ?? null
          }))
        }));
        this.selectedPlatforms = this.platformDeliverables.map(pd => pd.platform);
        this.activePlatformTab = this.selectedPlatforms[0] || '';
      }
    }

    this.config.getCategories().subscribe(data => {
      this.categoriesList = data;
      this.cd.detectChanges();
    });

    this.config.getSocialMedia().subscribe(data => {
      this.platformsList = Array.isArray(data) ? data : [];
      this.cd.detectChanges();
    });


  }

  get isEdit(): boolean { return this.mode === 'edit'; }
  get f() { return this.form.controls; }

  get estimatedBudgetRupees(): number {
    const price = Number(this.f['pricePerInfluencer']?.value || 0);
    const maxInf = Number(this.f['maxInfluencers']?.value || 0);
    return price * maxInf;
  }

  private getInitialPricePerInfluencer(): number | null {
    const existingPaise = Number((this.campaign as any)?.pricePerInfluencer || 0);
    if (existingPaise > 0) return Math.floor(existingPaise / 100);
    const budgetMin = Number(this.campaign?.budgetMin || 0);
    return budgetMin > 0 ? budgetMin : null;
  }

  private dateRangeValidator = (group: FormGroup) => {
    const start = group.get('timelineStart')?.value;
    const end = group.get('timelineEnd')?.value;
    if (!start || !end) return null;
    return new Date(end) >= new Date(start) ? null : { invalidDateRange: true };
  };

  // ── Stepper helpers ──────────────────────────────────────────
  step1Valid(): boolean {
    return !!(
      this.f['title'].valid &&
      this.f['campaignType'].valid &&
      this.f['timelineStart'].value &&
      this.f['timelineEnd'].value &&
      !this.form.errors?.['invalidDateRange']
    );
  }

  goToStep(step: number) {
    if (step === 2 && !this.step1Valid()) {
      this.form.markAllAsTouched();
      return;
    }
    this.currentStep = step;
    if (step === 3) {
      if (this.allInfluencers.length === 0) {
        this.loadInfluencers();
      }
      // Always fetch invites when entering step 3 in edit mode
      if (this.isEdit && this.campaign?._id) {
        this.fetchCampaignInvites();
      }
    }
  }

  nextStep() { this.goToStep(this.currentStep + 1); }
  prevStep() { this.currentStep = Math.max(1, this.currentStep - 1); }

  // ── Categories ───────────────────────────────────────────────
  toggleCategory(name: string) {
    const idx = this.selectedCategories.indexOf(name);
    if (idx >= 0) this.selectedCategories.splice(idx, 1);
    else this.selectedCategories.push(name);
  }
  isCategorySelected(name: string): boolean { return this.selectedCategories.includes(name); }



  // ── Influencers (step 3) ─────────────────────────────────────
  loadInfluencers() {
    this.influencersLoading = true;
    this.config.getInfluencers().subscribe({
      next: (data: any[]) => {
        this.allInfluencers = Array.isArray(data) ? data : [];
        this.influencersLoading = false;
        this.cd.detectChanges();
      },
      error: () => { this.influencersLoading = false; this.cd.detectChanges(); }
    });
  }

  get filteredInfluencers(): any[] {
    let list = this.allInfluencers;
    const q = this.influencerSearch.toLowerCase().trim();
    if (q) {
      list = list.filter(inf =>
        (inf.fullName || inf.name || '').toLowerCase().includes(q) ||
        (inf.username || '').toLowerCase().includes(q) ||
        (inf.location?.state || '').toLowerCase().includes(q) ||
        (inf.categories || []).some((c: string) => c.toLowerCase().includes(q))
      );
    }
    if (this.filterCategory) {
      list = list.filter(inf => (inf.categories || []).includes(this.filterCategory));
    }
    if (this.filterFollowers === '10k') {
      list = list.filter(inf => this.totalFollowers(inf) >= 10000);
    } else if (this.filterFollowers === '100k') {
      list = list.filter(inf => this.totalFollowers(inf) >= 100000);
    }
    if (this.filterPlatform) {
      list = list.filter(inf =>
        (inf.socialMedia || []).some((s: any) =>
          (s.platform || '').toLowerCase().includes(this.filterPlatform.toLowerCase())
        )
      );
    }
    return list;
  }
  fetchCampaignInvites() {
    if (!this.campaign?._id) return;
    this.config.getInvitesByCampaign(this.campaign._id).subscribe(invites => {
      this.campaignInvites = Array.isArray(invites) ? invites : [];
      this.cd.detectChanges();
    });
  }

  totalFollowers(inf: any): number {
    return (inf.socialMedia || []).reduce((sum: number, s: any) => sum + (s.followersCount || 0), 0);
  }

  getInfluencerAvatar(inf: any): string {
    if (Array.isArray(inf.profileImages) && inf.profileImages.length > 0) {
      if (inf.profileImages[0]?.url) return inf.profileImages[0].url;
      if (typeof inf.profileImages[0] === 'string') return inf.profileImages[0];
    }
    return '';
  }

  getInfluencerInitials(inf: any): string {
    const name = inf.fullName || inf.name || '?';
    return name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  }

  formatFollowers(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'k';
    return String(n);
  }

  getPlatformTags(inf: any): string[] {
    return (inf.socialMedia || []).map((s: any) => {
      const lbl = (s.platform || '').toLowerCase().includes('youtube') ? 'YT' :
                  (s.platform || '').toLowerCase().includes('instagram') ? 'IG' : s.platform;
      return `${lbl} ${this.formatFollowers(s.followersCount || 0)}`;
    }).slice(0, 2);
  }

  getUniqueCategoryFilters(): string[] {
    const cats = new Set<string>();
    this.allInfluencers.forEach(inf => (inf.categories || []).forEach((c: string) => cats.add(c)));
    return Array.from(cats).slice(0, 5);
  }


  toggleInfluencerSelect(id: string) {
    const max = Number(this.f['maxInfluencers']?.value || 0);
    this.selectionLimitError = '';
    if (this.selectedInfluencerIds.has(id)) {
      this.selectedInfluencerIds.delete(id);
      return;
    }
    if (max > 0 && this.selectedInfluencerIds.size >= max) {
      this.selectionLimitError = `You can select up to ${max} influencers only.`;
      if ((window as any).showToast) {
        (window as any).showToast(this.selectionLimitError, 'error');
      }
      return;
    }
    this.selectedInfluencerIds.add(id);
  }


  onImgError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  // ── Platform multi-select ─────────────────────────────────────
  getPlatformOptions(): any[] {
    if (this.platformsList.length) return this.platformsList;
    return [
      { name: 'Instagram',   contentTypes: [{ name: 'Post', visible: true }, { name: 'Reel', visible: true }, { name: 'Story', visible: true }, { name: 'Live', visible: true }] },
      { name: 'YouTube',     contentTypes: [{ name: 'Video', visible: true }, { name: 'Shorts', visible: true }, { name: 'Live', visible: true }] },
      { name: 'X / Twitter', contentTypes: [{ name: 'Post', visible: true }, { name: 'Thread', visible: true }] },
      { name: 'Facebook',    contentTypes: [{ name: 'Post', visible: true }, { name: 'Reel', visible: true }, { name: 'Story', visible: true }, { name: 'Live', visible: true }] },
      { name: 'LinkedIn',    contentTypes: [{ name: 'Post', visible: true }, { name: 'Article', visible: true }] },
    ];
  }

  isPlatformSelected(name: string): boolean {
    return this.selectedPlatforms.includes(name);
  }

  togglePlatform(p: { name: string; contentTypes?: any[] }) {
    const idx = this.selectedPlatforms.indexOf(p.name);
    if (idx >= 0) {
      this.selectedPlatforms.splice(idx, 1);
      this.platformDeliverables = this.platformDeliverables.filter(pd => pd.platform !== p.name);
      // switch active tab to the first remaining platform
      this.activePlatformTab = this.selectedPlatforms[0] || '';
    } else {
      this.selectedPlatforms.push(p.name);
      const found = this.getPlatformOptions().find(pl => pl.name === p.name) || p;
      const cts = (found.contentTypes || [])
        .filter((ct: any) => ct.visible !== false)
        .map((ct: any) => ({ name: ct.name, enabled: false, price: null as number | null }));
      this.platformDeliverables.push({ platform: p.name, contentTypes: cts });
      // auto-activate newly added platform tab
      this.activePlatformTab = p.name;
    }
    this.cd.markForCheck();
  }

  getEnabledCount(pd: { contentTypes: { enabled: boolean }[] }): number {
    return pd.contentTypes.filter(ct => ct.enabled).length;
  }

  getPlatformTotal(pd: { contentTypes: { enabled: boolean; price: number | null }[] }): number {
    return pd.contentTypes
      .filter(ct => ct.enabled && ct.price)
      .reduce((sum, ct) => sum + (ct.price || 0), 0);
  }

  getPlatformIcon(name: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('instagram')) return 'bi bi-instagram';
    if (n.includes('youtube')) return 'bi bi-youtube';
    if (n.includes('twitter') || n.includes('x')) return 'bi bi-twitter-x';
    if (n.includes('facebook')) return 'bi bi-facebook';
    if (n.includes('linkedin')) return 'bi bi-linkedin';
    if (n.includes('tiktok')) return 'bi bi-tiktok';
    return 'bi bi-share';
  }

  // ── Image upload ─────────────────────────────────────────────
  private formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toISOString().split('T')[0];
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
      const reader = new FileReader();
      reader.onload = () => { this.imagePreview = reader.result as string; };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  removeImage() {
    this.imagePreview = null;
    this.selectedFile = null;
  }

  // ── Submit ───────────────────────────────────────────────────
  skipAndSave() {
    // Always save as draft, do not send invites
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.uploading = true;
    const v = this.form.value;
    const payload: any = {
      ...v,
      status: 'draft',
    };
    this.uploading = false;
    this.save.emit(payload);
    this.selectedInfluencerIds.clear();
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.selectedInfluencerIds.size === 0) {
      // Show toast or alert if no influencers selected
      if ((window as any).showToast) {
        (window as any).showToast('Please select at least one influencer to invite.', 'error');
      } else {
        alert('Please select at least one influencer to invite.');
      }
      this.uploading = false;
      return;
    }
    this.uploading = true;
    const v = this.form.value;
    // Convert pricePerInfluencer (entered in rupees) to paise for backend
    const pricePerInfluencerPaise = v.pricePerInfluencer ? Math.round(Number(v.pricePerInfluencer) * 100) : 0;
    const payload: any = {
      ...v,
      pricePerInfluencer: pricePerInfluencerPaise,
      status: 'active',
    };
    if (this.selectedFile) {
      try {
        payload.image = await this.uploadToCloudinary(this.selectedFile);
      } catch {
        this.uploading = false;
        return;
      }
    } else if (this.isEdit && this.campaign?.image) {
      payload.image = this.campaign.image;
    }
    this.uploading = false;
    this.save.emit({
      ...payload,
      categories: this.selectedCategories,
      platforms: this.platformDeliverables.map(pd => pd.platform),
      socialMedia: this.platformDeliverables.map(pd => ({
        platform: pd.platform,
        contentTypes: pd.contentTypes.map(ct => ({
          name: ct.name,
          enabled: ct.enabled,
          price: ct.price
        }))
      })),
      inviteInfluencerIds: this.selectedInfluencerIds.size > 0
        ? Array.from(this.selectedInfluencerIds).slice(0, Number(this.f['maxInfluencers']?.value || this.selectedInfluencerIds.size))
        : undefined,
    });
    if (this.isEdit && this.campaign?._id) {
      this.fetchCampaignInvites();
    }
  }

  private async uploadToCloudinary(file: File): Promise<{ url: string; public_id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', environment.cloudinaryUploadPreset);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${environment.cloudinaryCloudName}/image/upload`,
      { method: 'POST', body: formData }
    );
    const data = await res.json();
    if (data.secure_url && data.public_id) {
      return { url: data.secure_url, public_id: data.public_id };
    }
    throw new Error('Image upload failed');
  }

  onCancel() { this.cancel.emit(); }

  isInfluencerInvited(inf: any): boolean {
    return this.campaignInvites.some(i => String(i.influencerId?._id || i.influencerId) === inf._id);
  }
}

