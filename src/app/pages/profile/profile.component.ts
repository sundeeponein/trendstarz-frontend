import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormArray, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  states: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];

  isPremium = false;
  justUpgraded = false;
  constructor(private fb: FormBuilder, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['upgraded']) {
        this.justUpgraded = true;
      }
    });
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      contact: ['', Validators.required],
      paymentOption: ['free', Validators.required],
      state: ['', Validators.required],
      website: [''],
      googleMapAddress: [''],
      profileImages: this.fb.array([]),
      productImages: this.fb.array([]),
      socialMedia: this.fb.array([
        this.fb.group({
          platform: ['', Validators.required],
          handle: ['', Validators.required],
          tier: ['', Validators.required],
          count: ['', Validators.required]
        })
      ])
    });
    // TODO: Fetch user data and fill form for edit
    this.profileForm.get('paymentOption')?.valueChanges.subscribe(val => {
      this.isPremium = val === 'premium';
    });
  }

  get profileImagesFormArray() {
    return this.profileForm.get('profileImages') as FormArray;
  }
  addProfileImage() {
    if (this.profileImagesFormArray.length < (this.isPremium ? 3 : 0)) {
      this.profileImagesFormArray.push(this.fb.control('', Validators.required));
    }
  }
  removeProfileImage(index: number) {
    this.profileImagesFormArray.removeAt(index);
  }

  get productImagesFormArray() {
    return this.profileForm.get('productImages') as FormArray;
  }
  addProductImage() {
    if (this.productImagesFormArray.length < (this.isPremium ? 5 : 0)) {
      this.productImagesFormArray.push(this.fb.control('', Validators.required));
    }
  }
  removeProductImage(index: number) {
    this.productImagesFormArray.removeAt(index);
  }

  get socialMediaFormArray() {
    return this.profileForm.get('socialMedia') as FormArray;
  }

  addSocialMedia() {
    this.socialMediaFormArray.push(this.fb.group({
      platform: ['', Validators.required],
      handle: ['', Validators.required],
      tier: ['', Validators.required],
      count: ['', Validators.required]
    }));
  }

  removeSocialMedia(index: number) {
    if (this.socialMediaFormArray.length > 1) {
      this.socialMediaFormArray.removeAt(index);
    }
  }

  onSubmit() {
    if (this.profileForm.invalid) return;
    // TODO: Handle profile update logic
  }

    goToPayment() {
      // Save form if needed, then redirect to payment page
      window.location.href = '/payment';
    }
}
