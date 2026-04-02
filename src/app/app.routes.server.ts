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
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'auth/login', renderMode: RenderMode.Prerender },
  { path: 'register-influencer', renderMode: RenderMode.Prerender },
  { path: 'register-brand', renderMode: RenderMode.Prerender },
  { path: 'upgrade-premium', renderMode: RenderMode.Client },
  { path: 'payment-history', renderMode: RenderMode.Client },
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
  { path: 'logout', renderMode: RenderMode.Server },
  { path: 'admin/logout', renderMode: RenderMode.Server },
  { path: 'auth', renderMode: RenderMode.Server },
  { path: 'verify-email', renderMode: RenderMode.Server },

  // Dynamic profiles
  { path: 'influencer/:username', renderMode: RenderMode.Server },
  { path: 'brand/:brandName', renderMode: RenderMode.Server },

];