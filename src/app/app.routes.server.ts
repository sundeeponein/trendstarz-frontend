import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'logout', renderMode: RenderMode.Prerender },
  { path: 'admin', renderMode: RenderMode.Prerender }, // Required for build, but not recommended for admin
  { path: 'admin/admin-dashboard', renderMode: RenderMode.Prerender },
  { path: 'admin/admin-user-table', renderMode: RenderMode.Prerender },
  { path: 'admin/admin-management', renderMode: RenderMode.Prerender },
  { path: 'admin/deleted-users', renderMode: RenderMode.Prerender },
  { path: 'register-influencer', renderMode: RenderMode.Prerender },
  { path: 'register-brand', renderMode: RenderMode.Prerender },
  { path: 'payment', renderMode: RenderMode.Prerender },
  { path: 'influencer-profile', renderMode: RenderMode.Prerender },
  { path: 'brand-profile', renderMode: RenderMode.Prerender },
];
