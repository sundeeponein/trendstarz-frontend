import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Campaign, CampaignInfluencer } from '../campaign.model';
import { ConfigService } from '../../config.service';
import { environment } from '../../../../environments/environment';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { TierInfoService } from '../../components/tier-info-modal/tier-info.service';
import { FlowHelpModalService } from '../../components/flow-help-modal/flow-help-modal.service';
import { CampaignGuideModalService, CampaignGuideContent } from '../../components/campaign-guide-modal/campaign-guide-modal.service';
import { CampaignGuideModalComponent } from '../../components/campaign-guide-modal/campaign-guide-modal.component';
import { TIER_ORDER, TIER_DESC_MAP, normalizeTierLabel, getInfluencerPrimaryTier } from '../../tiers.constants';
import { ToastService } from '../../toast/toast.service';
import { getRequiredFields, CampaignRequiredFieldsCtx } from '../campaign-required-fields';



@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, UserAvatarComponent, CampaignGuideModalComponent],
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
  @Input() creatorRole: 'brand' | 'photographer' = 'brand';
  @Output() save = new EventEmitter<Partial<Campaign> & {
    inviteInfluencerIds?: string[];
    inviteRecipientIds?: string[];
    inviteRecipientRole?: 'influencer' | 'photographer';
  }>();
  @Output() cancel = new EventEmitter<void>();
  form!: FormGroup;

  // ── Step 3 invite recipients ─────────────────────────────────
  allInfluencers: any[] = [];
  allPhotographers: any[] = [];
  influencersLoading = false;
  photographersLoading = false;
  influencerSearch = '';
  selectedInfluencerIds = new Set<string>();
  inviteRecipientRole: 'influencer' | 'photographer' = 'influencer';
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
    invite_location: `We are inviting influencers to attend an exclusive on-location experience and create engaging content around it.\n\nEvent Details:\n• 📍 Area/Locality: [City / Locality]\n• 📅 Date: [Event Date]\n• ⏰ Time: [Start – End Time]\n\nWhat you'll experience:\n• Access to our venue/event (e.g., restaurant launch, store opening, experience zone)\n• Complimentary services/products during the visit\n\nWhat we expect:\n• Visit the location during the scheduled time\n• Create live or post-event content based on your experience\n• Capture ambience, product/service, and overall vibe\n\nContent Guidelines:\n• Platform: Instagram / YouTube (as selected)\n• Tag our brand account & location\n• Use provided hashtags\n• Maintain authentic storytelling (no forced promotion)\n\nDeliverables:\n• 1 Reel or Post from the location\n• Optional Stories during visit (preferred)\n\nTimeline:\n• Stories: during the visit\n• Reel/Post: within 2–3 days after visit\n\nImportant Notes:\n• This is an invite-only collaboration (no product shipping)\n• Influencers must confirm availability before acceptance\n• Exact venue details unlock after collaboration confirmation\n• Only influencers who attend the location will be eligible for collaboration benefits`,
  };

  readonly DESCRIPTION_MODE_EXAMPLES: Record<string, string> = {
    invite_only: `Access mode note:\n• Invite only: you will manually shortlist and invite recipients in Step 3.`,
    tier_filtered_open: `Access mode note:\n• Open to all (with filters): eligible influencers can discover and apply; you review applications in Campaigns.`,
  };

  readonly SPECIAL_INSTRUCTIONS_EXAMPLES: Record<string, string> = {
    paid_collab: `Dos:\n• Mention the brand name at least once in the video/caption\n• Use the hashtags: #[BrandHashtag] #[CampaignHashtag]\n• Keep the tone conversational — no hard selling\n• Post on the agreed date (or within the selected date range)\n\nDon'ts:\n• Do not post competitor brand content in the same week\n• Do not use filters that alter the product's appearance\n• Do not repost content previously used for another brand\n\nMust include:\n• Brand handle tag: @[BrandHandle]\n• CTA: "Check out the link in bio / visit our page"\n• Story reshare of the post (if Instagram)`,
    product: `Dos:\n• Unbox or showcase the product naturally on camera\n• Highlight your genuine experience / first impression\n• Use hashtags: #[BrandHashtag] #gifted #collab\n• Tag our account: @[BrandHandle]\n\nDon'ts:\n• Do not compare with competitor products\n• Do not make claims about benefits not listed on the product\n• Do not post before the agreed go-live date\n\nMust mention:\n• This is a gifted collaboration (#gifted)\n• At least one key benefit or use-case of the product`,
    invite_location: `Before the visit:\n• Confirm attendance at least 24 hours in advance\n• Carry your equipment (phone/camera) — lighting will be arranged on-site\n\nDuring the visit:\n• Create at least 1 Instagram Story from the location (tag us live)\n• Capture ambience, product/service, and your experience\n\nDon'ts:\n• Do not visit without a confirmed booking\n• Do not bring external teams without prior approval\n\nAfter the visit:\n• Post Reel/content within 2–3 days\n• Share post insights (reach, views) once live`,
  };

  readonly SPECIAL_INSTRUCTIONS_MODE_EXAMPLES: Record<string, string> = {
    invite_only: `Mode: Invite only\n• Manually shortlist and invite recipients in Step 3\n• Keep acceptance criteria explicit to avoid back-and-forth\n• Mention expected response timeline from invited recipients`,
    tier_filtered_open: `Mode: Open to all (with filters)\n• Mention minimum tier and optional location constraints\n• Clarify that eligible creators apply and you'll review applicants\n• Add how quickly applications will be reviewed`,
  };

  getSpecialInstructionsExample(): string {
    const typeKey = this.selectedCampaignType;
    const modeKey = String(this.f['campaignMode']?.value || 'invite_only');
    const base = this.SPECIAL_INSTRUCTIONS_EXAMPLES[typeKey] || '';
    const mode = this.SPECIAL_INSTRUCTIONS_MODE_EXAMPLES[modeKey] || '';
    if (base && mode) return `${base}\n\n${mode}`;
    return base || mode;
  }

  /**
   * Opens a popup with guideline + copyable example brief based on the
   * currently selected campaign type and invite-recipient role. The user can
   * copy individual sections (or all) and paste into the description field.
   */
  openDescriptionGuide(): void {
    const type = this.selectedCampaignType;
    const invitingPhotographers = this.isInvitingPhotographers;
    const audience = invitingPhotographers ? 'photo/videographers' : 'influencers';
    const audienceSingular = invitingPhotographers ? 'creator' : 'influencer';
    const modeKey = String(this.f['campaignMode']?.value || 'invite_only');
    const modeNote = this.DESCRIPTION_MODE_EXAMPLES[modeKey] || '';

    const content: CampaignGuideContent = {
      title: 'Campaign description — guide & examples',
      subtitle: `Read the points below and copy any block into your description. Tailored for ${audience}.`,
      sections: [],
    };

    if (type === 'paid_collab') {
      content.sections.push({
        heading: 'What to cover in your description',
        variant: 'tip',
        copyable: false,
        body: `• Goal of the collaboration (launch, awareness, conversions)\n• What the ${audienceSingular} will create (format, length)\n• Tone and creative direction (do/don't)\n• Any platform / hashtag / CTA requirements\n\nDeliverables, timeline and payment are captured in the form fields below — you do not need to repeat them in the description.`,
      });
      content.sections.push({
        heading: invitingPhotographers ? 'Sample brief (Paid creative requirement)' : 'Sample brief (Paid collaboration)',
        body: invitingPhotographers
          ? `What we expect:\n• 1 short-form video (Reel / Short) showcasing the product\n• Highlight key features in your own style\n• Maintain a natural, audience-friendly tone\n\nContent Guidelines:\n• Duration: 15–45 seconds\n• Vertical 9:16 format preferred\n• Mention brand handle & provided hashtags\n• Include CTA: "Check link in bio / visit our page"`
          : `What we expect:\n• Create 1 Reel / Short Video showcasing the product\n• Highlight key benefits, usage, or experience in your own style\n• Maintain a natural, audience-friendly tone (no hard selling)\n\nContent Guidelines:\n• Duration: 15–45 seconds\n• Platform: Instagram (Reels) / YouTube Shorts\n• Mention brand handle & use provided hashtags\n• Include CTA: "Check out the link / visit the brand page"`,
      });
      content.sections.push({
        heading: 'Important notes',
        body: `• Content should be original and not reused from past posts\n• Brand reserves the right to request minor edits before posting\n• No offensive or misleading content`,
      });
    } else if (type === 'product') {
      const paymentMode = String(this.f['productPaymentMode']?.value || 'product_only');
      content.sections.push({
        heading: invitingPhotographers ? 'What "Product Collab" means for photo/videographers' : 'What "Product Collab" means',
        variant: 'tip',
        copyable: false,
        body: invitingPhotographers
          ? `Product Collab — You send a free product to the creator in exchange for a professional shoot / honest review content. No cash payment — the product itself is the compensation. Best suited for unboxing edits, product photography, lifestyle integrations and review reels.`
          : `Product Collab — You send a free product to the influencer in exchange for an honest review or post. No cash payment — the product itself is the compensation. Best for unboxing, reviews, and lifestyle integrations.`,
      });
      content.sections.push({
        heading: 'Sample brief (Product collaboration)',
        body: invitingPhotographers
          ? `We are offering a product-based creative requirement where photo/videographers receive our product to produce shoot content.\n\nWhat you'll receive:\n• Free product worth ₹XXXX\n• Delivered to your shoot address after acceptance\n\nWhat we expect:\n• 1 Reel / Short Video OR a photo set featuring the product\n• Showcase product styling, detailing, real usage\n• Provide raw + edited deliverables as agreed`
          : `We are offering a product-based collaboration where influencers receive our product in exchange for content creation.\n\nWhat you'll receive:\n• Free product worth ₹XXXX\n• Delivered to your address after acceptance\n\nWhat we expect:\n• Create 1 Reel / Post featuring the product\n• Showcase real usage, experience, or styling\n• Keep content authentic and engaging`,
      });
      content.sections.push({
        heading: 'Important notes',
        body: paymentMode === 'product_only'
          ? `• ${invitingPhotographers ? 'No monetary payment is involved — the product is the compensation' : 'No monetary payment is involved in this collaboration'}\n• Content should be original and not reused\n• Brand may request minor edits before posting`
          : `• In addition to the product, a cash component will be paid as per the campaign budget\n• Content should be original and not reused\n• Brand may request minor edits before posting`,
      });
      content.sections.push({
        heading: 'Shipping address',
        variant: 'info',
        copyable: false,
        body: `If "Product shipping required" is set to Yes, the accepted ${audienceSingular} will be asked to confirm their delivery address after accepting your invite. You do not need to collect it here.`,
      });
    } else if (type === 'invite_location') {
      content.sections.push({
        heading: 'What to cover',
        variant: 'tip',
        copyable: false,
        body: `• Area / locality and date + time window\n• What is provided on-site (access, food, services)\n• Expected coverage (stories, reel, post)\n• Tagging and hashtag requirements`,
      });
      content.sections.push({
        heading: 'Sample brief (Invite to location)',
        body: `We are inviting ${audience} to attend an exclusive on-location experience and create engaging content around it.\n\nEvent Details:\n• 📍 Area / Locality: [City / Locality]\n• 📅 Date: [Event Date]\n• ⏰ Time: [Start – End Time]\n\nWhat you'll experience:\n• Access to our venue/event\n• Complimentary services/products during the visit\n\nWhat we expect:\n• Visit the location during the scheduled time\n• Create live or post-event content\n• Capture ambience, product/service and overall vibe`,
      });
      content.sections.push({
        heading: 'Important notes',
        body: `• This is an invite-only collaboration (no product shipping)\n• ${invitingPhotographers ? 'Creators' : 'Influencers'} must confirm availability before acceptance\n• Only ${audience} who attend the location will be eligible for collaboration benefits`,
      });
    } else {
      content.sections.push({
        heading: 'Tips for writing a clear description',
        variant: 'tip',
        copyable: false,
        body: `• State the goal of the collaboration\n• Describe the content you expect (format, tone)\n• Mention any platform / hashtag / CTA requirements\n• Deliverables, timeline and payment go in the fields below — no need to repeat here.`,
      });
    }

    if (modeNote) {
      content.sections.push({
        heading: 'Access mode',
        variant: 'info',
        copyable: false,
        body: modeNote,
      });
    }

    this.guideModal.open(content);
  }

  /**
   * Opens a popup with dos, don'ts and must-include guidance for the
   * "Special instructions / brief" field, tailored to campaign type, access
   * mode and recipient role.
   */
  openSpecialInstructionsGuide(): void {
    const type = this.selectedCampaignType;
    const invitingPhotographers = this.isInvitingPhotographers;
    const modeKey = String(this.f['campaignMode']?.value || 'invite_only');
    const audienceSingular = invitingPhotographers ? 'creator' : 'influencer';

    const content: CampaignGuideContent = {
      title: 'Special instructions — guide & examples',
      subtitle: `Use these dos, don'ts and must-include points as a starting point for your brief. Copy any block and edit to match your brand.`,
      sections: [],
    };

    const typeExample = this.SPECIAL_INSTRUCTIONS_EXAMPLES[type];
    if (typeExample) {
      content.sections.push({
        heading: type === 'invite_location' ? 'Visit instructions (Dos / Don\'ts)' : 'Dos, Don\'ts and Must-include',
        body: invitingPhotographers
          ? typeExample.replace(/influencer/gi, audienceSingular)
          : typeExample,
      });
    } else {
      content.sections.push({
        heading: 'General brief structure',
        variant: 'tip',
        copyable: false,
        body: `Dos:\n• ...\n\nDon'ts:\n• ...\n\nMust include:\n• ...`,
      });
    }

    const modeExample = this.SPECIAL_INSTRUCTIONS_MODE_EXAMPLES[modeKey];
    if (modeExample) {
      content.sections.push({
        heading: 'Access-mode specific notes',
        variant: 'info',
        body: modeExample,
      });
    }

    this.guideModal.open(content);
  }
  // ── Photographer-specific ────────────────────────────────────
  readonly PHOTOGRAPHER_SERVICES = [
    'Reel Shoot', 'Video Editing', 'Product Photography',
    'Fashion Shoot', 'Drone Shoot', 'YouTube Video Shoot',
  ];
  readonly PHOTOGRAPHER_PRICING_OPTIONS = [
    'Starting Price', 'Per Hour', 'Per Project', 'Negotiable',
  ];
  readonly PHOTOGRAPHER_DELIVERABLES = [
    'Raw Footage', 'Edited Reels', 'Photos', 'Cinematic Video', 'Shorts',
  ];
  readonly SHOOT_LOCATION_TYPES_BRAND_TO_PHOTOGRAPHER = [
    { value: 'client_location', label: 'At brand location' },
    { value: 'pickup_point', label: 'At event venue' },
    { value: 'outdoor', label: 'Outdoor location' },
    { value: 'indoor', label: 'Studio arranged by brand' },
  ];
  readonly SHOOT_LOCATION_TYPES_PHOTOGRAPHER_TO_INFLUENCER = [
    { value: 'studio', label: 'At photographer studio' },
    { value: 'outdoor', label: 'Outdoor location' },
    { value: 'client_location', label: 'Client location' },
    { value: 'pickup_point', label: 'Event venue' },
  ];
  selectedPhotographerServices: string[] = [];
  selectedPhotographerPricing: string[] = [];
  selectedPhotographerDeliverables: string[] = [];
  photographerPricingPrices: { [key: string]: number | null } = {}; // Map of pricing type to price

  categoriesList: any[] = [];
  states: any[] = [];
  districts: any[] = [];
  targetDistricts: any[] = [];
  selectedCategories: string[] = [];
  selectedPlatforms: string[] = [];
  activePlatformTab = '';
  platformDeliverables: { platform: string; contentTypes: { name: string; enabled: boolean; price: number | null }[] }[] = [];
  platformsList: any[] = [];
  campaignTypeConfigs: Array<{
    key: string;
    label: string;
    ownerType: 'brand' | 'photographer';
    enabled: boolean;
    premiumOnly: boolean;
    sortOrder: number;
  }> = [];
  protected tierInfo = inject(TierInfoService);
  protected flowHelp = inject(FlowHelpModalService);
  protected guideModal = inject(CampaignGuideModalService);
  constructor(
    private fb: FormBuilder,
    private config: ConfigService,
    private cd: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.currentBrandName = this.readCurrentBrandName();
    this.form = this.fb.group({
      title: [this.campaign?.title || '', [Validators.required, Validators.minLength(3)]],
      brandName: [this.currentBrandName],
      description: [this.campaign?.description || ''],
      deliverablesText: [Array.isArray((this.campaign as any)?.deliverables) ? (this.campaign as any).deliverables.join('\n') : ''],
      campaignType: [(this.campaign as any)?.campaignType || 'paid_collab', [Validators.required]],
      inviteRecipientRole: [
        this.isPhotographerCreator ? 'influencer' : ((this.campaign as any)?.inviteRecipientRole || 'influencer'),
        [Validators.required],
      ],
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
      shootLocationType: [(this.campaign as any)?.shootLocationType || ''],
      shootLocationAddress: [(this.campaign as any)?.shootLocationAddress || ''],
      shootLocationMapUrl: [(this.campaign as any)?.shootLocationMapUrl || ''],
      shootLocationNotes: [(this.campaign as any)?.shootLocationNotes || ''],
      venueName: [(this.campaign as any)?.venueName || ''],
      venueAddress: [(this.campaign as any)?.venueAddress || (this.campaign as any)?.shootLocationAddress || ''],
      venueCity: [(this.campaign as any)?.venueCity || ''],
      venueDistrict: [(this.campaign as any)?.venueDistrict || ''],
      venueState: [(this.campaign as any)?.venueState || ''],
      venueGoogleMapUrl: [(this.campaign as any)?.venueGoogleMapUrl || (this.campaign as any)?.shootLocationMapUrl || ''],
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
    this.inviteRecipientRole = this.isPhotographerCreator
      ? 'influencer'
      : (String(this.f['inviteRecipientRole']?.value || 'influencer') === 'photographer' ? 'photographer' : 'influencer');
    this.loadCampaignTypeConfigs();
    // Coerce non-premium brands back to paid_collab if a premium-only type is somehow selected
    if (!this.hasPremium && this.isPremiumOnlyType(String(this.f['campaignType']?.value || ''))) {
      this.ensureCampaignTypeSelection();
    }
    this.form.get('campaignType')?.valueChanges.subscribe((type: string) => {
      const t = String(type || '');
      if (!this.hasPremium && this.isPremiumOnlyType(t)) {
        // Block selection at the form level (UI also disables the option, but be defensive)
        this.ensureCampaignTypeSelection();
        return;
      }
      this.applyCampaignTypeValidators(t);
    });
    this.form.get('productPaymentMode')?.valueChanges.subscribe(() => {
      this.applyCampaignTypeValidators(String(this.f['campaignType']?.value || ''));
    });
    // Remote shoots (creative_project) skip the address requirement \u2014 re-run validators
    // whenever the shoot location type changes.
    this.form.get('shootLocationType')?.valueChanges.subscribe(() => {
      this.applyCampaignTypeValidators(String(this.f['campaignType']?.value || ''));
    });

    this.form.get('inviteRecipientRole')?.valueChanges.subscribe((role: string) => {
      const normalized: 'influencer' | 'photographer' = role === 'photographer' ? 'photographer' : 'influencer';
      this.inviteRecipientRole = this.isPhotographerCreator ? 'influencer' : normalized;
      // Recipient change can flip whether shoot-location is required (brand→photographer needs it for paid/location).
      this.applyCampaignTypeValidators(String(this.f['campaignType']?.value || ''));
      this.selectedInfluencerIds.clear();
      this.selectionLimitError = '';
      this.loadRecipientCategories();
      if (this.currentStep === 3) {
        this.loadInviteRecipients();
      }
      this.cd.detectChanges();
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

    this.form.get('venueAddress')?.valueChanges.subscribe((value: string) => {
      if (!(this.isInvitingPhotographers || this.isPhotographerCreator)) return;
      this.form.get('shootLocationAddress')?.setValue(value || '', { emitEvent: false });
    });

    this.form.get('venueGoogleMapUrl')?.valueChanges.subscribe((value: string) => {
      if (!(this.isInvitingPhotographers || this.isPhotographerCreator)) return;
      this.form.get('shootLocationMapUrl')?.setValue(value || '', { emitEvent: false });
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

    this.loadRecipientCategories();

    this.config.getSocialMedia().subscribe(data => {
      this.platformsList = Array.isArray(data) ? data : [];
      this.cd.detectChanges();
    });

  }

  get isEdit(): boolean { return this.mode === 'edit'; }

  get isPhotographerCreator(): boolean {
    return this.creatorRole === 'photographer';
  }

  /**
   * Whether the shoot-location block should be shown.
   * - Photographer-led collabs: always (photographer specifies their studio/site).
   * - Brand → Photographer invites: only for Paid Collab and Invite to Location
   *   (Product Collab ships product TO the photographer's studio — no shoot site needed).
   */
  get showShootLocationBlock(): boolean {
    if (this.isPhotographerCreator) return true;
    if (!this.isInvitingPhotographers) return false;
    const type = String(this.form?.get('campaignType')?.value || '');
    return type === 'paid_collab' || type === 'invite_location';
  }

  get useStructuredVenueFields(): boolean {
    return this.showShootLocationBlock
      && String(this.form?.get('shootLocationType')?.value || '') !== 'remote'
      && (this.isInvitingPhotographers || this.isPhotographerCreator);
  }

  get shootLocationAudienceLabel(): string {
    return this.isInvitingPhotographers ? 'photographer' : 'influencer';
  }

  get formTitleNoun(): string {
    if (this.isPhotographerCreator) return 'Collaboration Request';
    return this.isInvitingPhotographers ? 'Creative Requirement' : 'Campaign';
  }

  get detailsStepLabel(): string {
    if (this.isPhotographerCreator) return 'Collaboration details';
    return this.isInvitingPhotographers ? 'Creative requirement details' : 'Campaign details';
  }

  get requirementsStepLabel(): string {
    return this.isInvitingPhotographers ? 'Creative brief' : 'Requirements';
  }

  get inviteStepLabel(): string {
    if (this.isPhotographerCreator) return 'Invite influencers';
    return this.isInvitingPhotographers ? 'Invite photographers' : 'Invite influencers';
  }

  get campaignTypeFieldLabel(): string {
    if (this.isPhotographerCreator) return 'Collaboration Type';
    return this.isInvitingPhotographers ? 'Requirement Type' : 'Campaign Type';
  }

  /**
   * Role-aware label for the shoot-location *type* dropdown. The underlying
   * form control name (`shootLocationType`) is photographer-centric; the
   * label is neutralised for non-photographer flows.
   */
  get shootLocationTypeLabel(): string {
    if (this.isInvitingPhotographers) return 'Shoot location type';
    if (this.isPhotographerCreator) return 'Shoot location type';
    return 'On-site location type';
  }

  /** Role-aware placeholder for the shoot-location *type* dropdown. */
  get shootLocationTypePlaceholder(): string {
    if (this.isInvitingPhotographers || this.isPhotographerCreator) {
      return 'Select shoot location type';
    }
    return 'Select on-site location type';
  }

  get shootLocationTypeOptions(): Array<{ value: string; label: string }> {
    if (this.isInvitingPhotographers) {
      return this.SHOOT_LOCATION_TYPES_BRAND_TO_PHOTOGRAPHER;
    }
    if (this.isPhotographerCreator) {
      return this.SHOOT_LOCATION_TYPES_PHOTOGRAPHER_TO_INFLUENCER;
    }
    return this.SHOOT_LOCATION_TYPES_BRAND_TO_PHOTOGRAPHER;
  }

  /** Role-aware label for the shoot-location *address* textarea. */
  get shootLocationAddressLabel(): string {
    if (this.isInvitingPhotographers || this.isPhotographerCreator) {
      return 'Shoot area / locality';
    }
    return 'On-site / meeting area';
  }

  /** Role-aware required-error label for the shoot-location address. */
  get shootLocationAddressErrorLabel(): string {
    if (this.isInvitingPhotographers || this.isPhotographerCreator) {
      return 'Shoot area / locality is required';
    }
    return 'On-site area is required';
  }

  get campaignModeFieldLabel(): string {
    if (this.isPhotographerCreator) return 'Collaboration access mode';
    return this.isInvitingPhotographers ? 'Requirement access mode' : 'Campaign access mode';
  }

  get inviteRecipientLabelSingular(): string {
    if (this.isPhotographerCreator) return 'Influencer';
    return this.inviteRecipientRole === 'photographer' ? 'Photo/Videographer' : 'Influencer';
  }

  get inviteRecipientLabelPlural(): string {
    if (this.isPhotographerCreator) return 'Influencers';
    return this.inviteRecipientRole === 'photographer' ? 'Photo/Videographers' : 'Influencers';
  }

  get inviteCandidates(): any[] {
    return this.inviteRecipientRole === 'photographer' ? this.allPhotographers : this.allInfluencers;
  }

  get isInvitingPhotographers(): boolean {
    return !this.isPhotographerCreator && this.inviteRecipientRole === 'photographer';
  }

  get inviteSelectionStepLabel(): string {
    return this.isPhotographerCreator ? 'Invite influencers' : `Invite ${this.inviteRecipientLabelPlural.toLowerCase()}`;
  }

  private loadRecipientCategories() {
    const role = this.isInvitingPhotographers ? 'photographer' : 'influencer';
    this.config.getCategories(role).subscribe({
      next: (data: any[]) => {
        this.categoriesList = Array.isArray(data) ? data : [];
        this.cd.detectChanges();
      },
      error: () => {
        if (role === 'photographer') {
          this.config.getCategories('influencer').subscribe({
            next: (fallback: any[]) => {
              this.categoriesList = Array.isArray(fallback) ? fallback : [];
              this.cd.detectChanges();
            },
            error: () => {
              this.categoriesList = [];
              this.cd.detectChanges();
            },
          });
        } else {
          this.categoriesList = [];
          this.cd.detectChanges();
        }
      },
    });
  }

  private loadCampaignTypeConfigs(): void {
    this.config.getCampaignTypeConfigs().subscribe({
      next: (items) => {
        this.campaignTypeConfigs = Array.isArray(items) ? items : [];
        this.ensureCampaignTypeSelection();
        this.cd.detectChanges();
      },
      error: () => {
        this.campaignTypeConfigs = [];
        this.ensureCampaignTypeSelection();
        this.cd.detectChanges();
      },
    });
  }

  private buildSyntheticCampaignTypeOption(
    ownerType: 'brand' | 'photographer',
    type: string,
  ): { value: string; label: string; premiumOnly?: boolean; enabled?: boolean } | null {
    const key = String(type || '').trim();
    if (!key) return null;

    const defaultLabel = key
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    return {
      value: key,
      label: ownerType === 'photographer' && key === 'paid_collab' ? 'Paid Shoot' : defaultLabel,
      premiumOnly: false,
      enabled: true,
    };
  }

  private ensureCampaignTypeSelection(): void {
    const selected = String(this.f['campaignType']?.value || '').trim();
    const options = this.getCampaignTypeOptions();
    if (!options.length) return;

    const isSelectable = (opt: { premiumOnly?: boolean; enabled?: boolean }) =>
      opt.enabled !== false && (this.hasPremium || !opt.premiumOnly);

    const selectedOption = options.find((opt) => opt.value === selected);
    if (selectedOption && isSelectable(selectedOption)) return;

    const fallback = options.find((opt) => isSelectable(opt)) || options[0];
    if (!fallback) return;

    this.form.patchValue({ campaignType: fallback.value }, { emitEvent: false });
    this.applyCampaignTypeValidators(String(fallback.value || ''));
  }

  getCampaignTypeOptions(): Array<{ value: string; label: string; premiumOnly?: boolean; enabled?: boolean }> {
    const ownerType: 'brand' | 'photographer' = this.isPhotographerCreator ? 'photographer' : 'brand';
    const selected = String(this.form?.get('campaignType')?.value || '').trim();
    const source = (this.campaignTypeConfigs || [])
      .filter((item) => item.ownerType === ownerType)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

    if (!source.length) {
      const fallback = this.buildSyntheticCampaignTypeOption(ownerType, selected);
      return fallback ? [fallback] : [];
    }

    const enabledItems = source.filter((item) => item.enabled !== false);
    const selectedDisabledItem = source.find((item) => item.key === selected && item.enabled === false);
    const finalItems = selectedDisabledItem ? [...enabledItems, selectedDisabledItem] : enabledItems;

    return finalItems.map((item) => ({
      value: item.key,
      label: item.label,
      premiumOnly: item.premiumOnly === true,
      enabled: item.enabled !== false,
    }));
  }

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
    const needsStructuredVenueAddress = this.useStructuredVenueFields;
    const photographerLocationValid = !this.isPhotographerCreator || this.f['shootLocationType'].valid;
    return !!(
      this.f['title'].valid &&
      this.f['campaignType'].valid &&
      (this.isPhotographerCreator || this.f['inviteRecipientRole'].valid) &&
      this.f['timelineStart'].value &&
      this.f['timelineEnd'].value &&
      photographerLocationValid &&
      (!needsStructuredVenueAddress || (
        this.f['venueAddress'].valid && this.f['venueState'].valid && this.f['venueDistrict'].valid && this.f['venueCity'].valid
      )) &&
      (!isLocation || (this.f['venueAddress'].valid && this.f['venueState'].valid && this.f['venueDistrict'].valid && this.f['venueCity'].valid && this.f['inviteBenefits'].valid)) &&
      !this.form.errors?.['invalidDateRange']
    );
  }

  step2Valid(): boolean {
    if (this.isPhotographerCreator) {
      const isPaid = this.selectedCampaignType === 'paid_collab' || this.selectedCampaignType === 'pay_to_join';
      const priceValid = !isPaid || (this.f['pricePerInfluencer'].value > 0 && this.f['pricePerInfluencer'].valid);
      return !!(
        priceValid &&
        this.f['maxInfluencers'].valid &&
        this.f['maxInfluencers'].value > 0 &&
        this.f['minInfluencers'].valid &&
        this.f['minInfluencers'].value > 0 &&
        !this.form.errors?.['invalidMinMaxInfluencers'] &&
        this.selectedPhotographerServices.length > 0 &&
        this.selectedPhotographerDeliverables.length > 0
      );
    }
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
      (this.isInvitingPhotographers || this.platformDeliverables.length > 0)
    );
  }

  isPremiumOnlyType(type: string): boolean {
    const t = String(type || '').trim();
    if (!t) return false;
    const ownerType: 'brand' | 'photographer' = this.isPhotographerCreator ? 'photographer' : 'brand';
    const source = this.campaignTypeConfigs || [];
    const config = source.find((item) => item.ownerType === ownerType && item.key === t);
    return !!config?.premiumOnly;
  }

  private applyCampaignTypeValidators(type: string): void {
    // Build the shared context — single source of truth for what's required.
    const ctx: CampaignRequiredFieldsCtx = {
      campaignType: type,
      ownerType: this.isPhotographerCreator ? 'photographer' : 'brand',
      inviteRecipientRole: this.inviteRecipientRole === 'photographer' ? 'photographer' : 'influencer',
      productPaymentMode: String(this.form.get('productPaymentMode')?.value || 'product_only'),
      shootLocationType: String(this.form.get('shootLocationType')?.value || ''),
    };
    const required = new Set(getRequiredFields(ctx));

    // Extra per-field constraints (min length / min value) layered on top of
    // the shared required flag.
    const extra: Record<string, any[]> = {
      pricePerInfluencer: [Validators.min(1)],
      venueAddress: [Validators.minLength(5)],
      inviteBenefits: [Validators.minLength(3)],
      payToJoinBenefits: [Validators.minLength(5)],
      productDescription: [Validators.minLength(3)],
      productPaymentAmount: [Validators.min(1)],
      shootLocationAddress: [Validators.minLength(3)],
    };

    const managedFields = [
      'pricePerInfluencer',
      'venueAddress', 'venueState', 'venueDistrict', 'venueCity', 'inviteBenefits',
      'payToJoinBenefits',
      'productDescription', 'productPaymentAmount',
      'shootLocationType', 'shootLocationAddress',
    ];

    for (const name of managedFields) {
      const control = this.form.get(name);
      if (!control) continue;
      const validators = [] as any[];
      if (required.has(name)) validators.push(Validators.required);
      const needsStructuredVenueAddress = this.useStructuredVenueFields;
      if (needsStructuredVenueAddress && ['venueAddress', 'venueState', 'venueDistrict', 'venueCity'].includes(name)) {
        validators.push(Validators.required);
      }
      if (extra[name]) validators.push(...extra[name]);
      control.setValidators(validators);
      control.updateValueAndValidity({ emitEvent: false });
    }

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
    // Preserve shoot-location fields for photographer-led collabs, and for brand→photographer invites
    // where the requirement type is Paid Collab or Invite to Location. Strip for everything else.
    const keepShootLocation = this.isPhotographerCreator
      || (this.isInvitingPhotographers && (t === 'paid_collab' || t === 'invite_location'));
    if (!keepShootLocation) {
      payload.shootLocationType = undefined;
      payload.shootLocationAddress = undefined;
      payload.shootLocationMapUrl = undefined;
      payload.shootLocationNotes = undefined;
    }
    if ((this.isInvitingPhotographers || this.isPhotographerCreator) && this.useStructuredVenueFields) {
      const addrParts = [payload.venueAddress, payload.venueCity, payload.venueDistrict, payload.venueState]
        .map((v: any) => String(v || '').trim())
        .filter(Boolean);
      if (addrParts.length) {
        payload.shootLocationAddress = addrParts.join(', ');
      }
      if (!payload.shootLocationMapUrl && payload.venueGoogleMapUrl) {
        payload.shootLocationMapUrl = payload.venueGoogleMapUrl;
      }
    }

    if (!(t === 'invite_location' || this.useStructuredVenueFields)) {
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
      this.loadInviteRecipients();
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

  // ── Photographer-specific toggles ────────────────────────────
  togglePhotographerService(s: string) {
    const idx = this.selectedPhotographerServices.indexOf(s);
    if (idx >= 0) this.selectedPhotographerServices.splice(idx, 1);
    else this.selectedPhotographerServices.push(s);
  }
  togglePhotographerPricing(p: string) {
    const idx = this.selectedPhotographerPricing.indexOf(p);
    if (idx >= 0) {
      this.selectedPhotographerPricing.splice(idx, 1);
      delete this.photographerPricingPrices[p]; // Clean up price when unselected
    } else {
      this.selectedPhotographerPricing.push(p);
      this.photographerPricingPrices[p] = null; // Initialize price field
    }
  }
  togglePhotographerDeliverable(d: string) {
    const idx = this.selectedPhotographerDeliverables.indexOf(d);
    if (idx >= 0) this.selectedPhotographerDeliverables.splice(idx, 1);
    else this.selectedPhotographerDeliverables.push(d);
  }



  // ── Invite recipients (step 3) ───────────────────────────────
  getRecipientId(recipient: any): string {
    return String(recipient?._id || recipient?.id || '').trim();
  }

  loadInviteRecipients() {
    if (this.inviteRecipientRole === 'photographer' && !this.isPhotographerCreator) {
      if (this.allPhotographers.length > 0) return;
      this.photographersLoading = true;
      this.config.getPhotographers().subscribe({
        next: (data: any[]) => {
          this.allPhotographers = (Array.isArray(data) ? data : [])
            .map((p: any) => ({ ...p, _id: p?._id || p?.id || '' }))
            .filter((p: any) => !!String(p?._id || '').trim());
          this.photographersLoading = false;
          this.cd.detectChanges();
        },
        error: () => { this.photographersLoading = false; this.cd.detectChanges(); }
      });
      return;
    }

    if (this.allInfluencers.length > 0) return;
    this.influencersLoading = true;
    this.config.getInfluencers().subscribe({
      next: (data: any[]) => {
        this.allInfluencers = (Array.isArray(data) ? data : [])
          .map((p: any) => ({ ...p, _id: p?._id || p?.id || '' }))
          .filter((p: any) => !!String(p?._id || '').trim());
        this.influencersLoading = false;
        this.cd.detectChanges();
      },
      error: () => { this.influencersLoading = false; this.cd.detectChanges(); }
    });
  }

  get filteredInfluencers(): any[] {
    let list = this.inviteCandidates;
    // Hide already-invited creators for influencer campaigns, but keep invited photographers visible in edit mode.
    if (this.campaignInvites?.length && this.inviteRecipientRole !== 'photographer') {
      list = list.filter(inf => !this.isInfluencerInvited(inf));
    }
    const q = this.influencerSearch.toLowerCase().trim();
    if (q) {
      list = list.filter(inf =>
        (inf.fullName || inf.name || '').toLowerCase().includes(q) ||
        (inf.username || '').toLowerCase().includes(q) ||
        (inf.location?.state || '').toLowerCase().includes(q) ||
        (inf.categories || inf.skills || []).some((c: string) => c.toLowerCase().includes(q))
      );
    }
    if (this.filterCategory) {
      list = list.filter(inf => (inf.categories || inf.skills || []).includes(this.filterCategory));
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
      const inferredRole = this.inferInviteRecipientRoleFromCampaignInvites();
      if (inferredRole && inferredRole !== this.inviteRecipientRole) {
        this.inviteRecipientRole = inferredRole;
        this.form?.patchValue({ inviteRecipientRole: inferredRole }, { emitEvent: false });
        if (this.currentStep === 3) {
          this.loadInviteRecipients();
        }
      }
      this.cd.detectChanges();
    });
  }

  private inferInviteRecipientRoleFromCampaignInvites(): 'influencer' | 'photographer' | null {
    if (!Array.isArray(this.campaignInvites) || this.campaignInvites.length === 0) return null;
    const photographerRows = this.campaignInvites.filter((invite: any) => this.isPhotographerRecipientInvite(invite)).length;
    const influencerRows = this.campaignInvites.length - photographerRows;
    if (photographerRows > 0 && photographerRows >= influencerRows) return 'photographer';
    if (influencerRows > 0) return 'influencer';
    return null;
  }

  isPhotographerRecipientInvite(invite: any): boolean {
    const role = String(invite?.recipientRole || invite?.role || invite?.campaignId?.inviteRecipientRole || invite?.campaignId?.recipientRole || '').trim().toLowerCase();
    if (role === 'photographer') return true;
    if (role === 'influencer') return false;
    if (this.inviteRecipientRole === 'photographer' || this.isPhotographerCreator) return true;
    return !!invite?.photographerId && !invite?.influencerId;
  }

  getInviteRecipient(invite: any): any {
    if (!invite) return null;
    if (this.isPhotographerRecipientInvite(invite)) {
      const rawId = String(invite?.photographerId?._id || invite?.photographerId || invite?.influencerId?._id || invite?.influencerId || '').trim();
      return invite?.photographerId || this.allPhotographers.find((p: any) => String(p?._id || p?.id || '') === rawId) || invite?.influencerId || null;
    }
    const rawId = String(invite?.influencerId?._id || invite?.influencerId || invite?.photographerId?._id || invite?.photographerId || '').trim();
    return invite?.influencerId || this.allInfluencers.find((p: any) => String(p?._id || p?.id || '') === rawId) || invite?.photographerId || null;
  }

  getInviteRecipientName(invite: any): string {
    const recipient = this.getInviteRecipient(invite);
    return String(recipient?.fullName || recipient?.name || recipient?.username || '').trim() || (this.isPhotographerRecipientInvite(invite) ? 'Photo/Videographer' : 'Influencer');
  }

  getInviteRecipientAvatar(invite: any): string {
    return this.getInfluencerAvatar(this.getInviteRecipient(invite));
  }

  getInviteRecipientUsername(invite: any): string {
    return String(this.getInviteRecipient(invite)?.username || '').trim();
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
    this.inviteCandidates.forEach(inf => ((inf.categories || inf.skills || []) as string[]).forEach((c: string) => cats.add(c)));
    return Array.from(cats).slice(0, 5);
  }

  switchInviteRecipientRole(role: 'influencer' | 'photographer') {
    if (this.isPhotographerCreator) return;
    this.form.patchValue({ inviteRecipientRole: role });
  }


  toggleInfluencerSelect(id: string) {
    if (!id) {
      this.toast.error(`Unable to identify this ${this.inviteRecipientLabelSingular.toLowerCase()}. Please refresh and try again.`);
      return;
    }
    const max = Number(this.f['maxInfluencers']?.value || 0);
    this.selectionLimitError = '';
    if (this.selectedInfluencerIds.has(id)) {
      this.selectedInfluencerIds.delete(id);
      return;
    }
    if (max > 0 && this.takenSlotsCount >= max) {
      this.selectionLimitError = `You can select up to ${max} ${this.inviteRecipientLabelPlural.toLowerCase()} only (already invited: ${this.invitedCount}).`;
      this.toast.error(this.selectionLimitError);
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
    const keepPendingReview = this.isEdit && originalStatus === 'pending_review';
    const keepPending = this.isEdit && originalStatus === 'pending';
    const payload: any = {
      ...v,
      pricePerInfluencer: pricePerInfluencerPaise,
      status: (isTierOpen || isResubmit || keepPendingReview)
        ? 'pending_review'
        : (keepPending ? 'pending' : 'draft'),
      deliverables: this.isPhotographerCreator
        ? this.selectedPhotographerDeliverables
        : this.parseDeliverables(v.deliverablesText),
      targetCities: v.targetDistrict ? [v.targetDistrict] : [],
      targetDistrict: undefined,
      categories: this.isPhotographerCreator
        ? this.selectedPhotographerServices
        : this.selectedCategories,
      platforms: this.isPhotographerCreator
        ? this.selectedPhotographerPricing.map(p => ({ pricingType: p, price: Math.round((this.photographerPricingPrices[p] || 0) * 100) }))
        : (this.isInvitingPhotographers ? [] : this.platformDeliverables.map(pd => pd.platform)),
      socialMedia: this.isPhotographerCreator
        ? []
        : (this.isInvitingPhotographers ? [] : this.platformDeliverables.map(pd => ({
            platform: pd.platform,
            contentTypes: pd.contentTypes.map(ct => ({
              name: ct.name,
              enabled: ct.enabled,
              price: ct.price
            }))
          }))),
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
      this.toast.error(`Please select at least one ${this.inviteRecipientLabelSingular.toLowerCase()} to invite.`);
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
      categories: this.isPhotographerCreator
        ? this.selectedPhotographerServices
        : this.selectedCategories,
      platforms: this.isPhotographerCreator
        ? this.selectedPhotographerPricing.map(p => ({ pricingType: p, price: Math.round((this.photographerPricingPrices[p] || 0) * 100) }))
        : (this.isInvitingPhotographers ? [] : this.platformDeliverables.map(pd => pd.platform)),
      socialMedia: this.isPhotographerCreator
        ? []
        : (this.isInvitingPhotographers ? [] : this.platformDeliverables.map(pd => ({
            platform: pd.platform,
            contentTypes: pd.contentTypes.map(ct => ({
              name: ct.name,
              enabled: ct.enabled,
              price: ct.price
            }))
          }))),
      deliverables: this.isPhotographerCreator
        ? this.selectedPhotographerDeliverables
        : this.parseDeliverables(payload.deliverablesText ?? ''),
      inviteInfluencerIds: this.selectedInfluencerIds.size > 0
        ? Array.from(this.selectedInfluencerIds).slice(0, Number(this.f['maxInfluencers']?.value || this.selectedInfluencerIds.size))
        : undefined,
      inviteRecipientIds: this.selectedInfluencerIds.size > 0
        ? Array.from(this.selectedInfluencerIds).slice(0, Number(this.f['maxInfluencers']?.value || this.selectedInfluencerIds.size))
        : undefined,
      inviteRecipientRole: this.isPhotographerCreator ? 'influencer' : (this.inviteRecipientRole === 'photographer' ? 'photographer' : 'influencer'),
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
      const inviteInfId = String(i?.influencerId?._id || i?.influencerId || i?.photographerId?._id || i?.photographerId || '');
      return inviteInfId === this.getRecipientId(inf);
    });
  }
}

