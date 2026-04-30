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
  campaignType?: 'paid_collab' | 'product' | 'invite_location' | 'pay_to_join';
  image?: { url: string; public_id: string };
  status: 'active' | 'pending' | 'completed' | 'draft';
  budgetMin?: number;
  budgetMax?: number;
  pricePerInfluencer?: number; // paise
  maxInfluencers?: number;
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
  minInfluencerTier?: string;
  platformPreference?: string;
  specialInstructions?: string;
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
  // Invite to location specific benefits text (e.g. "Stay + food included")
  inviteBenefits?: string;
  // Pay-to-join specific fields
  payToJoinBenefits?: string;
  payToJoinInstructions?: string;
  createdAt?: string;
  updatedAt?: string;
}
