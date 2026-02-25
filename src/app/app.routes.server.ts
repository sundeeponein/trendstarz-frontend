import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [

  // Static SEO pages
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'privacy-policy', renderMode: RenderMode.Prerender },
  { path: 'terms-and-conditions', renderMode: RenderMode.Prerender },
  { path: 'refund-policy', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },

  // ---- Other Static Pages
  { path: 'welcome', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'auth/login', renderMode: RenderMode.Prerender },
  { path: 'register-influencer', renderMode: RenderMode.Prerender },
  { path: 'register-brand', renderMode: RenderMode.Prerender },
  { path: 'payment', renderMode: RenderMode.Prerender },
  { path: 'influencer-profile', renderMode: RenderMode.Prerender },
  { path: 'brand-profile', renderMode: RenderMode.Prerender },
  { path: 'admin/admin-dashboard', renderMode: RenderMode.Server },
  { path: 'admin/admin-user-table', renderMode: RenderMode.Server },
  { path: 'admin/admin-management', renderMode: RenderMode.Server },
  { path: 'admin/deleted-users', renderMode: RenderMode.Server },

  // Optional prerender forms
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'register-influencer', renderMode: RenderMode.Prerender },
  { path: 'register-brand', renderMode: RenderMode.Prerender },
  { path: 'payment', renderMode: RenderMode.Prerender },

  // Admin / logout (must exist here)
  { path: 'admin', renderMode: RenderMode.Server },
  { path: 'logout', renderMode: RenderMode.Server },

  // Dynamic profiles
  { path: 'influencer/:username', renderMode: RenderMode.Server },
  { path: 'brand/:brandName', renderMode: RenderMode.Server },

];