import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/auth/login.component';
import { RegisterComponent } from './pages/auth/register.component';
import { ProfileViewEditComponent } from './pages/profile/profile-view-edit/profile-view-edit.component';
import { AdminUserTableComponent } from './pages/admin/admin-user-table.component';
import { NavbarLayoutComponent } from './layout/navbar-layout.component';
import { NoNavbarLayoutComponent } from './layout/no-navbar-layout.component';

const routes: Routes = [
  {
    path: '',
    component: NavbarLayoutComponent,
    children: [
      { path: 'profile', component: ProfileViewEditComponent },
      { path: 'admin', component: AdminUserTableComponent },
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
    ],
  },
  {
    path: '',
    component: NoNavbarLayoutComponent,
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
