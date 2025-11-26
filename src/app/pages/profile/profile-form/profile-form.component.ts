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
  @Input() isInfluencer = false;
  @Input() isBrand = false;
  @Input() isPremium = false;

  profileForm!: FormGroup;
  categories: any[] = [];
  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];
  socialMedia: any[] = [];
  profileImages: string[] = [];
  imageError = '';

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
      whatsapp: [false],
      emailContact: [false],
      call: [false],
      googleMapLink: [this.isBrand ? '' : null],
    });
    this.fetchDropdowns();
  }

  fetchDropdowns() {
    // Fetch categories, states, districts, socialMedia from backend with timeout and graceful fallback
    this.http.get(`${environment.apiBaseUrl}/categories`)
      .pipe(timeout(5000), catchError(err => { console.error('categories fetch failed', err); return of([]); }))
      .subscribe((res: any) => this.categories = res || []);
    this.http.get(`${environment.apiBaseUrl}/states`)
      .pipe(timeout(5000), catchError(err => { console.error('states fetch failed', err); return of([]); }))
      .subscribe((res: any) => this.states = res || []);
    this.http.get(`${environment.apiBaseUrl}/districts`)
      .pipe(timeout(5000), catchError(err => { console.error('districts fetch failed', err); return of([]); }))
      .subscribe((res: any) => this.districts = res || []);
    this.http.get(`${environment.apiBaseUrl}/social-media`)
      .pipe(timeout(5000), catchError(err => { console.error('social-media fetch failed', err); return of([]); }))
      .subscribe((res: any) => this.socialMediaList = res || []);
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
    const uploadPreset = 'YOUR_CLOUDINARY_PRESET';
    const url = 'https://api.cloudinary.com/v1_1/YOUR_CLOUDINARY_CLOUD_NAME/image/upload';
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
