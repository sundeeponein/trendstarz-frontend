import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import imageCompression from 'browser-image-compression';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

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
  constructor(private fb: FormBuilder, private configService: ConfigService) {}

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
      })
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
  onProfileImageFileChange(event: any) {
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be below 2MB.');
      return;
    }
    this.profileImageFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.profileImagePreview = e.target.result;
    };
    reader.readAsDataURL(file);
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
    if (this.registrationForm.invalid) return;
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
    // Step 1: Register influencer without images
    const payload: any = {
      ...raw,
      location: {
        state: stateObj ? stateObj.name : raw.location.state
      },
      languages: languageNames,
      categories: categoryNames,
      socialMedia,
      profileImages: [], // Don't send images yet
      contact: raw.contact
    };
    this.configService.registerInfluencer(payload).subscribe({
      next: (savedInfluencer) => {
        console.log('Registration response:', savedInfluencer);
        // Step 2: Upload image to Cloudinary if selected
        let influencerId = '';
        // Handle both {success, message, influencer} and direct influencer object
        let influencerObj = savedInfluencer && savedInfluencer.influencer ? savedInfluencer.influencer : savedInfluencer;
        if (influencerObj && (typeof influencerObj._id === 'string' || typeof influencerObj._id === 'object')) {
          influencerId = influencerObj._id.toString();
        } else if (influencerObj && influencerObj.id) {
          influencerId = influencerObj.id.toString();
        }
        if (!influencerId || influencerId === 'undefined') {
          this.registrationError = 'Could not determine influencer ID for image upload.';
          return;
        }
        if (this.profileImageFile) {
          const formData = new FormData();
          formData.append('file', this.profileImageFile);
          formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
          fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
          })
            .then(response => response.json())
            .then(data => {
              if (data.secure_url && data.public_id) {
                // Step 3: PATCH user with image info
                this.configService.updateUserImages(influencerId, {
                  profileImages: [{ url: data.secure_url, public_id: data.public_id }]
                }).subscribe({
                  next: (res) => {
                    console.log('PATCH success:', res);
                    setTimeout(() => {
                      this.registrationSuccess = true;
                    }, 0);
                  },
                  error: (err) => {
                    console.error('PATCH error:', err);
                    this.registrationError = 'Image update failed after registration.';
                  }
                });
              } else {
                this.registrationError = 'Profile image upload failed.';
              }
            })
            .catch((err) => {
              console.error('Cloudinary upload error:', err);
              this.registrationError = 'Profile image upload failed.';
            });
        } else {
          // No image to upload, registration complete
          setTimeout(() => {
            this.registrationSuccess = true;
          }, 0);
          // Do not reset form here; let modal show
        }
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
  }


}
