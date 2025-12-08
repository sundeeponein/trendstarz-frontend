import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  registerUser(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register-influencer`, data);
  }
  private apiUrl = environment.apiBaseUrl || '/api';

  constructor(private http: HttpClient) {}

  getCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/categories`);
  }

  getConfig(): Observable<any> {
    return this.http.get('/assets/admin-config.json').pipe(
      catchError(() => this.http.get('assets/admin-config.json')) // fallback for some setups
    );
  }

  getSampleUsers(): Observable<any[]> {
    return this.http.get<any[]>('/assets/sample-users.json').pipe(
      catchError(() => this.http.get<any[]>('assets/sample-users.json'))
    );
  }
  
  getStates(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/states`);
  }

  getLanguages(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/languages`);
  }

  getTiers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tiers`);
  }

  getSocialMedia(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/social-media`);
  }

}
