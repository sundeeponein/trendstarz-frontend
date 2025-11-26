import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DropdownComponent } from '../../../shared/dropdown.component';
import { UserCardComponent } from '../../../shared/user-card/user-card.component';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-profile-view-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    UserCardComponent,
    NgSelectModule
  ],
  templateUrl: './profile-view-edit.component.html',
  styleUrls: ['./profile-view-edit.component.scss']
})
export class ProfileViewEditComponent implements OnInit {
  profileForm!: FormGroup;
  user: any = null;
  isPremium = false;
  isInfluencer = false;
  isBrand = false;
  editMode = false;
  categories: any[] = [];
  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];
  profileImages: string[] = [];
  imageError = '';

  constructor(private http: HttpClient, private fb: FormBuilder) {}

  ngOnInit() {
    this.fetchUserProfile();
    this.fetchDropdowns();
  }

  fetchUserProfile() {
    this.http.get('/api/users/me').subscribe((user: any) => {
      this.user = user;
      this.isPremium = user.isPremium;
      this.isInfluencer = !!user.username;
      this.isBrand = !!user.brandName;
      this.profileImages = user.profileImages || user.brandLogo || [];
      this.initForm();
    });
  }

  fetchDropdowns() {
    this.http.get('/api/categories').subscribe((res: any) => this.categories = res);
    this.http.get('/api/states').subscribe((res: any) => this.states = res);
    this.http.get('/api/districts').subscribe((res: any) => this.districts = res);
    this.http.get('/api/social-media').subscribe((res: any) => this.socialMediaList = res);
  }

  initForm() {
    this.profileForm = this.fb.group({
      name: [this.user.name || '', Validators.required],
      email: [this.user.email || '', [Validators.required, Validators.email]],
      phoneNumber: [this.user.phoneNumber || '', Validators.required],
      username: [this.isInfluencer ? this.user.username : null, this.isInfluencer ? Validators.required : []],
      brandName: [this.isBrand ? this.user.brandName : null],
      categories: [this.user.categories || [], Validators.required],
      state: [this.user.location?.state || '', Validators.required],
      district: [this.user.location?.district || '', Validators.required],
      whatsapp: [this.user.contact?.whatsapp || false],
      emailContact: [this.user.contact?.email || false],
      call: [this.user.contact?.call || false],
      googleMapLink: [this.isBrand ? this.user.location?.googleMapLink : null],
    });
  }

  enableEdit() {
    this.editMode = true;
  }

  cancelEdit() {
    this.editMode = false;
    this.initForm();
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
      isPremium: this.isPremium,
    };
    this.http.patch('/api/users/me', payload).subscribe(res => {
      this.editMode = false;
      this.fetchUserProfile();
    });
  }
}
