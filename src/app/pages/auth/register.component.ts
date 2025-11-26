import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ProfileFormComponent } from '../profile/profile-form/profile-form.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ProfileFormComponent],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  isInfluencer = false;
  isBrand = false;
  isPremium = false;

  constructor(private router: Router) {}

  // Add logic to set isInfluencer/isBrand/isPremium based on user selection
}
