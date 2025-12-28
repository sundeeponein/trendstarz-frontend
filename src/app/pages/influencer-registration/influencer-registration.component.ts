import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import imageCompression from 'browser-image-compression';
import { Component, OnInit, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidatorFn } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

// Custom validator to require at least one contact option
export const atLeastOneContactRequired: ValidatorFn = (control: AbstractControl) => {
  if (!control || !control.value) return { required: true };
  const { whatsapp, email, call } = control.value;
  return whatsapp || email || call ? null : { required: true };
};

@Component({
  selector: 'app-influencer-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule],
  templateUrl: './influencer-registration.component.html',
  styleUrls: ['./influencer-registration.component.scss']
})
export class InfluencerRegistrationComponent implements OnInit {
  registrationSuccess = false;
  registrationError = '';
  registrationForm!: FormGroup;
  states: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];

  profileImagePreview: string | null = null;
  profileImageFile: File | null = null;
  languagesList: any[] = [];
  categoriesList: any[] = [];
  submitted = false;
  constructor(private fb: FormBuilder, private configService: ConfigService, private ngZone: NgZone) {}

  ngOnInit() {
    this.registrationForm = this.fb.group({
      name: ['', Validators.required],
      username: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required],
      paymentOption: ['free', Validators.required],
      location: this.fb.group({
        state: ['', Validators.required]
      }),
  promotionalPrice: ['', Validators.required],
      languages: [[], Validators.required],
      categories: [[], Validators.required],
      profileImages: this.fb.array([]),
      socialMedia: this.fb.array([
        this.fb.group({
          platform: ['', Validators.required],
          handle: ['', Validators.required],
          tier: ['', Validators.required],
          followersCount: ['', Validators.required]
        })
      ]),
      contact: this.fb.group({
        whatsapp: [false],
        email: [false],
        call: [false]
      }, { validators: [atLeastOneContactRequired] }),
    });
    // Only reset success/error flags if the form is dirty and success is showing
    this.registrationForm.valueChanges.subscribe(() => {
      if (this.registrationSuccess && this.registrationForm.dirty) {
        this.registrationSuccess = false;
      }
      if (this.registrationError && this.registrationForm.dirty) {
        this.registrationError = '';
      }
    });
    // removed misplaced property declarations

    // Fetch dropdown data from API
    this.configService.getStates().subscribe(data => this.states = data);
    this.configService.getTiers().subscribe(data => this.tiers = data);
    this.configService.getSocialMedia().subscribe(data => this.socialMediaList = data);
    this.configService.getLanguages().subscribe(data => this.languagesList = data);
    this.configService.getCategories().subscribe(data => this.categoriesList = data);

  }

  get profileImagesFormArray() {
    return this.registrationForm.get('profileImages') as FormArray;
  }



  // Only allow 1 image for now (can extend for premium)

  async onProfileImageFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    // Only compress and preview locally, do not upload yet
    const options = {
      maxSizeMB: 0.1, // Target max size (100 KB)
      maxWidthOrHeight: 1024, // Resize if larger than 1024px
      useWebWorker: true
    };
    try {
      const compressedFile = await imageCompression(file, options);
      // Generate local preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profileImagePreview = e.target.result;
        this.profileImageFile = compressedFile;
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Image compression error:', error);
    }
  }

  removeProfileImage(index: number) {
    this.profileImagesFormArray.removeAt(index);
  }

    goToPayment() {
      // Save form if needed, then redirect to payment page
      window.location.href = '/payment';
    }

  get socialMediaFormArray() {
    return this.registrationForm.get('socialMedia') as FormArray;
  }

  addSocialMedia() {
    this.socialMediaFormArray.push(this.fb.group({
      platform: ['', Validators.required],
      handle: ['', Validators.required],
      tier: ['', Validators.required],
      followersCount: ['', Validators.required]
    }));
  }

  removeSocialMedia(index: number) {
    if (this.socialMediaFormArray.length > 1) {
      this.socialMediaFormArray.removeAt(index);
    }
  }



  async onSubmit() {
    this.submitted = true;
    if (this.registrationForm.invalid || !this.profileImagePreview) {
      if (!this.profileImagePreview) {
        this.registrationError = 'Profile image is required.';
      }
      return;
    }
    this.registrationError = '';
    this.registrationSuccess = false;
    const raw = this.registrationForm.value;
    // Map state ID to name
    const stateObj = this.states.find(s => s._id === raw.location.state);
    // Map language IDs to names
    const languageNames = (raw.languages || []).map((id: string) => {
      const lang = this.languagesList.find((l: any) => l._id === id);
      return lang ? lang.name : id;
    });
    // Map category IDs to names
    const categoryNames = (raw.categories || []).map((id: string) => {
      const cat = this.categoriesList.find((c: any) => c._id === id);
      return cat ? cat.name : id;
    });
    // Map social media platform ID to name
    const socialMedia = (raw.socialMedia || []).map((sm: any) => {
      const platformObj = this.socialMediaList.find((s: any) => s._id === sm.platform);
      return {
        ...sm,
        platform: platformObj ? platformObj.name : sm.platform,
        followersCount: Number(sm.followersCount)
      };
    });
    // Step 1: Upload image to Cloudinary if selected
    let imageUploadResult: { url: string, public_id: string } | null = null;
    if (this.profileImageFile) {
      const formData = new FormData();
      formData.append('file', this.profileImageFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (data.secure_url && data.public_id) {
          imageUploadResult = { url: data.secure_url, public_id: data.public_id };
        } else {
          this.registrationError = 'Profile image upload failed.';
          return;
        }
      } catch (err) {
        this.registrationError = 'Profile image upload failed.';
        return;
      }
    }
    // Step 2: Register influencer with image info
    const payload: any = {
      ...raw,
      location: {
        state: stateObj ? stateObj.name : raw.location.state
      },
      promotionalPrice: raw.promotionalPrice,
      languages: languageNames,
      categories: categoryNames,
      socialMedia,
      profileImages: imageUploadResult ? [imageUploadResult] : [],
      contact: raw.contact
    };
    this.configService.registerInfluencer(payload).subscribe({
      next: (savedInfluencer) => {
        this.ngZone.run(() => {
          this.registrationSuccess = true;
          this.registrationForm.reset();
          this.profileImagePreview = null;
          this.profileImageFile = null;
          this.submitted = false;
        });
      },
      error: err => {
        if (err?.error?.message && err.error.message.includes('already exists')) {
          this.registrationError = err.error.message;
        } else {
          this.registrationError = 'Registration failed. Please try again.';
        }
      }
    });
  }

  // Add a method to close the modal and reset the form
  closeSuccessModal() {
  this.registrationSuccess = false;
  this.registrationForm.reset();
  this.profileImagePreview = null;
  this.profileImageFile = null;
  this.submitted = false;
  }


}
