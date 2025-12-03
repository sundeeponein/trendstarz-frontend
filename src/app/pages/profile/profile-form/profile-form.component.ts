import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-profile-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgSelectModule
  ],
  templateUrl: './profile-form.component.html',
  styleUrls: ['./profile-form.component.scss']
})
export class ProfileFormComponent implements OnInit {
  onCategoryChange(event: any) {
    this.profileForm.get('categories')?.setValue(event);
    this.profileForm.get('categories')?.markAsTouched();
  }

  onDistrictChange(event: any) {
    this.profileForm.get('district')?.setValue(event);
    this.profileForm.get('district')?.markAsTouched();
  }
  // Add/remove social media entries
  addSocialMedia() {
    this.socialMediaFormArray.push(this.fb.group({
      socialMedia: ['', Validators.required],
      handleName: ['', Validators.required],
      followersCount: [0, [Validators.required, Validators.min(0)]],
      tier: ['', Validators.required]
    }));
  }

  removeSocialMedia(index: number) {
    if (this.socialMediaFormArray.length > 1) {
      this.socialMediaFormArray.removeAt(index);
    }
  }
  @Input() isInfluencer = false;
  @Input() isBrand = false;
  @Input() isPremium = false;

  profileForm!: FormGroup;
  categories: any[] = [];
  states: any[] = [];
  districts: any[] = [];
  selectedState: any = null;
  selectedSocialMedia: string = '';
  languages: any[] = [];
  tiers: any[] = [];
  socialMediaList: any[] = [];
  socialMedia: any[] = [];
  profileImages: string[] = [];
  imageError = '';

  get socialMediaFormArray() {
    return this.profileForm.get('socialMedia') as import('@angular/forms').FormArray;
  }

  constructor(private fb: FormBuilder, private http: HttpClient) {}

  ngOnInit() {
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', Validators.required],
      username: [this.isInfluencer ? '' : null, this.isInfluencer ? Validators.required : []],
      categories: [[], Validators.required],
      state: ['', Validators.required],
      district: ['', Validators.required],
      language: ['', Validators.required],
      tier: ['', Validators.required],
      whatsapp: [false],
      emailContact: [false],
      call: [false],
      googleMapLink: [this.isBrand ? '' : null],
      socialMedia: this.fb.array([
        this.fb.group({
          socialMedia: ['', Validators.required],
          handleName: ['', Validators.required],
          followersCount: [0, [Validators.required, Validators.min(0)]],
          tier: ['', Validators.required]
        })
      ])
    });
    this.fetchDropdowns();
    this.profileForm.get('state')?.valueChanges.subscribe(stateId => {
      this.onStateChange(stateId);
    });
  }

  onStateChange(stateId: string) {
    const stateObj = this.states.find(s => s._id === stateId);
    this.selectedState = stateObj;
    this.districts = stateObj ? (stateObj.districts || []).filter((d: any) => d.visible) : [];
    // Only reset if not already set
    if (!this.districts.find(d => d._id === this.profileForm.get('district')?.value)) {
      this.profileForm.get('district')?.setValue('');
    }
  }

  fetchDropdowns() {
    // Fetch categories, states, districts, socialMedia, languages, tiers from adminConfig (localStorage or asset)
    let config: any;
    const saved = localStorage.getItem('adminConfig');
    if (saved) {
      config = JSON.parse(saved);
    } else {
      config = require('../../../../assets/admin-config.json');
    }
    this.categories = (config.categories || []).filter((c: any) => c.visible);
    this.states = (config.locations || []).filter((s: any) => s.visible);
    if (this.profileForm && this.states.length) {
      // Only set value if not already set
      if (!this.profileForm.get('state')?.value) {
        this.profileForm.get('state')?.setValue(this.states[0]._id);
      }
      this.districts = this.states[0].districts.filter((d: any) => d.visible);
    }
    this.languages = (config.languages || []).filter((l: any) => l.visible);
    this.tiers = (config.tiers || []).filter((t: any) => t.visible);
    this.socialMediaList = (config.socialMediaPlatforms || []).filter((sm: any) => sm.visible);
  }

  onImageChange(event: any) {
    const files = event.target.files;
    if (!files.length) return;
    if (!this.isPremium && files.length > 1) {
      this.imageError = 'Only one image allowed for free users.';
      return;
    }
    if (this.isPremium && files.length > 3) {
      this.imageError = 'Maximum 3 images allowed for premium users.';
      return;
    }
    this.imageError = '';
    this.uploadImagesToCloudinary(files);
  }

  uploadImagesToCloudinary(files: FileList) {
  const uploadPreset = 'trendstarz_unsigned';
  const url = 'https://api.cloudinary.com/v1_1/ddnsoypf8/image/upload';
    this.profileImages = [];
    Array.from(files).forEach(file => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      this.http.post(url, formData).subscribe((res: any) => {
        this.profileImages.push(res.secure_url);
      });
    });
  }

  onSubmit() {
    if (this.profileForm.invalid || this.profileImages.length === 0) {
      this.imageError = 'Profile image is required.';
      return;
    }
    const payload = {
      ...this.profileForm.value,
      profileImages: this.profileImages,
      socialMedia: this.socialMedia,
      isPremium: this.isPremium,
    };
    const endpoint = this.isInfluencer ? `${environment.apiBaseUrl}/users/register-influencer` : `${environment.apiBaseUrl}/users/register-brand`;
    this.http.post(endpoint, payload)
      .pipe(timeout(5000), catchError(err => { console.error('registration failed', err); return of(null); }))
      .subscribe(res => {
        // Handle success, show message, redirect, etc.
      });
  }
}
