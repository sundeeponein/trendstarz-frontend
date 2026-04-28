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
  platformPreference?: string;
  specialInstructions?: string;
  createdAt?: string;
  updatedAt?: string;
}
