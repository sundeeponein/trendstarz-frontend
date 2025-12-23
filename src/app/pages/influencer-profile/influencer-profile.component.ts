import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import imageCompression from 'browser-image-compression';

@Component({
  selector: 'app-influencer-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule],
  templateUrl: './influencer-profile.component.html',
  styleUrls: ['./influencer-profile.component.scss']
})
export class InfluencerProfileComponent implements OnInit {
  premiumStart: Date | null = null;
  premiumEnd: Date | null = null;
  showPayment = false;
  selectedDuration: '1m' | '3m' | '1y' | '' = '';
  paymentSuccess = false;
  paymentError = '';
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
  isEditMode = false;
  originalFormValue: any = null;
  submitted = false;
  constructor(private fb: FormBuilder, private configService: ConfigService) {}

  ngOnInit() {
  this.registrationForm = this.fb.group({
      name: [{ value: '', disabled: true }, Validators.required],
      username: [{ value: '', disabled: true }, Validators.required],
      phoneNumber: [{ value: '', disabled: true }, Validators.required],
      email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      paymentOption: [{ value: 'free', disabled: true }, Validators.required],
      location: this.fb.group({
        state: [{ value: '', disabled: true }, Validators.required]
      }),
      languages: [{ value: [], disabled: true }, Validators.required],
      categories: [{ value: [], disabled: true }, Validators.required],
      profileImages: this.fb.array([]),
      socialMedia: this.fb.array([]),
      contact: this.fb.group({
        whatsapp: [{ value: false, disabled: true }],
        email: [{ value: false, disabled: true }],
        call: [{ value: false, disabled: true }]
      })
    });

    // Fetch dropdown data from API
    this.configService.getStates().subscribe(data => this.states = data);
    this.configService.getTiers().subscribe(data => this.tiers = data);
    this.configService.getSocialMedia().subscribe(data => this.socialMediaList = data);
    this.configService.getLanguages().subscribe(data => this.languagesList = data);
    this.configService.getCategories().subscribe(data => this.categoriesList = data);

    // Fetch influencer profile and patch form
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      this.configService.getInfluencerProfileById(token).subscribe({
        next: (profile) => {
          if (!profile) {
            this.registrationError = 'Profile not found or you are not logged in.';
            return;
          }
          // Map state name to ID
          const stateId = this.states.find(s => s.name === profile.location?.state)?.['_id'] || '';
          // Map language names to IDs
          const languageIds = (profile.languages || []).map((name: string) =>
            this.languagesList.find(l => l.name === name)?._id
          ).filter(Boolean);
          // Map category names to IDs
          const categoryIds = (profile.categories || []).map((name: string) =>
            this.categoriesList.find(c => c.name === name)?._id
          ).filter(Boolean);
          // Map social media platform name to ID
          const socialMedia = (profile.socialMedia || []).map((sm: any) => ({
            ...sm,
            platform: this.socialMediaList.find(s => s.name === sm.platform)?._id || sm.platform
          }));
          this.registrationForm.patchValue({
            name: profile.name || '',
            username: profile.username || '',
            phoneNumber: profile.phoneNumber || '',
            email: profile.email || '',
            paymentOption: profile.paymentOption || 'free',
            location: { state: stateId },
            languages: languageIds,
            categories: categoryIds,
            contact: profile.contact || { whatsapp: false, email: false, call: false }
          });
          // Patch profileImages
          const arr = this.registrationForm.get('profileImages') as FormArray;
          arr.clear();
          (profile.profileImages || []).forEach((img: any) => arr.push(this.fb.group({
            url: img.url,
            public_id: img.public_id
          })));
          // Patch socialMedia
          const smArr = this.registrationForm.get('socialMedia') as FormArray;
          smArr.clear();
          socialMedia.forEach((sm: any) => {
            smArr.push(this.fb.group({
              platform: sm.platform || '',
              handle: sm.handle || '',
              tier: sm.tier || '',
              followersCount: sm.followersCount || ''
            }));
          });
          this.originalFormValue = this.registrationForm.getRawValue();
          // Set premium period if available
          this.premiumStart = profile.premiumStart ? new Date(profile.premiumStart) : null;
          this.premiumEnd = profile.premiumEnd ? new Date(profile.premiumEnd) : null;
        },
        error: (err) => {
          this.registrationError = 'Error fetching profile.';
        }
      });
    }
  }

  payAndUpgrade() {
    this.paymentError = '';
    this.paymentSuccess = false;
    if (!this.selectedDuration) {
      this.paymentError = 'Please select a premium duration.';
      // Close the modal after showing the error
      setTimeout(() => {
        this.showPayment = false;
        this.paymentError = '';
      }, 1200);
      return;
    }
    // Simulate payment (replace with real payment integration as needed)
    // On success, call backend to set premium
    const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
    if (!token) {
      this.paymentError = 'Not logged in.';
      return;
    }
    // Call backend PATCH to set premium
    this.configService.setPremiumForCurrentUser(true, this.selectedDuration, token).subscribe({
      next: (res: any) => {
        this.paymentSuccess = true;
        this.showPayment = false;
        // Refresh profile to show premium status
        this.ngOnInit();
      },
      error: (err) => {
        this.paymentError = 'Payment failed or could not upgrade. Please try again.';
      }
    });
  }

  async enableEdit(): Promise<void> {
    // Always fetch and patch the latest profile before edit
    await this.fetchAndPatchProfile();
    this.isEditMode = true;
    this.registrationForm.enable();
    // Keep password fields disabled for security
    this.registrationForm.get('password')?.disable();
    this.registrationForm.get('confirmPassword')?.disable();
  }

  cancelEdit(): void {
    this.isEditMode = false;
    if (this.originalFormValue) {
      this.registrationForm.reset(this.originalFormValue);
    }
    this.registrationForm.disable();
    this.registrationForm.get('password')?.disable();
    this.registrationForm.get('confirmPassword')?.disable();
  }

  get profileImagesFormArray() {
    return this.registrationForm.get('profileImages') as FormArray;
  }


  // Only allow 1 image for now (can extend for premium)
  async onProfileImageFileChange(event: any) {
    if (!this.isEditMode) return;
    this.profileImagePreview = null;
    this.profileImageFile = null;
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    // Compress and resize before upload
    try {
      const options = {
        maxSizeMB: 0.2, // 200 KB
        maxWidthOrHeight: 1024,
        useWebWorker: true
      };
      const compressedFile = await imageCompression(file, options);
      this.profileImageFile = compressedFile;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profileImagePreview = e.target.result;
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      alert('Image compression failed.');
      return;
    }
  }

  removeProfileImage(index: number) {
    if (!this.isEditMode) return;
    this.profileImagesFormArray.removeAt(index);
  }



  get socialMediaFormArray() {
    return this.registrationForm.get('socialMedia') as FormArray;
  }

  addSocialMedia() {
    if (!this.isEditMode) return;
    this.socialMediaFormArray.push(this.fb.group({
      platform: ['', Validators.required],
      handle: ['', Validators.required],
      tier: ['', Validators.required],
      followersCount: ['', Validators.required]
    }));
  }

  removeSocialMedia(index: number) {
    if (!this.isEditMode) return;
    if (this.socialMediaFormArray.length > 1) {
      this.socialMediaFormArray.removeAt(index);
    }
      this.submitted = true; // Set submitted to true on form submission
  }



  async onSubmit() {
    if (!this.isEditMode || this.registrationForm.invalid || (!this.profileImagePreview && (!this.profileImagesFormArray.controls.length || !this.profileImagesFormArray.at(0).value || !this.profileImagesFormArray.at(0).value.url))) {
      if (!this.profileImagePreview && (!this.profileImagesFormArray.controls.length || !this.profileImagesFormArray.at(0).value || !this.profileImagesFormArray.at(0).value.url)) {
        this.registrationError = 'Profile image is required.';
      }
      return;
    }
    this.registrationError = '';
    this.registrationSuccess = false;
    const raw = this.registrationForm.getRawValue();
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
    // Handle Cloudinary upload for profile image if file selected
    let profileImages: { url: string, public_id: string }[] = [];
    if (this.profileImageFile) {
      try {
        const formData = new FormData();
        formData.append('file', this.profileImageFile);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (data.secure_url && data.public_id) {
          // Always include all images present in the FormArray (old image)
          profileImages = [
            ...raw.profileImages.filter((img: any) => img && typeof img === 'object' && 'url' in img && 'public_id' in img),
            { url: data.secure_url, public_id: data.public_id }
          ];
        } else {
          this.registrationError = 'Profile image upload failed.';
          return;
        }
      } catch (err) {
        this.registrationError = 'Profile image upload failed.';
        return;
      }
    } else if (raw.profileImages && Array.isArray(raw.profileImages) && raw.profileImages.length > 0) {
      // If editing and image already exists, just send it as-is
      profileImages = raw.profileImages.filter((img: any) => img && typeof img === 'object' && 'url' in img && 'public_id' in img);
    }
    const payload: any = {
      ...raw,
      location: {
        state: stateObj ? stateObj.name : raw.location.state
      },
      languages: languageNames,
      categories: categoryNames,
      socialMedia,
      profileImages,
      contact: raw.contact
    };
    // Debug log: print PATCH payload
    console.log('[PATCH payload]', JSON.stringify(payload, null, 2));
    let token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
    this.configService.updateInfluencerProfile(payload, token).subscribe({
      next: (res: any) => {
        console.log('[PATCH response]', res);
        this.registrationSuccess = true;
        this.isEditMode = false;
        this.registrationForm.disable();
        this.profileImagePreview = null;
        this.profileImageFile = null;
        // After PATCH, clear FormArray and keep only the latest image
        const arr = this.profileImagesFormArray;
        if (arr.length > 0) {
          const lastImage = arr.at(arr.length - 1).value;
          arr.clear();
          arr.push(this.fb.group({
            url: lastImage.url,
            public_id: lastImage.public_id
          }));
        }
        this.registrationForm.get('password')?.disable();
        this.registrationForm.get('confirmPassword')?.disable();
        this.originalFormValue = this.registrationForm.getRawValue();
      },
      error: err => {
        this.registrationError = 'Update failed. Please try again.';
        console.error('[PATCH error]', err);
      }
    });
  }

  async fetchAndPatchProfile(): Promise<void> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      await new Promise<void>((resolve) => {
        this.configService.getInfluencerProfileById(token).subscribe({
          next: (profile: any) => {
            if (!profile || !this.registrationForm) {
              this.registrationError = 'Profile not found or you are not logged in.';
              resolve();
              return;
            }
            const stateId = (this.states || []).find((s: any) => s.name === profile.location?.state)?.['_id'] || '';
            const languageIds = (profile.languages || []).map((name: string) =>
              (this.languagesList || []).find((l: any) => l.name === name)?._id
            ).filter(Boolean);
            const categoryIds = (profile.categories || []).map((name: string) =>
              (this.categoriesList || []).find((c: any) => c.name === name)?._id
            ).filter(Boolean);
            const socialMedia = (profile.socialMedia || []).map((sm: any) => ({
              ...sm,
              platform: (this.socialMediaList || []).find((s: any) => s.name === sm.platform)?._id || sm.platform
            }));
            this.registrationForm.patchValue({
              name: profile.name || '',
              username: profile.username || '',
              phoneNumber: profile.phoneNumber || '',
              email: profile.email || '',
              paymentOption: profile.paymentOption || 'free',
              location: { state: stateId },
              languages: languageIds,
              categories: categoryIds,
              contact: profile.contact || { whatsapp: false, email: false, call: false }
            });
            const arr = this.registrationForm.get('profileImages') as FormArray;
            if (arr) {
              arr.clear();
              (profile.profileImages || []).forEach((img: any) => arr.push(this.fb.group({
                url: img.url,
                public_id: img.public_id
              })));
            }
            const smArr = this.registrationForm.get('socialMedia') as FormArray;
            if (smArr) {
              smArr.clear();
              socialMedia.forEach((sm: any) => {
                smArr.push(this.fb.group({
                  platform: sm.platform || '',
                  handle: sm.handle || '',
                  tier: sm.tier || '',
                  followersCount: sm.followersCount || ''
                }));
              });
            }
            this.originalFormValue = this.registrationForm.getRawValue();
            this.premiumStart = profile.premiumStart ? new Date(profile.premiumStart) : null;
            this.premiumEnd = profile.premiumEnd ? new Date(profile.premiumEnd) : null;
            resolve();
          },
          error: () => {
            this.registrationError = 'Error fetching profile.';
            resolve();
          }
        });
      });
    }
  }
}

