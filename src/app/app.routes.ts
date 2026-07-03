import { Routes } from '@angular/router';
import { NavbarLayoutComponent } from './layout/navbar-layout/navbar-layout.component';
import { NoNavbarLayoutComponent } from './layout/no-navbar/no-navbar-layout.component';
import { AdminLayoutComponent } from './layout/admin-layout/admin-layout.component';
import { authGuard } from './core/auth.guard';
import { guestOnlyGuard, nonAdminSearchGuard } from './core/public-route.guard';

export const routes: Routes = [
  	{
    path: '',
    component: NavbarLayoutComponent,
		children: [
			{ path: '', loadComponent: () => import('./pages/welcome/welcome.component').then(m => m.WelcomeComponent) },
			{ path: 'welcome', loadComponent: () => import('./pages/welcome/welcome.component').then(m => m.WelcomeComponent) },
			{ path: 'search', canActivate: [nonAdminSearchGuard], loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent) },
			{ path: 'faqs', loadComponent: () => import('./pages/faqs/faqs.component').then(m => m.FaqsComponent) },
			{ path: 'why-trendstarz', loadComponent: () => import('./pages/why-trendstarz/why-trendstarz.component').then(m => m.WhyTrendstarzComponent) },
			{ path: 'features', loadComponent: () => import('./pages/how-it-works/how-it-works.component').then(m => m.HowItWorksComponent) },
			{ path: 'features/influencers', loadComponent: () => import('./pages/how-it-works/how-it-works.component').then(m => m.HowItWorksComponent), data: { audience: 'influencer' } },
			{ path: 'features/brands', loadComponent: () => import('./pages/how-it-works/how-it-works.component').then(m => m.HowItWorksComponent), data: { audience: 'brand' } },
			{ path: 'features/photographers', loadComponent: () => import('./pages/how-it-works/how-it-works.component').then(m => m.HowItWorksComponent), data: { audience: 'photographer' } },
			{ path: 'how-it-works', loadComponent: () => import('./pages/how-it-works/how-it-works.component').then(m => m.HowItWorksComponent) },
			{ path: 'how-it-works/influencers', loadComponent: () => import('./pages/how-it-works/how-it-works.component').then(m => m.HowItWorksComponent), data: { audience: 'influencer' } },
			{ path: 'how-it-works/brands', loadComponent: () => import('./pages/how-it-works/how-it-works.component').then(m => m.HowItWorksComponent), data: { audience: 'brand' } },
			{ path: 'how-it-works/photographers', loadComponent: () => import('./pages/how-it-works/how-it-works.component').then(m => m.HowItWorksComponent), data: { audience: 'photographer' } },
			// static pages legal
			{ path: 'privacy-policy', loadComponent: () => import('./legal/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent) },
			{ path: 'terms-and-conditions', loadComponent: () => import('./legal/terms/terms.component').then(m => m.TermsComponent) },
			{ path: 'refund-policy', loadComponent: () => import('./legal/refund-policy/refund-policy.component').then(m => m.RefundPolicyComponent) },
			{ path: 'community-guidelines', loadComponent: () => import('./legal/community-guidelines/community-guidelines.component').then(m => m.CommunityGuidelinesComponent) },
			{ path: 'contact', loadComponent: () => import('./legal/contact/contact.component').then(m => m.ContactComponent) },
			// user/brand/influencer pages
			{ path: 'register-influencer', canActivate: [guestOnlyGuard], loadComponent: () => import('./pages/influencer-registration/influencer-registration.component').then(m => m.InfluencerRegistrationComponent) },
			{ path: 'register-brand', canActivate: [guestOnlyGuard], loadComponent: () => import('./pages/brand-registration/brand-registration.component').then(m => m.BrandRegistrationComponent) },
			{ path: 'register-photographer', canActivate: [guestOnlyGuard], loadComponent: () => import('./pages/photographer-registration/photographer-registration.component').then(m => m.PhotographerRegistrationComponent) },
			{ path: 'influencer-profile', canActivate: [authGuard], loadComponent: () => import('./pages/influencer-profile/influencer-profile.component').then(m => m.InfluencerProfileComponent) },
			{ path: 'influencer/:username', loadChildren: () => import('./shared/user-profile/influencer-profile-view/influencer-profile-view.route').then(m => m.default) },
			{ path: 'brand-profile', canActivate: [authGuard], loadComponent: () => import('./pages/brand-profile/brand-profile.component').then(m => m.BrandProfileComponent) },
			{ path: 'photographer-profile', canActivate: [authGuard], loadComponent: () => import('./pages/photographer-profile/photographer-profile.component').then(m => m.PhotographerProfileComponent) },
			{ path: 'profile-verification', canActivate: [authGuard], loadComponent: () => import('./pages/profile-verification/profile-verification-dashboard.component').then(m => m.ProfileVerificationDashboardComponent) },
			{ path: 'photographer-dashboard', canActivate: [authGuard], loadComponent: () => import('./pages/photographer-dashboard/photographer-dashboard.component').then(m => m.PhotographerDashboardComponent) },
			{ path: 'photographer/:username', loadChildren: () => import('./shared/user-profile/photographer-profile-view/photographer-profile-view.route').then(m => m.default) },
			{ path: 'campaigns/new', canActivate: [authGuard], loadComponent: () => import('./pages/campaign-form-page/campaign-form-page.component').then(m => m.CampaignFormPageComponent) },
			{ path: 'campaigns/:id/edit', canActivate: [authGuard], loadComponent: () => import('./pages/campaign-form-page/campaign-form-page.component').then(m => m.CampaignFormPageComponent) },
			{ path: 'campaigns', canActivate: [authGuard], loadComponent: () => import('./pages/campaign-management/campaign-management.component').then(m => m.CampaignManagementComponent) },
			{ path: 'brand/:brandName', loadChildren: () => import('./shared/user-profile/brand-profile-view/brand-profile-view.route').then(m => m.default) },
			{ path: 'upgrade-premium', canActivate: [authGuard], loadComponent: () => import('./pages/premium-upgrade/premium-upgrade.component').then(m => m.PremiumUpgradeComponent) },
			{ path: 'campaign-pay/:campaignId', canActivate: [authGuard], loadComponent: () => import('./pages/campaign-pay/campaign-pay.component').then(m => m.CampaignPayComponent) },
			{ path: 'campaign-payment/:campaignId', canActivate: [authGuard], loadComponent: () => import('./pages/campaign-payment-page/campaign-payment-page.component').then(m => m.CampaignPaymentPageComponent) },
			{ path: 'payment-history', canActivate: [authGuard], loadComponent: () => import('./pages/payment-history/payment-history.component').then(m => m.PaymentHistoryComponent) },
			{ path: 'transactions', canActivate: [authGuard], loadComponent: () => import('./pages/transactions/transactions.component').then(m => m.TransactionsComponent) },
			{ path: 'settings', canActivate: [authGuard], loadComponent: () => import('./pages/user-settings/user-settings.component').then(m => m.UserSettingsComponent) },
			// DASHBOARDS
			{ path: 'influencer-dashboard', canActivate: [authGuard], loadComponent: () => import('./pages/influencer-dashboard/influencer-dashboard.component').then(m => m.InfluencerDashboardComponent) },
			{ path: 'campaign-submission/:inviteId/:slug', canActivate: [authGuard], loadComponent: () => import('./pages/campaign-submission/campaign-submission.component').then(m => m.CampaignSubmissionComponent) },
			{ path: 'campaign-submission/:inviteId', canActivate: [authGuard], loadComponent: () => import('./pages/campaign-submission/campaign-submission.component').then(m => m.CampaignSubmissionComponent) },
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
			{ path: 'admin-user-table', loadComponent: () => import('./pages/admin/admin-users-table/admin-user-table.component').then(m => m.AdminUserTableComponent) },
			{ path: 'campaign-review', loadComponent: () => import('./pages/admin/campaign-review/campaign-review.component').then(m => m.CampaignReviewComponent) },
			{ path: 'collaboration-review', loadComponent: () => import('./pages/admin/campaign-review/campaign-review.component').then(m => m.CampaignReviewComponent) },
			{ path: 'admin-management', loadComponent: () => import('./pages/admin/admin-management/admin-management.component').then(m => m.AdminManagementComponent) },
			{ path: 'payments', loadComponent: () => import('./features/payments-payouts/admin-payments/admin-payments.component').then(m => m.AdminPaymentsComponent) },			{ path: 'plans', loadComponent: () => import('./pages/admin/admin-plans/admin-plans.component').then(m => m.AdminPlansComponent) },			{ path: 'deleted-users', loadComponent: () => import('./pages/admin/deleted-users-table/deleted-users-table.component').then(m => m.DeletedUsersTableComponent) },
			{ path: 'reviews', loadComponent: () => import('./pages/admin/admin-reviews/admin-reviews.component').then(m => m.AdminReviewsComponent) },
			{ path: 'disputes', loadComponent: () => import('./pages/admin/admin-disputes/admin-disputes.component').then(m => m.AdminDisputesComponent) },
			// Intentionally not linked from admin-layout's nav — reachable only via direct URL or the dashboard widget's link.
			{ path: 'verification-funnel', loadComponent: () => import('./pages/admin/verification-funnel/verification-funnel.component').then(m => m.VerificationFunnelPageComponent) },
			{ path: 'logout', loadComponent: () => import('./pages/auth/logout.component').then(m => m.LogoutComponent) },
		],
	},
	{
		path: '',
		component: NoNavbarLayoutComponent,
		children: [
			{ path: 'login', canActivate: [guestOnlyGuard], loadComponent: () => import('./pages/auth/login.component').then(m => m.LoginComponent) },
			{ path: 'auth/login', canActivate: [guestOnlyGuard], loadComponent: () => import('./pages/auth/login.component').then(m => m.LoginComponent) },
			{ path: '', loadComponent: () => import('./pages/auth/auth-landing.component').then(m => m.AuthLandingComponent) },
		],
	},

	// Top-level routes for SSR/server extraction
	{ path: 'logout', loadComponent: () => import('./pages/auth/logout.component').then(m => m.LogoutComponent) },
	{ path: 'admin/logout', loadComponent: () => import('./pages/auth/logout.component').then(m => m.LogoutComponent) },
	{ path: 'auth', loadComponent: () => import('./pages/auth/auth-landing.component').then(m => m.AuthLandingComponent) },
	{ path: 'verify-email', loadComponent: () => import('./pages/verify-email/verify-email.component').then(m => m.VerifyEmailComponent) },
	{ path: 'forgot-password', loadChildren: () => import('./pages/auth/forgot-password.module').then(m => m.ForgotPasswordModule) },
	{ path: 'reset-password', loadComponent: () => import('./pages/auth/reset-password.component').then(m => m.ResetPasswordComponent) },
	{ path: '**', redirectTo: '' },
];
