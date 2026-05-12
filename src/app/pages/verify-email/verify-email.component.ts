import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

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

  constructor(private route: ActivatedRoute, private router: Router, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const status = params['status'];
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

  goBack() {
    const dest = this.returnUrl || '/';
    this.router.navigateByUrl(dest);
  }
}
