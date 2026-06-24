export interface CampaignInfluencer {
  id: string;
  name: string;
  username?: string;
}

export interface Campaign {
  _id?: string;
  brandId: string;
  title: string;
  description?: string;
  campaignType?:
    | 'paid_collab'
    | 'product'
    | 'invite_location'
    | 'pay_to_join'
    | 'portfolio_collab'
    | 'reel_collab'
    | 'creative_project';
  campaignMode?: 'invite_only' | 'tier_filtered_open';
  image?: { url: string; public_id: string };
  status:
    | 'active'
    | 'pending'
    | 'pending_review'
    | 'needs_changes'
    | 'rejected'
    | 'completed'
    | 'cancelled'
    | 'draft';
  budgetMin?: number;
  budgetMax?: number;
  pricePerInfluencer?: number; // paise
  maxInfluencers?: number;
  minInfluencers?: number;
  acceptanceDeadline?: string;
  estimatedBudget?: number; // paise
  applicants?: number;
  startDate?: string;
  endDate?: string;
  timelineStart?: string;
  timelineEnd?: string;
  platforms?: string[];
  targetInfluencers?: CampaignInfluencer[];
  // Step-2 requirement fields
  categories?: string[];
  deliverables?: string[];
  minFollowerCount?: number;
  maxFollowerCount?: number;
  minInfluencerTier?: string;
  targetState?: string;
  targetDistrict?: string;
  targetTiers?: string[];
  targetCities?: string[];
  platformPreference?: string;
  specialInstructions?: string;
  // Photographer collaboration location fields (shown before influencer acceptance)
  shootLocationType?: 'studio' | 'indoor' | 'outdoor' | 'client_location' | 'pickup_point';
  shootLocationAddress?: string;
  shootLocationMapUrl?: string;
  shootLocationNotes?: string;
  // Invite-to-location specific fields
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  venueDistrict?: string;
  venueState?: string;
  venueGoogleMapUrl?: string;
  // Product collaboration specific fields
  productDescription?: string;
  productValue?: number; // paise
  productPaymentMode?: 'product_only' | 'product_plus_payment';
  productPaymentAmount?: number; // paise (when mode = product_plus_payment)
  productShippingRequired?: boolean;
  moderationNote?: string;
  // Invite to location specific benefits text (e.g. "Stay + food included")
  inviteBenefits?: string;
  // Pay-to-join specific fields
  payToJoinBenefits?: string;
  payToJoinInstructions?: string;
  createdAt?: string;
  updatedAt?: string;
}
