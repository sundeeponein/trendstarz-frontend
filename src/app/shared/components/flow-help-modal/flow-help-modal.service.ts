import { Injectable } from '@angular/core';

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

export interface FlowHelpContent {
  title: string;
  subtitle?: string;
  steps?: { label: string; detail: string }[];
  sections: FlowHelpSection[];
  example?: FlowHelpExample;
  postAcceptByType?: CampaignTypePostAcceptGuide[];
}

@Injectable({ providedIn: 'root' })
export class FlowHelpModalService {
  isOpen = false;
  content: FlowHelpContent | null = null;

  openCampaignBuilderGuide(campaignType?: string): void {
    this.content = {
      title: 'Create / Edit Campaign Flow',
      subtitle: 'Fill in details, then invite influencers',
      steps: [
        { label: 'Step 1', detail: 'Campaign type * (first required dropdown), title, timeline' },
        { label: 'Step 2', detail: 'Requirements, pricing, platforms, minimum tier' },
        { label: 'Step 3', detail: 'Invite influencers and track acceptance to completion' }
      ],
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
        },
        {
          key: 'pay_to_join',
          label: 'Pay to join',
          nextSteps: [
            'Verify influencer joined under pay-to-join terms and requirements.',
            'Provide clear placement benefit, posting scope, and deadline.',
            'Evaluate final submission quality and complete closure workflow.'
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
}
