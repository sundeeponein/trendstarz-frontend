import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from '../../config.service';
import { switchMap } from 'rxjs/operators';
import { ResolvePlatformPipe } from '../../pipes/resolve-platform.pipe';

@Component({
  selector: 'app-brand-profile-view',
  standalone: true,
  imports: [CommonModule, ResolvePlatformPipe],
  templateUrl: './brand-profile-view.component.html',
  styleUrls: []
})
export class BrandProfileViewComponent implements OnInit {
  brand: any = null;
  loading = true;
  error = '';

  resolvePlatform(sm: any): string {
    if (!sm || !sm.platform) return '';
    const p = sm.platform.toLowerCase();
    if (p.includes('insta')) return 'instagram';
    if (p.includes('face')) return 'facebook';
    if (p.includes('youtube')) return 'youtube';
    return p;
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }

  constructor(private route: ActivatedRoute, private config: ConfigService, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const brandName = params.get('brandName');
          this.brand = null;
          this.error = '';
          this.loading = true;
          if (brandName) {
            return this.config.getBrandByName(brandName);
          } else {
            this.error = 'No brand specified';
            this.loading = false;
            this.cd.detectChanges();
            return [];
          }
        })
      )
      .subscribe({
        next: (data: any) => {
          console.log('Brand API response:', data);
          if (!data) {
            this.error = 'Brand not found.';
            this.brand = null;
          } else {
            this.brand = data;
          }
          this.loading = false;
          this.cd.detectChanges();
        },
        error: (err: any) => {
          console.error('Brand API error:', err);
          this.error = 'Could not load brand profile.';
          this.loading = false;
          this.cd.detectChanges();
        }
      });
    console.log('Brand object:', this.brand);
  }
}
