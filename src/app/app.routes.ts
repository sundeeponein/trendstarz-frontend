import { InfluencerRegistrationComponent } from './pages/influencer-registration/influencer-registration.component';
import { BrandRegistrationComponent } from './pages/brand-registration/brand-registration.component';
import { Routes } from '@angular/router';
import { PaymentComponent } from './pages/payment/payment.component';
import { StripePaymentComponent } from './pages/payment/stripe-payment.component';
import { WelcomeComponent } from './pages/welcome/welcome.component';
import { LoginComponent } from './pages/auth/login.component';
import { AdminUserTableComponent } from './pages/admin/admin-users-table/admin-user-table.component';
import { AdminManagementComponent } from './pages/admin/admin-management/admin-management.component';
import { AdminLayoutComponent } from './layout/admin-layout/admin-layout.component';
import { NavbarLayoutComponent } from './layout/navbar-layout/navbar-layout.component';
import { InfluencerProfileComponent } from './pages/influencer-profile/influencer-profile.component';
import { BrandProfileComponent } from './pages/brand-profile/brand-profile.component';
import { DeletedUsersTableComponent } from './pages/admin/deleted-users-table/deleted-users-table.component';

import { Component } from '@angular/core';
export const DummyLogoutComponent = Component({
	selector: 'app-logout',
	template: '<div>Logging out...</div>'
})(class {});

export const routes: Routes = [
	{ path: '', component: WelcomeComponent },
	{ path: 'login', component: LoginComponent },
	{ path: 'register-influencer', component: InfluencerRegistrationComponent },
	{ path: 'register-brand', component: BrandRegistrationComponent },
	{ path: 'payment', component: StripePaymentComponent },
	{
		path: '',
		component: NavbarLayoutComponent,
		children: [
			{ path: 'influencer-profile', component: InfluencerProfileComponent },
			{ path: 'brand-profile', component: BrandProfileComponent },
		]
	},
	{
		path: 'admin',
		component: AdminLayoutComponent,
		   children: [
			   { path: '', redirectTo: 'admin-dashboard', pathMatch: 'full' },
			   { path: 'admin-dashboard', loadComponent: () => import('./pages/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) },
			   { path: 'admin-user-table', component: AdminUserTableComponent },
			   { path: 'admin-management', component: AdminManagementComponent },
               { path: 'deleted-users', component: DeletedUsersTableComponent },
		   ]
	},
	{ path: 'logout', component: DummyLogoutComponent },
	// Add other routes as needed
];
