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
  { path: 'how-it-works', renderMode: RenderMode.Prerender },
  { path: 'how-it-works/influencers', renderMode: RenderMode.Prerender },
  { path: 'how-it-works/brands', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'auth/login', renderMode: RenderMode.Prerender },
  { path: 'register-influencer', renderMode: RenderMode.Prerender },
  { path: 'register-brand', renderMode: RenderMode.Prerender },
  { path: 'upgrade-premium', renderMode: RenderMode.Client },
  { path: 'campaign-pay/:campaignId', renderMode: RenderMode.Client },
  { path: 'payment-history', renderMode: RenderMode.Client },
  { path: 'transactions', renderMode: RenderMode.Client },
  { path: 'influencer-profile', renderMode: RenderMode.Prerender },
  { path: 'brand-profile', renderMode: RenderMode.Prerender },
  { path: 'campaigns', renderMode: RenderMode.Client },

  // Admin / dashboard routes
  { path: 'admin', renderMode: RenderMode.Server },
  { path: 'admin/admin-dashboard', renderMode: RenderMode.Server },
  { path: 'admin/admin-user-table', renderMode: RenderMode.Server },
  { path: 'admin/admin-management', renderMode: RenderMode.Server },
  { path: 'admin/payments', renderMode: RenderMode.Server },
  { path: 'admin/plans', renderMode: RenderMode.Server },
  { path: 'admin/deleted-users', renderMode: RenderMode.Server },
  { path: 'admin/reviews', renderMode: RenderMode.Server },
  { path: 'admin/disputes', renderMode: RenderMode.Server },

  // Dashboard SSR routes
  { path: 'influencer-dashboard', renderMode: RenderMode.Server },
  { path: 'campaign-submission/:inviteId', renderMode: RenderMode.Server },
  { path: 'brand-dashboard', renderMode: RenderMode.Server },
  { path: 'logout', renderMode: RenderMode.Server },
  { path: 'admin/logout', renderMode: RenderMode.Server },
  { path: 'auth', renderMode: RenderMode.Server },
  { path: 'verify-email', renderMode: RenderMode.Server },

  // Forgot password SSR route
  { path: 'forgot-password', renderMode: RenderMode.Server },

  // Reset password SSR route
  { path: 'reset-password', renderMode: RenderMode.Server },

  // Dynamic profiles
  { path: 'influencer/:username', renderMode: RenderMode.Server },
  { path: 'brand/:brandName', renderMode: RenderMode.Server },

];