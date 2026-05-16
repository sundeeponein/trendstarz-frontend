import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Campaign, CampaignInfluencer } from '../campaign.model';
import { ConfigService } from '../../config.service';
import { environment } from '../../../../environments/environment';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { TierInfoService } from '../../components/tier-info-modal/tier-info.service';
import { FlowHelpModalService } from '../../components/flow-help-modal/flow-help-modal.service';
import { TIER_ORDER, TIER_DESC_MAP, normalizeTierLabel, getInfluencerPrimaryTier } from '../../tiers.constants';



@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, UserAvatarComponent],
  templateUrl: './campaign-form.component.html',
  styleUrls: ['./campaign-form.component.scss']
})
export class CampaignFormComponent implements OnInit {
  readonly tierOrder: readonly string[] = TIER_ORDER;
  currentBrandName = '';
    selectionLimitError = '';

    /** Count of non-declined invites already sent for this campaign. */
    get invitedCount(): number {
      return (this.campaignInvites || [])
        .filter(i => String(i?.status || '').toLowerCase() !== 'declined')
        .length;
    }
    /** Total slots taken = invited + currently-selected. */
    get takenSlotsCount(): number {
      return this.invitedCount + this.selectedInfluencerIds.size;
    }

    canSelectMoreInfluencers(): boolean {
      const max = Number(this.f['maxInfluencers']?.value || 0);
      return max === 0 || this.takenSlotsCount < max;
    }
  campaignInvites: any[] = [];
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() campaign: Campaign | null = null;
  @Input() preSelectedInfluencers: CampaignInfluencer[] = [];
  @Input() hasPremium: boolean = false;
  @Output() save = new EventEmitter<Partial<Campaign> & { inviteInfluencerIds?: string[] }>();
  @Output() cancel = new EventEmitter<void>();
  form!: FormGroup;

  // ── Step 3 influencers ───────────────────────────────────────
  allInfluencers: any[] = [];
  influencersLoading = false;
  influencerSearch = '';
  selectedInfluencerIds = new Set<string>();
  filterCategory = '';
  filterTier = '';
  filterPlatform = '';
  imagePreview: string | null = null;
  selectedFile: File | null = null;
  uploading = false;
  currentStep = 1;
  platformsTouched = false;
  categoriesTouched = false;
  trustLabels = [
    'You pay only for accepted influencers',
    'Payment secured by TrendStarz',
    'Released after campaign approval',
  ];

  readonly DESCRIPTION_TEMPLATES: Record<string, string> = {
    paid_collab: `What we expect:\n• Create 1 Reel / Short Video showcasing the product\n• Highlight key benefits, usage, or experience in your own style\n• Maintain a natural, audience-friendly tone (no hard selling)\n\nContent Guidelines:\n• Duration: 15–45 seconds\n• Platform: Instagram (Reels) / YouTube Shorts\n• Mention brand handle & use provided hashtags\n• Include CTA: "Check out the link / visit the brand page"\n\nDeliverables:\n• 1 Reel + optional Story (if agreed)\n• Share insights (views, reach, engagement) after posting\n\nTimeline:\n• Content to be posted within 5–7 days / on selected date Range days after product delivery / brief approval\n\nPayment:\n• Fixed payment: ₹XXXX (as agreed)\n• Payment will be processed after content submission/approval\n\nImportant Notes:\n• Content should be original and not reused from past posts\n• Brand reserves the right to request minor edits before posting\n• No offensive or misleading content`,
    product: `We are offering a product-based collaboration where influencers receive our product in exchange for content creation.\n\nWhat you'll receive:\n• Free product worth ₹XXXX\n• Delivered to your address after acceptance\n\nWhat we expect:\n• Create 1 Reel / Post featuring the product\n• Showcase real usage, experience, or styling\n• Keep content authentic and engaging\n\nContent Guidelines:\n• Platform: Instagram / YouTube Shorts (as selected)\n• Tag our brand account & use provided hashtags\n• Mention this is a collaboration (#gifted / #collab)\n\nDeliverables:\n• 1 Reel OR Post (based on your selection)\n• Optional Story (if comfortable)\n\nTimeline:\n• Post within 5–7 days / on selected date Range, after receiving the product\n\nImportant Notes:\n• No monetary payment is involved in this collaboration\n• Content should be original and not reused\n• Brand may request minor edits before posting`,
    invite_location: `We are inviting influencers to attend an exclusive on-location experience at our venue and create engaging content around it.\n\nEvent Details:\n• 📍 Location: [Venue / Address]\n• 📅 Date: [Event Date]\n• ⏰ Time: [Start – End Time]\n\nWhat you'll experience:\n• Access to our venue/event (e.g., restaurant launch, store opening, experience zone)\n• Complimentary services/products during the visit\n\nWhat we expect:\n• Visit the location during the scheduled time\n• Create live or post-event content based on your experience\n• Capture ambience, product/service, and overall vibe\n\nContent Guidelines:\n• Platform: Instagram / YouTube (as selected)\n• Tag our brand account & location\n• Use provided hashtags\n• Maintain authentic storytelling (no forced promotion)\n\nDeliverables:\n• 1 Reel or Post from the location\n• Optional Stories during visit (preferred)\n\nTimeline:\n• Stories: during the visit\n• Reel/Post: within 2–3 days after visit\n\nImportant Notes:\n• This is an invite-only collaboration (no product shipping)\n• Influencers must confirm availability before acceptance\n• If unable to attend after accepting, inform in advance\n• Only influencers who attend the location will be eligible for collaboration benefits`,
  };

  readonly SPECIAL_INSTRUCTIONS_EXAMPLES: Record<string, string> = {
    paid_collab: `Dos:\n• Mention the brand name at least once in the video/caption\n• Use the hashtags: #[BrandHashtag] #[CampaignHashtag]\n• Keep the tone conversational — no hard selling\n• Post on the agreed date (or within the selected date range)\n\nDon'ts:\n• Do not post competitor brand content in the same week\n• Do not use filters that alter the product's appearance\n• Do not repost content previously used for another brand\n\nMust include:\n• Brand handle tag: @[BrandHandle]\n• CTA: "Check out the link in bio / visit our page"\n• Story reshare of the post (if Instagram)`,
    product: `Dos:\n• Unbox or showcase the product naturally on camera\n• Highlight your genuine experience / first impression\n• Use hashtags: #[BrandHashtag] #gifted #collab\n• Tag our account: @[BrandHandle]\n\nDon'ts:\n• Do not compare with competitor products\n• Do not make claims about benefits not listed on the product\n• Do not post before the agreed go-live date\n\nMust mention:\n• This is a gifted collaboration (#gifted)\n• At least one key benefit or use-case of the product`,
    invite_location: `Before the visit:\n• Confirm attendance at least 24 hours in advance\n• Carry your equipment (phone/camera) — lighting will be arranged on-site\n\nDuring the visit:\n• Create at least 1 Instagram Story from the location (tag us live)\n• Capture ambience, product/service, and your experience\n\nDon'ts:\n• Do not visit without a confirmed booking\n• Do not bring external teams without prior approval\n\nAfter the visit:\n• Post Reel/content within 2–3 days\n• Share post insights (reach, views) once live`,
  };

  applySpecialInstructionsExample(): void {
    const example = this.SPECIAL_INSTRUCTIONS_EXAMPLES[this.selectedCampaignType];
    if (example) {
      this.form.patchValue({ specialInstructions: example });
    }
  }

  private readonly AUTO_NOTE_SEP = '\n\n---\n';
  private readonly AUTO_NOTES: Record<string, string> = {
    product_only: 'Note: This is a product-based collaboration. No monetary payment is included.',
    product_plus_payment: 'Note: This collaboration includes product + payment.',
    invite_location: 'Note: Only influencers who attend the location will be eligible for collaboration benefits.',
  };

  applyDescriptionTemplate(): void {
    const template = this.DESCRIPTION_TEMPLATES[this.selectedCampaignType];
    if (template) {
      this.form.patchValue({ description: template });
      if (this.selectedCampaignType === 'product') {
        this.syncDescriptionCollabNote(String(this.f['productPaymentMode'].value || 'product_only'));
      } else if (this.selectedCampaignType === 'invite_location') {
        this.syncDescriptionCollabNote('invite_location');
      }
    }
  }

  private syncDescriptionCollabNote(mode: string): void {
    if (this.selectedCampaignType !== 'product' && this.selectedCampaignType !== 'invite_location') return;
    const ctrl = this.form.get('description');
    if (!ctrl) return;
    let desc: string = ctrl.value || '';
    // Strip any existing auto-note
    const sepIdx = desc.indexOf(this.AUTO_NOTE_SEP);
    if (sepIdx !== -1) desc = desc.substring(0, sepIdx);
    desc = desc.trimEnd();
    const note = this.AUTO_NOTES[mode];
    if (note) desc += this.AUTO_NOTE_SEP + note;
    ctrl.setValue(desc, { emitEvent: false });
  }
  categoriesList: any[] = [];
  states: any[] = [];
  districts: any[] = [];
  targetDistricts: any[] = [];
  selectedCategories: string[] = [];
  selectedPlatforms: string[] = [];
  activePlatformTab = '';
  platformDeliverables: { platform: string; contentTypes: { name: string; enabled: boolean; price: number | null }[] }[] = [];
  platformsList: any[] = [];
  protected tierInfo = inject(TierInfoService);
  protected flowHelp = inject(FlowHelpModalService);
  constructor(private fb: FormBuilder, private config: ConfigService, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    this.currentBrandName = this.readCurrentBrandName();
    this.form = this.fb.group({
      title: [this.campaign?.title || '', [Validators.required, Validators.minLength(3)]],
      brandName: [this.currentBrandName],
      description: [this.campaign?.description || ''],
      deliverablesText: [Array.isArray((this.campaign as any)?.deliverables) ? (this.campaign as any).deliverables.join('\n') : ''],
      campaignType: [(this.campaign as any)?.campaignType || 'paid_collab', [Validators.required]],
      campaignMode: [(this.campaign as any)?.campaignMode || 'invite_only', [Validators.required]],
      status: [this.campaign?.status || 'draft'],
      pricePerInfluencer: [this.getInitialPricePerInfluencer(), [Validators.required, Validators.min(1)]],
      maxInfluencers: [(this.campaign as any)?.maxInfluencers || null, [Validators.required, Validators.min(1)]],
      minInfluencers: [
        (this.campaign as any)?.minInfluencers || (this.campaign as any)?.maxInfluencers || null,
        [Validators.required, Validators.min(1)],
      ],
      acceptanceDeadline: [this.formatDateTimeLocal((this.campaign as any)?.acceptanceDeadline)],
      timelineStart: [this.formatDate(this.campaign?.timelineStart), Validators.required],
      timelineEnd: [this.formatDate(this.campaign?.timelineEnd), Validators.required],
      minInfluencerTier: [(this.campaign as any)?.minInfluencerTier || ''],
      targetState: [(this.campaign as any)?.targetState || ''],
      targetDistrict: [(this.campaign as any)?.targetCities?.[0] || ''],
      platformPreference: [this.campaign?.platformPreference || ''],
      specialInstructions: [this.campaign?.specialInstructions || ''],
      venueName: [(this.campaign as any)?.venueName || ''],
      venueAddress: [(this.campaign as any)?.venueAddress || ''],
      venueCity: [(this.campaign as any)?.venueCity || ''],
      venueDistrict: [(this.campaign as any)?.venueDistrict || ''],
      venueState: [(this.campaign as any)?.venueState || ''],
      venueGoogleMapUrl: [(this.campaign as any)?.venueGoogleMapUrl || ''],
      payToJoinBenefits: [(this.campaign as any)?.payToJoinBenefits || ''],
      payToJoinInstructions: [(this.campaign as any)?.payToJoinInstructions || ''],
      productValue: [this.getInitialProductValue()],
      productDescription: [(this.campaign as any)?.productDescription || ''],
      productPaymentMode: [(this.campaign as any)?.productPaymentMode || 'product_only'],
      productPaymentAmount: [this.getInitialProductPaymentAmount()],
      productShippingRequired: [!!(this.campaign as any)?.productShippingRequired],
      inviteBenefits: [(this.campaign as any)?.inviteBenefits || ''],
    }, { validators: [this.dateRangeValidator, this.minMaxInfluencerValidator] });

    this.applyCampaignTypeValidators(String(this.f['campaignType']?.value || ''));
    // Coerce non-premium brands back to paid_collab if a premium-only type is somehow selected
    if (!this.hasPremium && this.isPremiumOnlyType(String(this.f['campaignType']?.value || ''))) {
      this.form.patchValue({ campaignType: 'paid_collab' }, { emitEvent: false });
      this.applyCampaignTypeValidators('paid_collab');
    }
    this.form.get('campaignType')?.valueChanges.subscribe((type: string) => {
      const t = String(type || '');
      if (!this.hasPremium && this.isPremiumOnlyType(t)) {
        // Block selection at the form level (UI also disables the option, but be defensive)
        this.form.patchValue({ campaignType: 'paid_collab' }, { emitEvent: false });
        this.applyCampaignTypeValidators('paid_collab');
        return;
      }
      this.applyCampaignTypeValidators(t);
    });
    this.form.get('productPaymentMode')?.valueChanges.subscribe((mode: string) => {
      this.syncDescriptionCollabNote(mode);
      this.applyCampaignTypeValidators(String(this.f['campaignType']?.value || ''));
    });

    // Load states and (when state selected) districts
    this.config.getStates().subscribe({
      next: (data: any[]) => {
        this.states = Array.isArray(data) ? data : [];
        // If editing with an existing venueState, fetch venue districts
        const currentState = this.form.get('venueState')?.value;
        if (currentState) this.loadDistrictsFor(currentState);
        // If editing with an existing targetState, fetch target districts
        const currentTargetState = this.form.get('targetState')?.value;
        if (currentTargetState) this.loadTargetDistrictsFor(currentTargetState);
        this.cd.detectChanges();
      },
      error: () => { this.states = []; }
    });

    this.form.get('venueState')?.valueChanges.subscribe((stateName: string) => {
      // Reset district when state changes (but only if user changed it after init)
      const existingDistrict = (this.campaign as any)?.venueDistrict || '';
      const isEditingSameState = this.isEdit && stateName === ((this.campaign as any)?.venueState || '');
      if (!isEditingSameState) {
        this.form.get('venueDistrict')?.setValue('', { emitEvent: false });
      }
      this.loadDistrictsFor(stateName);
      // Re-apply edit-mode preset once districts load
      if (isEditingSameState && existingDistrict) {
        setTimeout(() => this.form.get('venueDistrict')?.setValue(existingDistrict, { emitEvent: false }), 0);
      }
    });

    this.form.get('targetState')?.valueChanges.subscribe((stateName: string) => {
      this.form.get('targetDistrict')?.setValue('', { emitEvent: false });
      this.loadTargetDistrictsFor(stateName);
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

    this.config.getCategories('influencer').subscribe(data => {
      this.categoriesList = data;
      this.cd.detectChanges();
    });

    this.config.getSocialMedia().subscribe(data => {
      this.platformsList = Array.isArray(data) ? data : [];
      this.cd.detectChanges();
    });

  }

  get isEdit(): boolean { return this.mode === 'edit'; }

  get isEditingForReview(): boolean {
    const s = String(this.campaign?.status || '').toLowerCase();
    return this.isEdit && (s === 'draft' || s === 'needs_changes' || s === 'rejected');
  }
  get f() { return this.form.controls; }
  get selectedCampaignType(): string {
    return String(this.f['campaignType']?.value || 'paid_collab');
  }

  getTierOptionLabel(tier: string): string {
    const normalized = normalizeTierLabel(tier);
    const key = normalized.toLowerCase();
    const desc = TIER_DESC_MAP[key] || '';
    if (!desc) return normalized || String(tier || '');
    return `${normalized} (${desc})`;
  }

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

  private getInitialProductValue(): number | null {
    const paise = Number((this.campaign as any)?.productValue || 0);
    return paise > 0 ? Math.floor(paise / 100) : null;
  }

  private getInitialProductPaymentAmount(): number | null {
    const paise = Number((this.campaign as any)?.productPaymentAmount || 0);
    return paise > 0 ? Math.floor(paise / 100) : null;
  }

  private dateRangeValidator = (group: FormGroup) => {
    const start = group.get('timelineStart')?.value;
    const end = group.get('timelineEnd')?.value;
    const acceptanceDeadline = group.get('acceptanceDeadline')?.value;
    if (!start || !end) return null;
    if (new Date(end) < new Date(start)) return { invalidDateRange: true };
    if (acceptanceDeadline) {
      const acceptance = new Date(acceptanceDeadline);
      if (Number.isNaN(acceptance.getTime())) return { invalidAcceptanceDeadline: true };
      if (acceptance < new Date(start) || acceptance > new Date(end)) {
        return { invalidAcceptanceDeadlineRange: true };
      }
    }
    return null;
  };

  private minMaxInfluencerValidator = (group: FormGroup) => {
    const min = Number(group.get('minInfluencers')?.value || 0);
    const max = Number(group.get('maxInfluencers')?.value || 0);
    if (!min || !max) return null;
    return min <= max ? null : { invalidMinMaxInfluencers: true };
  };

  private readCurrentBrandName(): string {
    if (typeof window === 'undefined') return '';
    const keys = ['user', 'currentUser'];
    for (const key of keys) {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const name = String(parsed?.brandName || parsed?.name || '').trim();
        if (name) return name;
      } catch {
        // Ignore malformed cached values.
      }
    }
    return '';
  }

  private parseDeliverables(raw: string): string[] {
    return String(raw || '')
      .split(/\n|,/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  // ── Stepper helpers ──────────────────────────────────────────
  step1Valid(): boolean {
    const isLocation = this.selectedCampaignType === 'invite_location';
    return !!(
      this.f['title'].valid &&
      this.f['campaignType'].valid &&
      this.f['timelineStart'].value &&
      this.f['timelineEnd'].value &&
      (!isLocation || (this.f['venueAddress'].valid && this.f['venueState'].valid && this.f['venueDistrict'].valid && this.f['venueCity'].valid && this.f['inviteBenefits'].valid)) &&
      !this.form.errors?.['invalidDateRange']
    );
  }

  step2Valid(): boolean {
    const isPaid = this.selectedCampaignType === 'paid_collab' || this.selectedCampaignType === 'pay_to_join';
    const priceValid = !isPaid || (this.f['pricePerInfluencer'].value > 0 && this.f['pricePerInfluencer'].valid);
    return !!(
      priceValid &&
      this.f['maxInfluencers'].valid &&
      this.f['maxInfluencers'].value > 0 &&
      this.f['minInfluencers'].valid &&
      this.f['minInfluencers'].value > 0 &&
      !this.form.errors?.['invalidMinMaxInfluencers'] &&
      this.selectedCategories.length > 0 &&
      this.platformDeliverables.length > 0
    );
  }

  isPremiumOnlyType(type: string): boolean {
    return type === 'product' || type === 'invite_location';
  }

  private applyCampaignTypeValidators(type: string): void {
    const isLocation = type === 'invite_location';
    const isPayToJoin = type === 'pay_to_join';
    const isPaid = type === 'paid_collab';
    const isProduct = type === 'product';

    // Price per influencer: required only for paid_collab and pay_to_join
    const priceValidators = (isPaid || isPayToJoin) ? [Validators.required, Validators.min(1)] : [];
    this.form.get('pricePerInfluencer')?.setValidators(priceValidators);

    this.form.get('venueAddress')?.setValidators(isLocation ? [Validators.required, Validators.minLength(5)] : []);
    this.form.get('venueState')?.setValidators(isLocation ? [Validators.required] : []);
    this.form.get('venueDistrict')?.setValidators(isLocation ? [Validators.required] : []);
    this.form.get('venueCity')?.setValidators(isLocation ? [Validators.required] : []);
    this.form.get('inviteBenefits')?.setValidators(isLocation ? [Validators.required, Validators.minLength(3)] : []);
    this.form.get('payToJoinBenefits')?.setValidators(isPayToJoin ? [Validators.required, Validators.minLength(5)] : []);

    // Product: description required; productValue optional
    this.form.get('productDescription')?.setValidators(isProduct ? [Validators.required, Validators.minLength(3)] : []);

    // Product cash amount required only when product + product_plus_payment
    const mode = String(this.form.get('productPaymentMode')?.value || 'product_only');
    const needsProductCash = isProduct && mode === 'product_plus_payment';
    this.form.get('productPaymentAmount')?.setValidators(needsProductCash ? [Validators.required, Validators.min(1)] : []);

    [
      'pricePerInfluencer', 'venueAddress', 'venueState', 'venueDistrict', 'venueCity', 'inviteBenefits',
      'payToJoinBenefits', 'productDescription', 'productPaymentAmount'
    ].forEach(name => this.form.get(name)?.updateValueAndValidity({ emitEvent: false }));
    this.cd.markForCheck();
  }

  private loadDistrictsFor(stateValue: string) {
    if (!stateValue) {
      this.districts = [];
      this.cd.detectChanges();
      return;
    }
    const sel = (this.states || []).find((s: any) => s?.name === stateValue || s?._id === stateValue || s?.id === stateValue);
    const stateName = sel?.name || stateValue;
    const stateId = sel?._id || sel?.id || '';
    this.config.getDistricts(stateName, stateId).subscribe({
      next: (data: any[]) => { this.districts = Array.isArray(data) ? data : []; this.cd.detectChanges(); },
      error: () => { this.districts = []; this.cd.detectChanges(); }
    });
  }

  private loadTargetDistrictsFor(stateValue: string) {
    if (!stateValue) {
      this.targetDistricts = [];
      this.cd.detectChanges();
      return;
    }
    const sel = (this.states || []).find((s: any) => s?.name === stateValue || s?._id === stateValue || s?.id === stateValue);
    const stateName = sel?.name || stateValue;
    const stateId = sel?._id || sel?.id || '';
    this.config.getDistricts(stateName, stateId).subscribe({
      next: (data: any[]) => { this.targetDistricts = Array.isArray(data) ? data : []; this.cd.detectChanges(); },
      error: () => { this.targetDistricts = []; this.cd.detectChanges(); }
    });
  }

  private sanitizeCampaignTypeFields(payload: any): any {
    const t = String(payload?.campaignType || '');
    if (t !== 'invite_location') {
      payload.venueName = undefined;
      payload.venueAddress = undefined;
      payload.venueCity = undefined;
      payload.venueDistrict = undefined;
      payload.venueState = undefined;
      payload.venueGoogleMapUrl = undefined;
      payload.inviteBenefits = undefined;
    }
    if (t !== 'pay_to_join') {
      payload.payToJoinBenefits = undefined;
      payload.payToJoinInstructions = undefined;
    }
    if (t !== 'product') {
      payload.productValue = undefined;
      payload.productDescription = undefined;
      payload.productPaymentMode = undefined;
      payload.productPaymentAmount = undefined;
    } else {
      // Convert rupees → paise for product money fields
      if (payload.productValue !== undefined && payload.productValue !== null && payload.productValue !== '') {
        payload.productValue = Math.round(Number(payload.productValue) * 100);
      } else {
        payload.productValue = undefined;
      }
      if (payload.productPaymentMode === 'product_plus_payment'
        && payload.productPaymentAmount !== undefined
        && payload.productPaymentAmount !== null
        && payload.productPaymentAmount !== '') {
        payload.productPaymentAmount = Math.round(Number(payload.productPaymentAmount) * 100);
      } else {
        payload.productPaymentAmount = undefined;
        if (payload.productPaymentMode !== 'product_plus_payment') {
          payload.productPaymentMode = 'product_only';
        }
      }
    }
    // For non-paid types, do not send a 0 / null pricePerInfluencer (backend rejects 0)
    if (t !== 'paid_collab' && t !== 'pay_to_join') {
      if (!payload.pricePerInfluencer || Number(payload.pricePerInfluencer) <= 0) {
        payload.pricePerInfluencer = undefined;
      }
    }
    return payload;
  }

  goToStep(step: number) {
    if (step === 2 && !this.step1Valid()) {
      this.form.markAllAsTouched();
      return;
    }
    if (step === 3 && !this.step2Valid()) {
      this.form.get('pricePerInfluencer')?.markAsTouched();
      this.form.get('maxInfluencers')?.markAsTouched();
      this.form.get('minInfluencers')?.markAsTouched();
      this.categoriesTouched = true;
      this.platformsTouched = true;
      this.cd.detectChanges();
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
    // Hide influencers who are already invited (non-declined) for this campaign
    if (this.campaignInvites?.length) {
      list = list.filter(inf => !this.isInfluencerInvited(inf));
    }
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
    if (this.filterTier) {
      const activeTier = this.normalizeTierLabel(this.filterTier);
      list = list.filter(inf => this.getInfluencerTier(inf) === activeTier);
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

  private normalizeTierLabel(tier: string): string { return normalizeTierLabel(tier); }

  getInfluencerTier(inf: any): string { return getInfluencerPrimaryTier(inf); }

  getAvailableTierFilters(): string[] {
    const found = new Set<string>();
    this.allInfluencers.forEach(inf => {
      const t = this.getInfluencerTier(inf);
      if (t) found.add(t);
    });
    return this.tierOrder.filter(t => found.has(t));
  }

  private isDefaultAvatarUrl(url: string): boolean {
    const u = (url || '').toLowerCase();
    return u.includes('default-profile')
      || u.includes('default-avatar')
      || u.includes('default_profile')
      || u.includes('defaultprofile')
      || u.includes('placeholder')
      || u.includes('profile-brands')
      || u.includes('trendstarz-logo')
      || u.includes('/logo')
      || u.includes('logo.')
      || u.includes('brand-logo')
      || u.includes('site-logo')
      || (u.includes('trendstarz') && u.includes('logo'));
  }

  getInfluencerAvatar(inf: any): string {
    const candidates: string[] = [];
    if (Array.isArray(inf?.profileImages) && inf.profileImages.length > 0) {
      if (typeof inf.profileImages[0]?.url === 'string') candidates.push(inf.profileImages[0].url);
      if (typeof inf.profileImages[0] === 'string') candidates.push(inf.profileImages[0]);
    }
    if (typeof inf?.profileImage === 'string') candidates.push(inf.profileImage);
    if (typeof inf?.profilePicture === 'string') candidates.push(inf.profilePicture);
    if (typeof inf?.avatar === 'string') candidates.push(inf.avatar);

    for (const candidate of candidates) {
      const trimmed = (candidate || '').trim();
      if (trimmed && !this.isDefaultAvatarUrl(trimmed)) return trimmed;
    }
    return '';
  }

  getInfluencerInitials(inf: any): string {
    const name = String(inf?.fullName || inf?.name || inf?.username || '?').trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase() || '?';
    const first = parts[0].charAt(0).toUpperCase() || '';
    const last = parts[parts.length - 1].charAt(0).toUpperCase() || '';
    return (first + last) || first || '?';
  }

  getInitialsColor(name: string): string {
    const colors = ['#e8612d', '#2b6cb0', '#22b37a', '#805ad5', '#d69e2e', '#c53030', '#2c7a7b', '#b7791f'];
    const n = String(name || '').trim();
    if (!n) return colors[0];
    let hash = 0;
    for (let i = 0; i < n.length; i++) hash = n.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  getPlatformTags(inf: any): string[] {
    const social = Array.isArray(inf?.socialMedia) ? inf.socialMedia : [];
    const normalized = social.map((s: any) => {
      const p = String(s?.platform || '').toLowerCase();
      const lbl = p.includes('youtube') ? 'YT'
        : p.includes('instagram') ? 'IG'
        : p === 'x' || p.includes('twitter') ? 'X'
        : p.includes('facebook') ? 'FB'
        : p.includes('linkedin') ? 'IN'
        : p.includes('tiktok') ? 'TT'
        : String(s?.platform || '').slice(0, 2).toUpperCase();
      const tier = String(s?.tier || '').trim() || 'Not set';
      return { lbl, tier };
    });

    const order = ['IG', 'YT', 'X', 'FB', 'IN', 'TT'];
    normalized.sort((a: any, b: any) => {
      const ia = order.indexOf(a.lbl);
      const ib = order.indexOf(b.lbl);
      const va = ia === -1 ? 99 : ia;
      const vb = ib === -1 ? 99 : ib;
      return va - vb;
    });

    return normalized.slice(0, 2).map((x: any) => `${x.lbl} · ${x.tier}`);
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
    if (max > 0 && this.takenSlotsCount >= max) {
      this.selectionLimitError = `You can select up to ${max} influencers only (already invited: ${this.invitedCount}).`;
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

  private formatDateTimeLocal(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const tzOffsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
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
    // For tier_filtered_open publish immediately; otherwise save as draft
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.uploading = true;
    const v = this.form.value;
    const pricePerInfluencerPaise = v.pricePerInfluencer ? Math.round(Number(v.pricePerInfluencer) * 100) : 0;
    const isTierOpen = v.campaignMode === 'tier_filtered_open';
    const originalStatus = String(this.campaign?.status || 'draft').toLowerCase();
    const isResubmit = this.isEdit && (originalStatus === 'draft' || originalStatus === 'needs_changes' || originalStatus === 'rejected');
    const payload: any = {
      ...v,
      pricePerInfluencer: pricePerInfluencerPaise,
      status: (isTierOpen || isResubmit) ? 'pending_review' : 'draft',
      deliverables: this.parseDeliverables(v.deliverablesText),
      targetCities: v.targetDistrict ? [v.targetDistrict] : [],
      targetDistrict: undefined,
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
    };
    payload.acceptanceDeadline = payload.acceptanceDeadline
      ? new Date(payload.acceptanceDeadline).toISOString()
      : undefined;
    this.sanitizeCampaignTypeFields(payload);
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
      status: 'pending_review',
      deliverables: this.parseDeliverables(v.deliverablesText),
    };
    payload.acceptanceDeadline = payload.acceptanceDeadline
      ? new Date(payload.acceptanceDeadline).toISOString()
      : undefined;
    this.sanitizeCampaignTypeFields(payload);
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
    return this.campaignInvites.some(i => {
      const status = String(i?.status || '').toLowerCase();
      if (status === 'declined') return false;
      const inviteInfId = String(i.influencerId?._id || i.influencerId || '');
      return inviteInfId === String(inf?._id || '');
    });
  }
}

