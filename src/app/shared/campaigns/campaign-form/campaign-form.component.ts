import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Campaign, CampaignInfluencer } from '../campaign.model';
import { ConfigService } from '../../config.service';
import { environment } from '../../../../environments/environment';

// Deliverables keyed by platform name (lowercase). 'all' = shown for any/no platform.
const DELIVERABLES_BY_PLATFORM: Record<string, string[]> = {
  instagram: ['Instagram post', 'Instagram reel', 'Instagram story', 'Instagram live'],
  youtube:   ['YouTube video', 'YouTube Shorts', 'YouTube live'],
  twitter:   ['Twitter/X post', 'Twitter/X thread'],
  facebook:  ['Facebook post', 'Facebook reel', 'Facebook story', 'Facebook live'],
  linkedin:  ['LinkedIn post', 'LinkedIn article'],
  all:       ['Blog post', 'Podcast mention', 'Website feature'],
};

@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './campaign-form.component.html',
  styleUrls: ['./campaign-form.component.scss']
})
export class CampaignFormComponent implements OnInit {
    get deliverablesList(): string[] {
      const platform = (this.form?.get('platformPreference')?.value || '').toLowerCase().trim();
      const specific = platform && DELIVERABLES_BY_PLATFORM[platform]
        ? DELIVERABLES_BY_PLATFORM[platform]
        : Object.entries(DELIVERABLES_BY_PLATFORM)
            .filter(([k]) => k !== 'all')
            .flatMap(([, v]) => v);
      return [...new Set([...specific, ...DELIVERABLES_BY_PLATFORM['all']])];
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
  categoriesList: any[] = [];
  selectedCategories: string[] = [];
  selectedDeliverables: string[] = [];
  platformsList: any[] = [];
  // Add ChangeDetectorRef
  constructor(private fb: FormBuilder, private config: ConfigService, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    this.form = this.fb.group({
      title: [this.campaign?.title || '', [Validators.required, Validators.minLength(3)]],
      description: [this.campaign?.description || ''],
      status: [this.campaign?.status || 'draft'],
      budgetMin: [this.campaign?.budgetMin || null, [Validators.min(0)]],
      budgetMax: [this.campaign?.budgetMax || null, [Validators.min(0)]],
      timelineStart: [this.formatDate(this.campaign?.timelineStart), Validators.required],
      timelineEnd: [this.formatDate(this.campaign?.timelineEnd), Validators.required],
      minFollowerCount: [this.campaign?.minFollowerCount || null, [Validators.min(0)]],
      platformPreference: [this.campaign?.platformPreference || ''],
      specialInstructions: [this.campaign?.specialInstructions || ''],
    });

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
      this.selectedDeliverables = [...(this.campaign.deliverables || [])];
    }

    this.config.getCategories().subscribe(data => {
      this.categoriesList = data;
      this.cd.detectChanges();
    });

    this.config.getSocialMedia().subscribe(data => {
      this.platformsList = Array.isArray(data) ? data : [];
      this.cd.detectChanges();
    });

    // When platform changes, clear any deliverables no longer in the new list
    this.form.get('platformPreference')?.valueChanges.subscribe(() => {
      const available = this.deliverablesList;
      this.selectedDeliverables = this.selectedDeliverables.filter(d => available.includes(d));
    });
  }

  get isEdit(): boolean { return this.mode === 'edit'; }
  get f() { return this.form.controls; }

  // ── Stepper helpers ──────────────────────────────────────────
  step1Valid(): boolean {
    return !!(this.f['title'].valid && this.f['timelineStart'].value && this.f['timelineEnd'].value);
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

  // ── Deliverables ─────────────────────────────────────────────
  toggleDeliverable(name: string) {
    const idx = this.selectedDeliverables.indexOf(name);
    if (idx >= 0) this.selectedDeliverables.splice(idx, 1);
    else this.selectedDeliverables.push(name);
  }
  isDeliverableSelected(name: string): boolean { return this.selectedDeliverables.includes(name); }

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
    if (this.selectedInfluencerIds.has(id)) this.selectedInfluencerIds.delete(id);
    else this.selectedInfluencerIds.add(id);
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
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
    this.selectedInfluencerIds.clear();
    this.onSubmit();
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.uploading = true;
    const v = this.form.value;
    const payload: any = {
      title: v.title,
      description: v.description,
      status: v.status,
      budgetMin: v.budgetMin ? +v.budgetMin : undefined,
      budgetMax: v.budgetMax ? +v.budgetMax : undefined,
      timelineStart: v.timelineStart || undefined,
      timelineEnd: v.timelineEnd || undefined,
      categories: this.selectedCategories,
      deliverables: this.selectedDeliverables,
      minFollowerCount: v.minFollowerCount ? +v.minFollowerCount : undefined,
      platformPreference: v.platformPreference || undefined,
      specialInstructions: v.specialInstructions || undefined,
      ...(this.preSelectedInfluencers.length > 0 ? { targetInfluencers: this.preSelectedInfluencers } : {}),
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
      inviteInfluencerIds: this.selectedInfluencerIds.size > 0
        ? Array.from(this.selectedInfluencerIds)
        : undefined,
    });
    // After inviting, refresh the invites list so UI updates
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

