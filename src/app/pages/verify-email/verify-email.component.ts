import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss']
})
export class VerifyEmailComponent implements OnInit {
  status: 'success' | 'failed' | 'pending' = 'pending';
  autoApproved = false;
  returnUrl = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cd: ChangeDetectorRef,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const status = params['status'];
      const firebaseEmail = params['firebaseEmail'];
      if (firebaseEmail) {
        this.syncFirebaseEmail(firebaseEmail);
        return;
      }
      if (status === 'success') {
        this.status = 'success';
        this.autoApproved = params['approved'] === 'true';
      } else if (status === 'failed') {
        this.status = 'failed';
      }
      // Capture where the user came from so we can navigate back
      if (params['returnUrl']) {
        this.returnUrl = params['returnUrl'];
      }
      this.cd.markForCheck();
    });
  }

  private syncFirebaseEmail(email: string): void {
    this.status = 'pending';
    this.http
      .post<any>(`${environment.apiBaseUrl}/auth/firebase/sync-email-verification`, { email })
      .subscribe({
        next: (result) => {
          this.status = 'success';
          this.autoApproved = result?.autoApproved === true;
          this.cd.markForCheck();
        },
        error: () => {
          this.status = 'failed';
          this.cd.markForCheck();
        },
      });
  }

  goBack() {
    const dest = this.returnUrl || '/';
    this.router.navigateByUrl(dest);
  }
}
