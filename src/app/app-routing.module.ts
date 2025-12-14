import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/auth/login.component';
import { AdminUserTableComponent } from './pages/admin/admin-users-table/admin-user-table.component';
import { NavbarLayoutComponent } from './layout/navbar-layout/navbar-layout.component';
import { NoNavbarLayoutComponent } from './layout/no-navbar/no-navbar-layout.component';

import { AdminManagementComponent } from './pages/admin/admin-management/admin-management.component';
import { AdminLayoutComponent } from './layout/admin-layout/admin-layout.component';
import { WelcomeComponent } from './pages/welcome/welcome.component';

const routes: Routes = [
  {
    path: '',
    component: NavbarLayoutComponent,
    children: [
      { path: '', component: WelcomeComponent },
      { path: 'welcome', component: WelcomeComponent },
      { path: 'register-influencer', loadComponent: () => import('./pages/influencer-registration/influencer-registration.component').then(m => m.InfluencerRegistrationComponent) },
      { path: 'register-brand', loadComponent: () => import('./pages/brand-registration/brand-registration.component').then(m => m.BrandRegistrationComponent) },
      { path: 'login', component: LoginComponent },
      // { path: 'how-it-works', loadComponent: () => import('./pages/how-it-works/how-it-works.component').then(m => m.HowItWorksComponent) },
      { path: 'influencer-profile', loadComponent: () => import('./pages/influencer-profile/influencer-profile.component').then(m => m.InfluencerProfileComponent) },
      { path: 'brand-profile', loadComponent: () => import('./pages/brand-profile/brand-profile.component').then(m => m.BrandProfileComponent) },
    ],
  },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    children: [
      { path: '', redirectTo: 'admin-user-table', pathMatch: 'full' },
      { path: 'admin-user-table', component: AdminUserTableComponent },
      { path: 'admin-management', component: AdminManagementComponent },
    ],
  },
  {
    path: 'auth',
    component: NoNavbarLayoutComponent,
    children: [
      { path: 'login', component: LoginComponent },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
