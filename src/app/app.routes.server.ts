import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'register', renderMode: RenderMode.Prerender },
  { path: 'logout', renderMode: RenderMode.Prerender },
  { path: 'admin', renderMode: RenderMode.Prerender }, // Required for build, but not recommended for admin
  { path: 'admin/admin-user-table', renderMode: RenderMode.Prerender },
  { path: 'admin/admin-management', renderMode: RenderMode.Prerender },
  // Add your actual user/brand profile and grid routes below, matching your app.routes.ts
  // Example dynamic routes (update as needed):
  // { path: 'profile/:id', renderMode: RenderMode.Prerender },
  // { path: 'user-grid', renderMode: RenderMode.Prerender },
  // { path: 'brand-profile/:id', renderMode: RenderMode.Prerender },
];
