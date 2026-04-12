import { Routes } from '@angular/router';
import { LoginComponent } from './pages/auth/login.component';
import { AdminUserTableComponent } from './pages/admin/admin-users-table/admin-user-table.component';
import { NavbarLayoutComponent } from './layout/navbar-layout/navbar-layout.component';
import { NoNavbarLayoutComponent } from './layout/no-navbar/no-navbar-layout.component';
import { AdminManagementComponent } from './pages/admin/admin-management/admin-management.component';
import { AdminLayoutComponent } from './layout/admin-layout/admin-layout.component';
import { WelcomeComponent } from './pages/welcome/welcome.component';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  	{
    path: '',
    component: NavbarLayoutComponent,
		children: [
			{ path: '', component: WelcomeComponent },
			{ path: 'welcome', component: WelcomeComponent },
			{ path: 'auth/login', component: LoginComponent },
			{ path: 'search', loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent) },
			// static pages legal
			{ path: 'privacy-policy', loadComponent: () => import('./legal/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent) },
			{ path: 'terms-and-conditions', loadComponent: () => import('./legal/terms/terms.component').then(m => m.TermsComponent) },
			{ path: 'refund-policy', loadComponent: () => import('./legal/refund-policy/refund-policy.component').then(m => m.RefundPolicyComponent) },
			{ path: 'contact', loadComponent: () => import('./legal/contact/contact.component').then(m => m.ContactComponent) },
			// user/brand/influencer pages
			{ path: 'register-influencer', loadComponent: () => import('./pages/influencer-registration/influencer-registration.component').then(m => m.InfluencerRegistrationComponent) },
			{ path: 'register-brand', loadComponent: () => import('./pages/brand-registration/brand-registration.component').then(m => m.BrandRegistrationComponent) },
			{ path: 'influencer-profile', canActivate: [authGuard], loadComponent: () => import('./pages/influencer-profile/influencer-profile.component').then(m => m.InfluencerProfileComponent) },
			{ path: 'influencer/:username', loadComponent: () => import('./shared/user-profile/influencer-profile-view/influencer-profile-view.component').then(m => m.InfluencerProfileViewComponent) },
			{ path: 'brand-profile', canActivate: [authGuard], loadComponent: () => import('./pages/brand-profile/brand-profile.component').then(m => m.BrandProfileComponent) },
			{ path: 'campaigns', canActivate: [authGuard], loadComponent: () => import('./pages/campaign-management/campaign-management.component').then(m => m.CampaignManagementComponent) },
			{ path: 'brand/:brandName', loadComponent: () => import('./shared/user-profile/brand-profile-view/brand-profile-view.component').then(m => m.BrandProfileViewComponent) },
			{ path: 'upgrade-premium', canActivate: [authGuard], loadComponent: () => import('./pages/premium-upgrade/premium-upgrade.component').then(m => m.PremiumUpgradeComponent) },
			{ path: 'payment-history', canActivate: [authGuard], loadComponent: () => import('./pages/payment-history/payment-history.component').then(m => m.PaymentHistoryComponent) },
			// DASHBOARDS
			{ path: 'influencer-dashboard', canActivate: [authGuard], loadComponent: () => import('./pages/influencer-dashboard/influencer-dashboard.component').then(m => m.InfluencerDashboardComponent) },
			{ path: 'brand-dashboard', canActivate: [authGuard], loadComponent: () => import('./pages/brand-dashboard/brand-dashboard.component').then(m => m.BrandDashboardComponent) },
		],
	},
	{
		path: 'admin',
		component: AdminLayoutComponent,
		canActivate: [authGuard],
		children: [
			{ path: '', redirectTo: 'admin-dashboard', pathMatch: 'full' },
			{ path: 'admin-dashboard', loadComponent: () => import('./pages/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) },
			{ path: 'admin-user-table', component: AdminUserTableComponent },
			{ path: 'admin-management', component: AdminManagementComponent },
			{ path: 'payments', loadComponent: () => import('./pages/admin-payments/admin-payments.component').then(m => m.AdminPaymentsComponent) },			{ path: 'plans', loadComponent: () => import('./pages/admin/admin-plans/admin-plans.component').then(m => m.AdminPlansComponent) },			{ path: 'deleted-users', loadComponent: () => import('./pages/admin/deleted-users-table/deleted-users-table.component').then(m => m.DeletedUsersTableComponent) },
			{ path: 'logout', loadComponent: () => import('./pages/auth/logout.component').then(m => m.LogoutComponent) },
		],
	},
	{
		path: '',
		component: NoNavbarLayoutComponent,
		children: [
			{ path: 'login', component: LoginComponent },
			{ path: '', loadComponent: () => import('./pages/auth/auth-landing.component').then(m => m.AuthLandingComponent) },
		],
	},

	// Top-level routes for SSR/server extraction
	{ path: 'logout', loadComponent: () => import('./pages/auth/logout.component').then(m => m.LogoutComponent) },
	{ path: 'admin/logout', loadComponent: () => import('./pages/auth/logout.component').then(m => m.LogoutComponent) },
	{ path: 'auth', loadComponent: () => import('./pages/auth/auth-landing.component').then(m => m.AuthLandingComponent) },
	{ path: 'verify-email', loadComponent: () => import('./pages/verify-email/verify-email.component').then(m => m.VerifyEmailComponent) },
	{ path: 'forgot-password', loadChildren: () => import('./pages/auth/forgot-password.module').then(m => m.ForgotPasswordModule) },
];
