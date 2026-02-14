import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss']
})
export class VerifyEmailComponent implements OnInit {
  status: 'pending' | 'success' | 'error' = 'pending';
  message = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (token) {
        this.http.post('/api/verification/verify', { token, type: 'email' }).subscribe({
          next: () => {
            this.status = 'success';
            this.message = 'Your email has been verified!';
          },
          error: err => {
            this.status = 'error';
            this.message = err.error?.error || 'Verification failed.';
          }
        });
      } else {
        this.status = 'error';
        this.message = 'No verification token found.';
      }
    });
  }
}
