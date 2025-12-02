import { Routes } from '@angular/router';
import { WelcomeComponent } from './pages/welcome/welcome.component';
import { LoginComponent } from './pages/auth/login.component';
import { RegisterComponent } from './pages/auth/register.component';
import { AdminUserTableComponent } from './pages/admin/admin-user-table.component';
import { AdminManagementComponent } from './pages/admin/admin-management.component';
import { AdminLayoutComponent } from './layout/admin-layout.component';

import { Component } from '@angular/core';
export const DummyLogoutComponent = Component({
	selector: 'app-logout',
	template: '<div>Logging out...</div>'
})(class {});

export const routes: Routes = [
	{ path: '', component: WelcomeComponent },
	{ path: 'login', component: LoginComponent },
	{ path: 'register', component: RegisterComponent },
	{
		path: 'admin',
		component: AdminLayoutComponent,
		children: [
			{ path: '', redirectTo: 'admin-user-table', pathMatch: 'full' },
			{ path: 'admin-user-table', component: AdminUserTableComponent },
			{ path: 'admin-management', component: AdminManagementComponent },
		]
	},
	{ path: 'logout', component: DummyLogoutComponent },
	// Add other routes as needed
];
