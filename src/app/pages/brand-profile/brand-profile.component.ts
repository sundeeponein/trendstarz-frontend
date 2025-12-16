import imageCompression from 'browser-image-compression';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-brand-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './brand-profile.component.html',
  styleUrls: ['./brand-profile.component.scss']
})

export class BrandProfileComponent implements OnInit {
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
  constructor(private fb: FormBuilder, private configService: ConfigService) {}

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

  async onImageChange(event: any) {
    const files: FileList | null = event?.target?.files;
    if (!files || files.length === 0) return;
    const file: File = files[0];

    // Check file size
    if (file.size > 1024 * 1024) {
      alert('Image must be below 1MB.');
      return;
    }

    // Compress/resize
    const options = { maxWidthOrHeight: 1000, maxSizeMB: 1 };
    try {
      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const arr = this.registrationForm.get('productImages') as FormArray | null;
          if (arr) {
            arr.push(this.fb.control(result, Validators.required));
          }
        } else {
          alert('Failed to read image.');
        }
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      alert('Image compression failed.');
    }
  }

  onSubmit() {
    if (!this.isEditMode || this.registrationForm.invalid) return;
    this.registrationError = '';
    this.registrationSuccess = false;
    // Prepare payload to match backend DTO
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
    const payload: any = {
      ...raw,
      location: {
        state: stateObj ? stateObj.name : raw.location.state,
        googleMapLink: raw.location.googleMapLink || undefined
      },
      languages: languageNames,
      categories: categoryNames,
      socialMedia,
      brandLogo: raw.brandLogo || [],
      products: raw.products || [],
      contact: raw.contact
    };
    // Remove fields not in DTO
  delete payload.password;
  delete payload.confirmPassword;
    delete payload.paymentOption;
    let token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
    this.configService.updateBrandProfile(payload, token).subscribe({
      next: () => {
        this.registrationSuccess = true;
        this.isEditMode = false;
        this.registrationForm.disable();
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
