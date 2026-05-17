import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Campaign } from '../../campaigns/campaign.model';
import { ConfigService } from '../../config.service';

@Component({
  selector: 'app-photographer-collaboration-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './photographer-collaboration-form.component.html',
  styleUrls: [
    './photographer-collaboration-form.component.scss',
  ],
})
export class PhotographerCollaborationFormComponent implements OnInit {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() campaign: Campaign | null = null;
  @Input() hasPremium = false;

  @Output() save = new EventEmitter<Partial<Campaign>>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;

  collaborationTypes: Array<{ value: string; label: string; premiumOnly?: boolean }> = [
    { value: 'paid_collab', label: 'Paid Shoot' },
    { value: 'product', label: 'Barter / Product Shoot', premiumOnly: true },
    { value: 'reel_collab', label: 'Reel Collaboration' },
    { value: 'youtube_video', label: 'YouTube Video' },
    { value: 'portfolio_collab', label: 'Portfolio Collaboration' },
    { value: 'invite_location', label: 'Event Coverage', premiumOnly: true },
    { value: 'creative_project', label: 'Creative Project' },
  ];

  accessModes: Array<{ value: string; label: string }> = [
    { value: 'tier_filtered_open', label: 'Open to All' },
    { value: 'invite_only', label: 'Invite Only' },
  ];

  deliverableOptions = ['Reels', 'Photos', 'Stories', 'YouTube Short', 'Collaboration Post'];
  tierOptions = ['Nano', 'Micro', 'Mid-tier', 'Macro'];

  categoryOptions: string[] = [];
  platformOptions: string[] = ['Instagram', 'YouTube', 'Facebook', 'TikTok', 'X / Twitter', 'LinkedIn'];
  states: any[] = [];
  districts: any[] = [];

  selectedCategories: string[] = [];
  selectedDeliverables: string[] = [];
  selectedPlatforms: string[] = [];
  submitAttempted = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly config: ConfigService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      title: [this.campaign?.title || '', [Validators.required, Validators.minLength(3)]],
      description: [this.campaign?.description || '', [Validators.required, Validators.minLength(10)]],
      collaborationType: [(this.campaign as any)?.campaignType || 'paid_collab', Validators.required],
      campaignMode: [(this.campaign as any)?.campaignMode || 'tier_filtered_open', Validators.required],
      timelineStart: [this.formatDate(this.campaign?.timelineStart), Validators.required],
      timelineEnd: [this.formatDate(this.campaign?.timelineEnd), Validators.required],
      targetState: [(this.campaign as any)?.targetState || ''],
      targetDistrict: [(this.campaign as any)?.targetCities?.[0] || ''],
      minInfluencerTier: [(this.campaign as any)?.minInfluencerTier || ''],
      maxInfluencers: [(this.campaign as any)?.maxInfluencers || 5, [Validators.required, Validators.min(1)]],
      minInfluencers: [(this.campaign as any)?.minInfluencers || 1, [Validators.required, Validators.min(1)]],
      duration: [''],
      indoorOutdoor: [''],
      compensationModel: ['paid', Validators.required],
      pricePerInfluencer: [this.getRupeePrice((this.campaign as any)?.pricePerInfluencer)],
      minFollowers: [(this.campaign as any)?.minFollowerCount || null],
      genderPreference: [''],
      ageMin: [null],
      ageMax: [null],
      instagramRequired: [false],
      portfolioRequired: [false],
      specialInstructions: [this.campaign?.specialInstructions || ''],
    });

    this.selectedCategories = Array.isArray(this.campaign?.categories) ? [...(this.campaign?.categories || [])] : [];
    this.selectedDeliverables = Array.isArray((this.campaign as any)?.deliverables) ? [...((this.campaign as any)?.deliverables || [])] : [];
    this.selectedPlatforms = Array.isArray((this.campaign as any)?.platforms) ? [...((this.campaign as any)?.platforms || [])] : [];

    this.config.getCategories('influencer').subscribe((data) => {
      this.categoryOptions = Array.isArray(data) ? data.map((d: any) => String(d?.name || d)).filter(Boolean) : [];
    });

    this.config.getSocialMedia().subscribe((data) => {
      const fromApi = Array.isArray(data)
        ? data.map((p: any) => String(p?.name || '')).filter(Boolean)
        : [];
      if (fromApi.length) this.platformOptions = fromApi;
    });

    this.config.getStates().subscribe((data) => {
      this.states = Array.isArray(data) ? data : [];
      const currentState = this.form.get('targetState')?.value;
      if (currentState) this.loadDistricts(currentState);
    });

    this.form.get('targetState')?.valueChanges.subscribe((stateName: string) => {
      this.form.get('targetDistrict')?.setValue('');
      this.loadDistricts(stateName);
    });
  }

  get isEdit(): boolean {
    return this.mode === 'edit';
  }

  get isPaidCompensation(): boolean {
    return this.form?.get('compensationModel')?.value === 'paid';
  }

  get minMaxInvalid(): boolean {
    const minCtrl = this.form?.get('minInfluencers');
    const maxCtrl = this.form?.get('maxInfluencers');
    const showError = this.submitAttempted
      || !!minCtrl?.touched
      || !!maxCtrl?.touched
      || !!minCtrl?.dirty
      || !!maxCtrl?.dirty;
    if (!showError) return false;
    const min = Number(minCtrl?.value || 0);
    const max = Number(maxCtrl?.value || 0);
    return min > max;
  }

  get ageRangeInvalid(): boolean {
    const ageMinCtrl = this.form?.get('ageMin');
    const ageMaxCtrl = this.form?.get('ageMax');
    const showError = this.submitAttempted
      || !!ageMinCtrl?.touched
      || !!ageMaxCtrl?.touched
      || !!ageMinCtrl?.dirty
      || !!ageMaxCtrl?.dirty;
    const ageMin = ageMinCtrl?.value;
    const ageMax = ageMaxCtrl?.value;
    if (!showError || ageMin == null || ageMax == null || ageMin === '' || ageMax === '') {
      return false;
    }
    return Number(ageMin) > Number(ageMax);
  }

  get categoriesInvalid(): boolean {
    return this.submitAttempted && !this.selectedCategories.length;
  }

  get platformsInvalid(): boolean {
    return this.submitAttempted && !this.selectedPlatforms.length;
  }

  get deliverablesInvalid(): boolean {
    return this.submitAttempted && !this.selectedDeliverables.length;
  }

  get paidBudgetInvalid(): boolean {
    if (!this.submitAttempted || !this.isPaidCompensation) return false;
    const rawPrice = Number(this.form?.get('pricePerInfluencer')?.value || 0);
    return rawPrice <= 0;
  }

  get timelineInvalid(): boolean {
    const startCtrl = this.form?.get('timelineStart');
    const endCtrl = this.form?.get('timelineEnd');
    const showError = this.submitAttempted
      || !!startCtrl?.touched
      || !!endCtrl?.touched
      || !!startCtrl?.dirty
      || !!endCtrl?.dirty;
    if (!showError) return false;
    const start = startCtrl?.value;
    const end = endCtrl?.value;
    if (!start || !end) return false;
    return new Date(end).getTime() < new Date(start).getTime();
  }

  toggleCategory(value: string): void {
    if (this.selectedCategories.includes(value)) {
      this.selectedCategories = this.selectedCategories.filter((v) => v !== value);
    } else {
      this.selectedCategories = [...this.selectedCategories, value];
    }
  }

  toggleDeliverable(value: string): void {
    if (this.selectedDeliverables.includes(value)) {
      this.selectedDeliverables = this.selectedDeliverables.filter((v) => v !== value);
    } else {
      this.selectedDeliverables = [...this.selectedDeliverables, value];
    }
  }

  togglePlatform(value: string): void {
    if (this.selectedPlatforms.includes(value)) {
      this.selectedPlatforms = this.selectedPlatforms.filter((v) => v !== value);
    } else {
      this.selectedPlatforms = [...this.selectedPlatforms, value];
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onSubmit(): void {
    this.submitAttempted = true;
    this.form.markAllAsTouched();
    const v = this.form.value;

    if (this.form.invalid) return;
    if (!this.selectedCategories.length) return;
    if (!this.selectedPlatforms.length) return;
    if (!this.selectedDeliverables.length) return;
    if (this.timelineInvalid) return;
    if (Number(v.minInfluencers || 0) > Number(v.maxInfluencers || 0)) return;
    if (v.ageMin && v.ageMax && Number(v.ageMin) > Number(v.ageMax)) return;

    const isPaid = v.compensationModel === 'paid';
    const rawPrice = Number(v.pricePerInfluencer || 0);
    if (isPaid && rawPrice <= 0) return;

    const requirementsBlock = [
      `Collaboration Type: ${v.collaborationType || ''}`,
      `Compensation: ${v.compensationModel || ''}`,
      `Indoor/Outdoor: ${v.indoorOutdoor || 'Not specified'}`,
      `Duration: ${v.duration || 'Not specified'}`,
      `Gender Preference: ${v.genderPreference || 'Any'}`,
      `Age Range: ${v.ageMin || 'NA'} - ${v.ageMax || 'NA'}`,
      `Instagram Required: ${v.instagramRequired ? 'Yes' : 'No'}`,
      `Portfolio Required: ${v.portfolioRequired ? 'Yes' : 'No'}`,
    ].join('\n');

    const special = String(v.specialInstructions || '').trim();
    const specialInstructions = special
      ? `${special}\n\n---\n${requirementsBlock}`
      : requirementsBlock;

    const payload: Partial<Campaign> = {
      title: String(v.title || '').trim(),
      description: String(v.description || '').trim(),
      campaignType: String(v.collaborationType || 'paid_collab') as any,
      campaignMode: String(v.campaignMode || 'tier_filtered_open') as any,
      timelineStart: v.timelineStart,
      timelineEnd: v.timelineEnd,
      status: 'pending_review',
      categories: this.selectedCategories,
      deliverables: this.selectedDeliverables,
      platforms: this.selectedPlatforms,
      minInfluencerTier: v.minInfluencerTier || undefined,
      minFollowerCount: v.minFollowers ? Number(v.minFollowers) : undefined,
      maxInfluencers: Number(v.maxInfluencers || 0),
      minInfluencers: Number(v.minInfluencers || 0),
      pricePerInfluencer: isPaid ? Math.round(rawPrice * 100) : undefined,
      targetState: v.targetState || undefined,
      targetCities: v.targetDistrict ? [String(v.targetDistrict)] : [],
      specialInstructions,
    };

    this.save.emit(payload);
  }

  private loadDistricts(stateName: string): void {
    if (!stateName) {
      this.districts = [];
      return;
    }
    const selectedState = this.states.find((s: any) => s.name === stateName || s._id === stateName);
    const stateLabel = selectedState?.name || stateName;
    const stateId = selectedState?._id || stateName;
    this.config.getDistricts(stateLabel, stateId).subscribe((data) => {
      this.districts = Array.isArray(data) ? data : [];
    });
  }

  private formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toISOString().split('T')[0];
  }

  private getRupeePrice(value: any): number | null {
    const paise = Number(value || 0);
    if (!Number.isFinite(paise) || paise <= 0) return null;
    return Math.floor(paise / 100);
  }
}
