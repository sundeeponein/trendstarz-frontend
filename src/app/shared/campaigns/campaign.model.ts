export interface Campaign {
  _id?: string;
  brandId: string;
  title: string;
  description?: string;
  image?: { url: string; public_id: string };
  status: 'active' | 'pending' | 'completed' | 'draft';
  budgetMin?: number;
  budgetMax?: number;
  applicants?: number;
  timelineStart?: string;
  timelineEnd?: string;
  createdAt?: string;
  updatedAt?: string;
}
