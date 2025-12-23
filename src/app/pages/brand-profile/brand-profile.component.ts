import { environment } from '../../../environments/environment';
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
import imageCompression from 'browser-image-compression';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-brand-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule],
  templateUrl: './brand-profile.component.html',
  styleUrls: ['./brand-profile.component.scss']
})

export class BrandProfileComponent implements OnInit {
  get brandLogoFormArray(): FormArray {
    return this.registrationForm.get('brandLogo') as FormArray;
  }
  isEditMode = false;
  originalFormValue: any = null;
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
  languagesList: any[] = [];
  categoriesList: any[] = [];
  isPremium = false;
  brandLogoPreview: string | null = null;
  brandLogoFile: File | null = null;
  productImagesPreview: (string | null)[] = [];
  productImagesFiles: (File | string | null)[] = [];
  constructor(public fb: FormBuilder, private configService: ConfigService) {}

  // Getter for brandLogo FormArray
  // Handle brand logo file selection, compress, upload, and preview
  async onBrandLogoFileChange(event: any) {
    if (!this.isEditMode) return;
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
    // Compress image before upload
    const options = {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };
    try {
      const compressedFile = await imageCompression(file, options);
      // Upload to Cloudinary
      this.brandLogoPreview = null;
      this.brandLogoFile = null;
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.secure_url && data.public_id) {
        this.brandLogoPreview = data.secure_url;
        this.brandLogoFile = compressedFile;
      } else {
        this.registrationError = 'Brand logo upload failed.';
      }
    } catch (err) {
      this.registrationError = 'Brand logo upload failed.';
    }
  }

  // Handle product image file selection, compress, upload, and preview
  async onProductImageFileChange(event: any, index: number) {
    if (!this.isEditMode) return;
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
    // Compress image before upload
    const options = {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };
    try {
      const compressedFile = await imageCompression(file, options);
      // Upload to Cloudinary
      this.productImagesPreview[index] = null;
      this.productImagesFiles[index] = null;
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.secure_url && data.public_id) {
        this.productImagesPreview[index] = data.secure_url;
        this.productImagesFiles[index] = compressedFile;
      } else {
        this.registrationError = 'Product image upload failed.';
      }
    } catch (err) {
      this.registrationError = 'Product image upload failed.';
    }
  }

  addBrandLogo() {
    this.brandLogoFormArray.push(this.fb.control(''));
  }

  removeBrandLogo(index: number) {
    if (this.brandLogoFormArray.length > 1) {
      this.brandLogoFormArray.removeAt(index);
    }
  }

  ngOnInit() {
    this.registrationForm = this.fb.group({
      brandName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', Validators.required],
      isPremium: [false],
      paymentOption: ['', Validators.required],
      location: this.fb.group({
        state: ['', Validators.required],
        googleMapLink: ['']
      }),
      categories: [[], Validators.required],
      languages: [[], Validators.required],
      website: [''],
      googleMapAddress: [''],
      brandLogo: this.fb.array([]),
      products: this.fb.array([]),
      productImages: this.fb.array([]),
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
      }),
    });
    // Getter for brandLogo FormArray

      this.registrationForm.get('password')?.disable();
      this.registrationForm.get('confirmPassword')?.disable();

    // Fetch dropdown data from API, then fetch and patch brand profile
    Promise.all([
      this.configService.getStates().toPromise(),
      this.configService.getTiers().toPromise(),
      this.configService.getSocialMedia().toPromise(),
      this.configService.getLanguages().toPromise(),
      this.configService.getCategories().toPromise()
    ]).then(([states, tiers, socialMediaList, languagesList, categoriesList]) => {
      this.states = states || [];
      this.tiers = tiers || [];
      this.socialMediaList = socialMediaList || [];
      this.languagesList = languagesList || [];
      this.categoriesList = categoriesList || [];

      this.registrationForm.get('paymentOption')?.valueChanges.subscribe(val => {
        this.isPremium = val === 'premium';
      });

      // Fetch brand profile and patch form
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        this.configService.getBrandProfileById(token).subscribe({
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
              brandName: profile.brandName || '',
              email: profile.email || '',
              phoneNumber: profile.phoneNumber || '',
              paymentOption: profile.paymentOption || 'free',
              location: { state: stateId, googleMapLink: profile.location?.googleMapLink || '' },
              languages: languageIds,
              categories: categoryIds,
              website: profile.website || '',
              googleMapAddress: profile.googleMapAddress || '',
              contact: profile.contact || { whatsapp: false, email: false, call: false }
            });
            // Patch productImages
            const arr = this.registrationForm.get('productImages') as FormArray;
            arr.clear();
            (profile.productImages || []).forEach((img: string) => arr.push(this.fb.control(img)));
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
            // Patch brandLogo and products if needed
            // Patch premium period if available
            this.premiumStart = profile.premiumStart ? new Date(profile.premiumStart) : null;
            this.premiumEnd = profile.premiumEnd ? new Date(profile.premiumEnd) : null;
            // Save original value for cancel
            this.originalFormValue = this.registrationForm.getRawValue();
            this.registrationForm.disable();
          },
          error: (err) => {
            this.registrationError = 'Error fetching profile.';
          }
        });
      }
    });
  }

  enableEdit(): void {
    this.isEditMode = true;
    this.registrationForm.enable();
  // Password fields are disabled and removed from the form
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

  payAndUpgrade() {
    this.paymentError = '';
    this.paymentSuccess = false;
    if (!this.selectedDuration) {
      this.paymentError = 'Please select a premium duration.';
      setTimeout(() => {
        this.showPayment = false;
        this.paymentError = '';
      }, 1200);
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      this.paymentError = 'Not logged in.';
      return;
    }
    // Simulate payment, then call backend PATCH to set premium for brand
    this.configService.getBrandProfileById(token).subscribe({
      next: (profile: any) => {
        if (!profile || !profile._id) {
          this.paymentError = 'User ID not found';
          return;
        }
        const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        this.configService['http'].patch(
          `${this.configService['apiUrl']}/users/${profile._id}/premium`,
          { isPremium: true, premiumDuration: this.selectedDuration },
          headers
        ).subscribe({
          next: (res: any) => {
            this.paymentSuccess = true;
            this.showPayment = false;
            // Refresh profile to show premium status
            this.ngOnInit();
          },
          error: (err: any) => {
            this.paymentError = 'Payment failed or could not upgrade. Please try again.';
          }
        });
      },
      error: (err: any) => {
        this.paymentError = 'Could not fetch profile.';
      }
    });
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

  get productImagesFormArray() {
    return this.registrationForm.get('productImages') as FormArray;
  }

  addProductImage() {
    const maxImages = this.isPremium ? 5 : 1;
    if (this.productImagesFormArray.length < maxImages) {
      this.productImagesFormArray.push(this.fb.control('', Validators.required));
    }
  }

  removeProductImage(index: number) {
    this.productImagesFormArray.removeAt(index);
  }



  async onSubmit() {
    if (!this.isEditMode || this.registrationForm.invalid || !this.brandLogoPreview) {
      if (!this.brandLogoPreview) {
        this.registrationError = 'Brand logo is required.';
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
    // Map social media platform ID to name (for backend compatibility)
    const socialMedia = (raw.socialMedia || []).map((sm: any) => {
      const platformObj = this.socialMediaList.find((s: any) => s._id === sm.platform);
      return {
        ...sm,
        platform: platformObj ? platformObj.name : sm.platform,
        followersCount: Number(sm.followersCount)
      };
    });
    // Handle Cloudinary upload for brand logo if file selected
    let brandLogoObjs: { url: string, public_id: string }[] = [];
    if (this.brandLogoFile) {
      try {
        const formData = new FormData();
        formData.append('file', this.brandLogoFile);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (data.secure_url && data.public_id) {
          brandLogoObjs = [{ url: data.secure_url, public_id: data.public_id }];
        } else {
          this.registrationError = 'Brand logo upload failed.';
          return;
        }
      } catch (err) {
        this.registrationError = 'Brand logo upload failed.';
        return;
      }
    } else if (raw.brandLogo && Array.isArray(raw.brandLogo) && raw.brandLogo.length > 0) {
      brandLogoObjs = raw.brandLogo.filter((img: any) => img && typeof img === 'object' && 'url' in img && 'public_id' in img);
    }

    // Upload product images to Cloudinary if any
    let productImageObjs: { url: string, public_id: string }[] = [];
    if (this.productImagesFiles.length > 0) {
      for (let i = 0; i < this.productImagesFiles.length; i++) {
        const fileOrObj = this.productImagesFiles[i];
        if (!fileOrObj) continue;
        if (fileOrObj instanceof File) {
          try {
            const formData = new FormData();
            formData.append('file', fileOrObj);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
              method: 'POST',
              body: formData
            });
            const data = await response.json();
            if (data.secure_url && data.public_id) {
              productImageObjs.push({ url: data.secure_url, public_id: data.public_id });
            } else {
              this.registrationError = 'Product image upload failed.';
              return;
            }
          } catch (err) {
            this.registrationError = 'Product image upload failed.';
            return;
          }
        } else if (typeof fileOrObj === 'object' && fileOrObj !== null && 'url' in fileOrObj && 'public_id' in fileOrObj) {
          productImageObjs.push(fileOrObj as { url: string, public_id: string });
        }
      }
    }
    // Map productImages to products for backend
    const products = productImageObjs.length > 0 ? productImageObjs : raw.productImages || [];
    // Map googleMapAddress to location.googleMapLink for backend
    const location = {
      state: stateObj ? stateObj.name : raw.location.state,
      googleMapLink: raw.googleMapAddress || raw.location.googleMapLink || undefined
    };
    const payload: any = {
      ...raw,
      location,
      languages: languageNames,
      categories: categoryNames,
      socialMedia,
      brandLogo: brandLogoObjs,
      products,
      contact: raw.contact
    };
    // Remove fields not in DTO
    delete payload.password;
    delete payload.confirmPassword;
    delete payload.paymentOption;
    delete payload.productImages;
    delete payload.googleMapAddress;
    let token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
    this.configService.updateBrandProfile(payload, token).subscribe({
      next: () => {
        this.registrationSuccess = true;
        this.isEditMode = false;
        this.registrationForm.disable();
        this.brandLogoPreview = null;
        this.brandLogoFile = null;
        this.productImagesPreview = [];
        this.productImagesFiles = [];
        this.registrationForm.get('password')?.disable();
        this.registrationForm.get('confirmPassword')?.disable();
        this.originalFormValue = this.registrationForm.getRawValue();
      },
      error: err => {
        this.registrationError = 'Update failed. Please try again.';
      }
    });
  }
  
}
