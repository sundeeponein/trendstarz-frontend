import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/auth/login.component';
import { AdminUserTableComponent } from './pages/admin/admin-user-table.component';
import { NavbarLayoutComponent } from './layout/navbar-layout.component';
import { NoNavbarLayoutComponent } from './layout/no-navbar-layout.component';

import { AdminManagementComponent } from './pages/admin/admin-management.component';
import { AdminLayoutComponent } from './layout/admin-layout.component';

const routes: Routes = [
  {
    path: '',
    component: NavbarLayoutComponent,
    children: [
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
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
