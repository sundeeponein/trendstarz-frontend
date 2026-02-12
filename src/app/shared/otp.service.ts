import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OtpService {
  constructor(private http: HttpClient) {}

  sendOtp(type: 'phone' | 'email', value: string): Observable<any> {
    return this.http.post('/api/otp/send', { type, value });
  }

  verifyOtp(type: 'phone' | 'email', value: string, otp: string): Observable<any> {
    return this.http.post('/api/otp/verify', { type, value, otp });
  }
}
