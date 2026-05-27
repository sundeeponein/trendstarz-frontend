import { Injectable } from '@angular/core';

// ── Guide mode (existing) ─────────────────────────────────────────────────────

export interface FlowHelpSection {
  title: string;
  points: string[];
}

export interface FlowHelpExample {
  title: string;
  fields: { label: string; value: string }[];
}

export interface CampaignTypePostAcceptGuide {
  key: string;
  label: string;
  nextSteps: string[];
}

export interface FlowHelpGuideContent {
  mode?: 'guide';
  title: string;
  subtitle?: string;
  steps?: { label: string; detail: string }[];
  sections: FlowHelpSection[];
  example?: FlowHelpExample;
  postAcceptByType?: CampaignTypePostAcceptGuide[];
}

// ── Diagram mode (new — full payment-aware flow) ──────────────────────────────

export interface FlowPhaseActor {
  role: 'brand' | 'influencer' | 'admin' | 'system';
  actions: string[];
}

export interface FlowPhase {
  number: number;
  title: string;
  status: string;
  statusVariant: 'accepted' | 'payment' | 'verify' | 'progress' | 'submitted' | 'completed' | 'failed' | 'dispute';
  actors: FlowPhaseActor[];
}

export interface FlowUxLabel {
  label: string;
  color: 'orange' | 'blue' | 'green' | 'red';
}

export interface FlowSafetyRule {
  title: string;
  detail: string;
}

export interface FlowHelpDiagramContent {
  mode: 'diagram';
  title: string;
  subtitle?: string;
  stateLabels: string[];
  phases: FlowPhase[];
  brandUxLabels: FlowUxLabel[];
  influencerUxLabels: FlowUxLabel[];
  safetyRules: FlowSafetyRule[];
  futureNote?: string;
  disputeNote?: string;
}

export type FlowHelpContent = FlowHelpGuideContent | FlowHelpDiagramContent;

@Injectable({ providedIn: 'root' })
export class FlowHelpModalService {
  isOpen = false;
  content: FlowHelpContent | null = null;

  openCampaignBuilderGuide(campaignType?: string): void {
    this.content = {
      title: 'Create / Edit Campaign Flow',
      subtitle: 'Fill in details, then invite influencers',
      sections: [
        {
          title: 'Before You Start',
          points: [
            'Keep campaign goal and offer ready (awareness, sales, launch, event).',
            'Upload a clear campaign image for better invite acceptance.',
            'Set realistic timeline and budget before inviting creators.'
          ]
        },
        {
          title: 'Step 1 (First Required Input)',
          points: [
            'Select Campaign type * first from the dropdown (required).',
            'Then add title, description, image, and timeline.',
            'Use clear brief language so creators understand expected output.'
          ]
        },
        {
          title: 'Step 2 Requirements',
          points: [
            'Set price per influencer and max influencers.',
            'Choose content categories, platforms, and deliverables.',
            'Set minimum tier and special instructions for quality matching.'
          ]
        },
        {
          title: 'Step 3 Invite & Complete',
          points: [
            'Filter and select influencers matching your goal.',
            'Send invites and track pending/accepted in Campaign Management.',
            'Once accepted and submitted, review content and complete payout flow.'
          ]
        }
      ],
      postAcceptByType: [
        {
          key: 'paid_collab',
          label: 'Paid collaboration',
          nextSteps: [
            'Confirm accepted influencer details and lock post date/content type.',
            'Share final brief with CTA, brand mentions, and expected deliverables.',
            'Track submission, review post link, and approve for payout release.'
          ]
        },
        {
          key: 'product',
          label: 'Product collaboration',
          nextSteps: [
            'Arrange product dispatch details immediately after acceptance.',
            'Share usage points, unboxing expectations, and posting deadline.',
            'Review submitted product content and approve/feedback to complete.'
          ]
        },
        {
          key: 'invite_location',
          label: 'Invite to location',
          nextSteps: [
            'Confirm visit slot, venue address, and onsite contact person.',
            'Share shoot permissions, mandatory captures, and event highlights.',
            'After visit content submission, review and close with payout decision.'
          ]
        }
      ],
      example: {
        title: 'Sample Campaign (reference before final submit)',
        fields: [
          { label: 'Campaign type', value: 'Paid collaboration' },
          { label: 'Title', value: 'Summer Drop 2026 Launch Reel' },
          { label: 'Timeline', value: '05 May 2026 - 20 May 2026' },
          { label: 'Price / influencer', value: 'Rs 1,500' },
          { label: 'Max influencers', value: '8' },
          { label: 'Minimum tier', value: 'Micro' },
          { label: 'Platform output', value: 'Instagram Reel (enabled), Story (enabled)' }
        ]
      }
    };
    this.isOpen = true;
  }

  openInfluencerFlowGuide(): void {
    this.content = {
      title: 'Influencer Campaign Flow',
      subtitle: 'Before accept, after accept, and till completion',
      steps: [
        { label: 'Before Accept', detail: 'Review brief, payout, timeline, deliverables' },
        { label: 'Accept or Decline', detail: 'Choose post date/content type, then confirm action' },
        { label: 'After Accept', detail: 'Create content and submit post link' },
        { label: 'Complete', detail: 'Brand review, feedback/dispute handling, payout release' }
      ],
      sections: [
        {
          title: 'Before Accepting',
          points: [
            'Open invite details and check brief, timeline, payout, and deliverables.',
            'Pick planned post date and eligible content type where required.',
            'Decline if it does not fit your audience, style, or availability.'
          ]
        },
        {
          title: 'After Accepting',
          points: [
            'Create content as per selected platform/content type and campaign brief.',
            'Submit post link from your accepted invite card.',
            'Keep CTA, tags, and quality aligned with instructions.'
          ]
        },
        {
          title: 'Till Completion',
          points: [
            'Brand reviews your submission and may approve or request changes.',
            'Respond quickly to feedback/disputes to avoid delays.',
            'After approval, payout processing completes the campaign cycle.'
          ]
        }
      ]
    };
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  // ── Collaboration Type explainer ──────────────────────────────────────────
  openCollaborationTypeGuide(selectedType?: string): void {
    this.content = {
      title: 'Collaboration Types — What do they mean?',
      subtitle: 'Choose the type that matches how you want to work with influencers',
      sections: [
        {
          title: '💰 Paid Collab',
          points: [
            'You pay the influencer a fixed fee to create and publish content.',
            'Best for: product launches, brand awareness, seasonal promotions.',
            'How it works: Invite → Influencer accepts → You pay via UPI → Admin verifies → Influencer posts → You review → Admin pays out.',
            'You control deliverables: Reel, Story, YouTube video, post, etc.',
            'Influencer submits a post link for your review before payout is released.',
          ]
        },
        {
          title: '🎁 Product Collab (Premium)',
          points: [
            'You send a free product to the influencer — no cash payment involved.',
            'The product itself is the compensation for the content created.',
            'Best for: unboxing reviews, lifestyle integrations, beauty/fashion/food brands.',
            'How it works: Invite → Influencer accepts → You ship the product → Influencer creates and submits content → You review.',
            'Ideal when you want authentic product-led reviews without a cash budget.',
          ]
        },
        {
          title: '📍 Invite to Location (Premium)',
          points: [
            'You invite the influencer to visit your physical store, venue, or event.',
            'The visit and on-site content creation completes the collaboration.',
            'Best for: restaurants, cafes, retail stores, brand events, launches, showrooms.',
            'How it works: Invite → Influencer accepts with a visit date → They attend and create on-site content → Submit → You review.',
            'Great for experience-first brands where being physically present matters.',
          ]
        },
        {
          title: 'Which type should I choose?',
          points: [
            'Cash budget available → use Paid Collab.',
            'Sending products for review → use Product Collab.',
            'Running an event or have a physical location → use Invite to Location.',
            'Product Collab and Invite to Location require a Premium plan.',
          ]
        }
      ],
      ...(selectedType ? {
        example: {
          title: `Currently selected: ${
            selectedType === 'paid_collab' ? '💰 Paid Collab' :
            selectedType === 'product' ? '🎁 Product Collab' :
            selectedType === 'invite_location' ? '📍 Invite to Location' : selectedType
          }`,
          fields: selectedType === 'paid_collab' ? [
            { label: 'Compensation', value: 'Fixed cash fee per influencer' },
            { label: 'Influencer action', value: 'Create & publish post, submit post link' },
            { label: 'Brand action', value: 'Pay via UPI, review submission, approve payout' },
            { label: 'Plan required', value: 'Free or Premium' },
          ] : selectedType === 'product' ? [
            { label: 'Compensation', value: 'Free product (no cash)' },
            { label: 'Influencer action', value: 'Receive product, create review/post, submit link' },
            { label: 'Brand action', value: 'Ship product, review content submission' },
            { label: 'Plan required', value: 'Premium only' },
          ] : [
            { label: 'Compensation', value: 'Free visit / experience' },
            { label: 'Influencer action', value: 'Visit venue on agreed date, create on-site content, submit' },
            { label: 'Brand action', value: 'Confirm visit slot, host influencer, review submission' },
            { label: 'Plan required', value: 'Premium only' },
          ]
        }
      } : {})
    };
    this.isOpen = true;
  }

  // ── Full end-to-end campaign flow with payment phases ─────────────────────
  openCampaignFlowDiagram(): void {
    this.content = {
      mode: 'diagram',
      title: 'Campaign Collaboration Flow',
      subtitle: 'How brands, influencers, and admin work together — end to end',
      stateLabels: [
        'Draft', 'Published', 'Accepted',
        'Payment pending', 'Verify pending', 'In progress',
        'Submitted', 'Approved / Rejected', 'Paid', 'Completed'
      ],
      phases: [
        {
          number: 1,
          title: 'Agreement — lock terms',
          status: 'Accepted',
          statusVariant: 'accepted',
          actors: [
            {
              role: 'influencer',
              actions: [
                'Reviews campaign brief, payout, timeline, and deliverables.',
                'Picks planned post date and eligible content type.',
                'Accepts invite — date is validated against campaign window.'
              ]
            },
            {
              role: 'system',
              actions: [
                'Locks deliverables, price, and post date — no changes allowed after this point.'
              ]
            }
          ]
        },
        {
          number: 2,
          title: 'Brand payment — manual UPI / QR',
          status: 'Payment pending',
          statusVariant: 'payment',
          actors: [
            {
              role: 'brand',
              actions: [
                'Sees the UPI ID / QR code and exact amount to pay.',
                'Pays via UPI app or QR scan.',
                'Submits UTR / Transaction ID — mandatory, cannot skip.',
                'Optionally uploads payment screenshot for faster verification.'
              ]
            }
          ]
        },
        {
          number: 3,
          title: 'Admin verification — manual UTR check',
          status: 'Verify pending',
          statusVariant: 'verify',
          actors: [
            {
              role: 'admin',
              actions: [
                'Manually verifies the UTR in the bank portal (typically 6–10 hrs).',
                'Marks payment confirmed once matched.',
                'Rejects if UTR is invalid — brand must re-submit.'
              ]
            },
            {
              role: 'system',
              actions: [
                'Status moves to "Confirmed" → influencer is unblocked to start work.'
              ]
            }
          ]
        },
        {
          number: 4,
          title: 'Influencer work',
          status: 'In progress',
          statusVariant: 'progress',
          actors: [
            {
              role: 'influencer',
              actions: [
                'Sees "Payment secured. You can start work." — unlocked only after Phase 3.',
                'Creates content per campaign brief and selected deliverables.',
                'Submits proof: post link + screenshot (both required).'
              ]
            },
            {
              role: 'system',
              actions: [
                'Auto-expires and marks Failed if no proof submitted within deadline + 2-day buffer.',
                'Triggers refund flow on auto-expire.'
              ]
            }
          ]
        },
        {
          number: 5,
          title: 'Brand review',
          status: 'Submitted',
          statusVariant: 'submitted',
          actors: [
            {
              role: 'brand',
              actions: [
                'Views submitted post link and screenshot inline.',
                'Approve → payout is triggered for influencer.',
                'Reject → sends specific feedback reason → influencer fixes and resubmits.'
              ]
            }
          ]
        },
        {
          number: 6,
          title: 'Payout — manual UPI to influencer',
          status: 'Completed',
          statusVariant: 'completed',
          actors: [
            {
              role: 'admin',
              actions: [
                'Sends influencer payout manually via UPI.',
                'Marks "Paid to influencer" → status becomes Completed.',
                'If expired / failed → issues manual UPI refund to brand instead.'
              ]
            }
          ]
        },
        {
          number: 7,
          title: 'Disputes — payment freeze',
          status: 'Disputed',
          statusVariant: 'dispute',
          actors: [
            {
              role: 'brand',
              actions: ['Raises dispute if content does not meet brief or quality standards.']
            },
            {
              role: 'influencer',
              actions: ['Raises dispute if approved work payment is withheld or delayed.']
            },
            {
              role: 'admin',
              actions: [
                'Receives dispute → payment is immediately frozen.',
                'Reviews evidence from both sides.',
                'Releases payment to brand (invalid work) or influencer (valid completed work).'
              ]
            }
          ]
        }
      ],
      brandUxLabels: [
        { label: 'Confirm collaboration', color: 'orange' },
        { label: 'Waiting for submission', color: 'blue' },
        { label: 'Review content', color: 'blue' },
        { label: 'Approved', color: 'green' },
        { label: 'Payment released', color: 'green' }
      ],
      influencerUxLabels: [
        { label: 'Waiting for payment', color: 'orange' },
        { label: 'Payment secured — start work', color: 'blue' },
        { label: 'Submit content', color: 'blue' },
        { label: 'Fix required', color: 'red' },
        { label: 'Payment released', color: 'green' }
      ],
      safetyRules: [
        {
          title: 'Work never starts before payment is confirmed',
          detail: '"In progress" status is gated strictly behind admin verification. This is the biggest trust factor for influencers.'
        },
        {
          title: 'Campaign locked after acceptance',
          detail: 'No price changes, no deliverable edits after the influencer accepts. Locked at the database level, not just UI.'
        },
        {
          title: 'Auto-expire on deadline miss',
          detail: 'Deadline + 2-day buffer → system marks Failed. Triggers the refund flow automatically.'
        },
        {
          title: 'UTR is mandatory, never optional',
          detail: 'Brand cannot skip UTR submission. The submit button stays blocked until a valid Transaction ID is entered.'
        }
      ],
      disputeNote: 'Disputes freeze payment immediately. Admin / support team reviews evidence from both sides and releases to the winning party. Partial penalty support is a future feature.',
      futureNote: 'Designed for future upgrade: Razorpay / Stripe replaces manual UPI for auto-capture. Auto-escrow and auto-payout slots in without schema changes.'
    };
    this.isOpen = true;
  }
}
