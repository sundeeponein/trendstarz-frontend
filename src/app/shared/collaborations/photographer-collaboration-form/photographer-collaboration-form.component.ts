import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Campaign } from '../../campaigns/campaign.model';
import { ConfigService } from '../../config.service';
import { CampaignGuideModalService, CampaignGuideContent } from '../../components/campaign-guide-modal/campaign-guide-modal.service';
import { CampaignGuideModalComponent } from '../../components/campaign-guide-modal/campaign-guide-modal.component';

@Component({
  selector: 'app-photographer-collaboration-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CampaignGuideModalComponent],
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

  collaborationTypes: Array<{ value: string; label: string; premiumOnly?: boolean; enabled?: boolean }> = [];

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

  protected guideModal = inject(CampaignGuideModalService);

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

    this.loadCollaborationTypeConfigs();
  }

  private loadCollaborationTypeConfigs(): void {
    this.config.getCampaignTypeConfigs().subscribe({
      next: (items) => {
        const selected = String(this.form?.get('collaborationType')?.value || '').trim();
        const source = (Array.isArray(items) ? items : [])
          .filter((item: any) => String(item?.ownerType || '') === 'photographer')
          .sort((a: any, b: any) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0));

        if (!source.length) {
          this.collaborationTypes = this.buildSyntheticCollaborationTypes(selected);
          return;
        }

        const enabledItems = source.filter((item: any) => item?.enabled !== false);
        const selectedDisabledItem = source.find((item: any) => item?.key === selected && item?.enabled === false);
        const finalItems = selectedDisabledItem ? [...enabledItems, selectedDisabledItem] : enabledItems;

        this.collaborationTypes = finalItems.map((item: any) => ({
          value: String(item?.key || '').trim(),
          label: String(item?.label || '').trim(),
          premiumOnly: item?.premiumOnly === true,
          enabled: item?.enabled !== false,
        })).filter((item: any) => !!item.value && !!item.label);

        const canUseSelected = this.collaborationTypes.some((opt) =>
          opt.value === selected && opt.enabled !== false && (this.hasPremium || !opt.premiumOnly),
        );
        if (!canUseSelected && this.collaborationTypes.length) {
          const fallback = this.collaborationTypes.find((opt) =>
            opt.enabled !== false && (this.hasPremium || !opt.premiumOnly),
          ) || this.collaborationTypes[0];
          this.form.patchValue({ collaborationType: fallback.value }, { emitEvent: false });
        }
      },
      error: () => {
        const selected = String(this.form?.get('collaborationType')?.value || '').trim();
        this.collaborationTypes = this.buildSyntheticCollaborationTypes(selected);
      },
    });
  }

  private buildSyntheticCollaborationTypes(
    selected: string,
  ): Array<{ value: string; label: string; premiumOnly?: boolean; enabled?: boolean }> {
    const key = String(selected || '').trim();
    if (!key) return [];
    const label = key === 'paid_collab'
      ? 'Paid Shoot'
      : key
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    return [{ value: key, label, premiumOnly: false, enabled: true }];
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

  /** Opens a guide popup with example descriptions for the selected collaboration type. */
  openDescriptionGuide(): void {
    const type = String(this.form?.get('collaborationType')?.value || 'paid_collab');
    const compensation = String(this.form?.get('compensationModel')?.value || 'paid');

    const content: CampaignGuideContent = {
      title: 'Collaboration description — guide & examples',
      subtitle: 'Read the points below and copy any block into your description.',
      sections: [
        {
          heading: 'What to cover',
          variant: 'tip',
          copyable: false,
          body: `• Goal of the shoot / collaboration\n• Type of content (Reel, Photo set, YouTube video, etc.)\n• Location, indoor/outdoor and any access requirements\n• Look & feel, references or moodboard cues\n• Deliverable formats (raw + edited, aspect ratios)\n\nBudget, max creators and platforms are captured in the structured fields below — you do not need to repeat them in the description.`,
        },
      ],
    };

    if (type === 'paid_collab') {
      content.sections.push({
        heading: 'Sample brief — Paid shoot',
        body: `What we are planning:\n• A short-form Reel + 4 edited stills with a creator\n• Look: lifestyle, natural daylight, urban backdrop\n• Duration on set: ~3 hours\n\nWhat we expect:\n• 1 final Reel (15–30s, 9:16) with smooth cuts and color grade\n• 4 edited stills (high-res, no aggressive filters)\n• Raw files shared via Drive within 3 days\n\nLogistics:\n• Shoot location, props and styling will be provided\n• Travel within city limits is included; outside-city to be discussed`,
      });
    } else if (type === 'product') {
      content.sections.push({
        heading: 'Sample brief — Barter / Product shoot',
        body: `What you'll receive:\n• Free product worth ₹XXXX to feature in the shoot\n• Delivered to your shoot address after acceptance\n\nWhat we expect:\n• 1 Reel + 3 edited stills showcasing the product\n• Highlight key features, styling and real usage\n• Provide raw + edited deliverables as agreed\n\nImportant:\n• ${compensation === 'paid' ? 'In addition to the product, a cash component will be paid as per the agreed budget.' : 'This is a barter shoot — no cash payment. The product is the compensation.'}`,
      });
    } else if (type === 'reel_collab') {
      content.sections.push({
        heading: 'Sample brief — Reel collaboration',
        body: `Concept:\n• A collaborative Reel co-created with the creator\n• Trend / theme: [describe]\n• Tone: [fun / aesthetic / informative / story-driven]\n\nWhat we expect:\n• 1 finished Reel (15–45s, 9:16)\n• Posted as a Collab post (both accounts as co-authors)\n• Insights shared after 7 days`,
      });
    } else if (type === 'youtube_video') {
      content.sections.push({
        heading: 'Sample brief — YouTube video',
        body: `What we are planning:\n• A YouTube video segment / feature\n• Duration: [3–8 mins] | Format: [vlog / tutorial / review]\n\nWhat we expect:\n• 1 fully edited YouTube video\n• 1 vertical short cut (≤60s)\n• Thumbnail asset (optional)\n• Source files delivered within 5 days`,
      });
    } else if (type === 'portfolio_collab') {
      content.sections.push({
        heading: 'Sample brief — Portfolio collaboration',
        body: `What we are planning:\n• A mutual portfolio shoot — both sides retain usage rights\n• Theme / look: [describe]\n• Location: [studio / outdoor / venue]\n\nWhat we expect:\n• 1 Reel + curated stills set\n• Edited deliverables suitable for both portfolios\n• Credits on both sides when posted`,
      });
    } else if (type === 'invite_location') {
      content.sections.push({
        heading: 'Sample brief — Event coverage',
        body: `Event details:\n• 📍 Location: [Venue / Address]\n• 📅 Date: [Event Date]\n• ⏰ Time: [Start – End Time]\n\nWhat we expect:\n• Coverage Reel (30–60s) capturing highlights\n• Curated stills set (people, ambience, key moments)\n• Live stories during the event (preferred)\n\nLogistics:\n• Entry passes will be arranged on confirmation\n• Bring required equipment; basic lighting available on-site`,
      });
    } else {
      content.sections.push({
        heading: 'Sample brief — Creative project',
        body: `Concept:\n• Describe the creative idea in 2–3 lines\n• References / moodboard links\n• Look, tone and final deliverable formats\n\nWhat we expect:\n• Clear list of final deliverables\n• Turnaround timeline after shoot`,
      });
    }

    this.guideModal.open(content);
  }

  /** Opens a guide popup with dos / don'ts for the "Additional Instructions" field. */
  openSpecialInstructionsGuide(): void {
    this.guideModal.open({
      title: 'Additional instructions — guide & examples',
      subtitle: `Use these dos, don'ts and must-include points as a starting point. Copy any block and edit to match your shoot.`,
      sections: [
        {
          heading: 'Dos, Don\'ts and Must-include',
          body: `Dos:\n• Confirm shoot date, time and location at least 24 hours in advance\n• Carry primary + backup equipment (lenses, batteries, cards)\n• Follow agreed look/feel and reference moodboard\n• Share preview frames on set for quick approvals\n\nDon'ts:\n• Do not reuse any of these deliverables for other clients without consent\n• Do not over-process colours beyond agreed look\n• Do not bring external crew without prior approval\n\nMust include:\n• Raw + edited files delivered on time\n• Backup of all files retained for 30 days\n• Credit tag when posting on personal handles`,
        },
        {
          heading: 'Access-mode tip',
          variant: 'info',
          body: `Open to all: clearly mention minimum portfolio expectations and turnaround.\nInvite only: keep acceptance criteria explicit (style, location, availability).`,
        },
      ],
    });
  }
}
