import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [

  // Static SEO pages
  { path: '', renderMode: RenderMode.Client },
  { path: 'privacy-policy', renderMode: RenderMode.Prerender },
  { path: 'terms-and-conditions', renderMode: RenderMode.Prerender },
  { path: 'refund-policy', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },

  // User-facing pages
  { path: 'welcome', renderMode: RenderMode.Client },
  { path: 'search', renderMode: RenderMode.Client },
  { path: 'features', renderMode: RenderMode.Prerender },
  { path: 'features/influencers', renderMode: RenderMode.Prerender },
  { path: 'features/brands', renderMode: RenderMode.Prerender },
  { path: 'how-it-works', renderMode: RenderMode.Prerender },
  { path: 'how-it-works/influencers', renderMode: RenderMode.Prerender },
  { path: 'how-it-works/brands', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'auth/login', renderMode: RenderMode.Prerender },
  { path: 'register-influencer', renderMode: RenderMode.Prerender },
  { path: 'register-brand', renderMode: RenderMode.Prerender },
  { path: 'upgrade-premium', renderMode: RenderMode.Client },
  { path: 'campaign-pay/:campaignId', renderMode: RenderMode.Client },
  { path: 'campaign-payment/:campaignId', renderMode: RenderMode.Client },
  { path: 'payment-history', renderMode: RenderMode.Client },
  { path: 'transactions', renderMode: RenderMode.Client },
  { path: 'influencer-profile', renderMode: RenderMode.Client },
  { path: 'brand-profile', renderMode: RenderMode.Client },
  { path: 'campaigns', renderMode: RenderMode.Client },

  // Admin / dashboard routes
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/admin-dashboard', renderMode: RenderMode.Client },
  { path: 'admin/admin-user-table', renderMode: RenderMode.Client },
  { path: 'admin/campaign-review', renderMode: RenderMode.Client },
  { path: 'admin/admin-management', renderMode: RenderMode.Client },
  { path: 'admin/payments', renderMode: RenderMode.Client },
  { path: 'admin/plans', renderMode: RenderMode.Client },
  { path: 'admin/deleted-users', renderMode: RenderMode.Client },
  { path: 'admin/reviews', renderMode: RenderMode.Client },
  { path: 'admin/disputes', renderMode: RenderMode.Client },

  // Dashboard routes — must be Client (need localStorage token)
  { path: 'influencer-dashboard', renderMode: RenderMode.Client },
  { path: 'campaign-submission/:inviteId', renderMode: RenderMode.Client },
  { path: 'brand-dashboard', renderMode: RenderMode.Client },
  { path: 'logout', renderMode: RenderMode.Client },
  { path: 'admin/logout', renderMode: RenderMode.Client },
  { path: 'auth', renderMode: RenderMode.Client },
  { path: 'verify-email', renderMode: RenderMode.Client },

  // Forgot password / Reset password
  { path: 'forgot-password', renderMode: RenderMode.Client },
  { path: 'reset-password', renderMode: RenderMode.Client },

  // Dynamic profiles
  { path: 'influencer/:username', renderMode: RenderMode.Server },
  { path: 'brand/:brandName', renderMode: RenderMode.Server },

  // Fallback
  { path: '**', renderMode: RenderMode.Client },

];