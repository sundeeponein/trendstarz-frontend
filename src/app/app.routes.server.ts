import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [

  // Static SEO pages
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'privacy-policy', renderMode: RenderMode.Prerender },
  { path: 'terms-and-conditions', renderMode: RenderMode.Prerender },
  { path: 'refund-policy', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },

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