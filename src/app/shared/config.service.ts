import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class ConfigService {
  private apiUrl = environment.apiBaseUrl || '/api';

  constructor(private http: HttpClient) {}


  // Fetch influencer by ID (for public profile view)
  getInfluencerById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/influencers/${id}`);
  }

  // Fetch brand by ID (for public profile view)
  getBrandById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/brands/${id}`);
  }

  // Fetch brand by name (for public profile view)
  getBrandByName(brandName: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/brands/name/${brandName}`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching brand by name:', error);
          return of(null);
        })
      );
  }

  registerInfluencer(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register-influencer`, data);
  }

  registerBrand(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register-brand`, data);
  }

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

  getInfluencers(token: string): Observable<any[]> {
  const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  return this.http.get<any[]>(`${this.apiUrl}/users/influencers`, headers);
  }

  getBrands(token: string): Observable<any[]> {
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    return this.http.get<any[]>(`${this.apiUrl}/users/brands`, headers);
  }

  updateBrandImages(id: string, images: { brandLogo?: any[]; products?: any[] }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${id}/images`, images);
  }

  updateUserImages(id: string, images: { profileImages?: any[]; brandLogo?: any[]; products?: any[] }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${id}/images`, images);
  }


  getInfluencerProfileById(token: string): Observable<any> {
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    return this.http.get(`${this.apiUrl}/users/influencer-profile`, headers);
  }

  updateInfluencerProfile(data: any, token: string): Observable<any> {
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    return this.http.patch(`${this.apiUrl}/users/influencer-profile`, data, headers);
  }

  getBrandProfileById(token: string): Observable<any> {
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    return this.http.get(`${this.apiUrl}/users/brand-profile`, headers);
  }

  updateBrandProfile(data: any, token: string): Observable<any> {
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    return this.http.patch(`${this.apiUrl}/users/brand-profile`, data, headers);
  }


  setPremiumForCurrentUser(isPremium: boolean, premiumDuration: '1m' | '3m' | '1y', token: string): Observable<any> {
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    return new Observable((observer) => {
      this.getInfluencerProfileById(token).subscribe({
        next: (profile: any) => {
          if (!profile || !profile._id) {
            observer.error('User ID not found');
            return;
          }
          this.http.patch(`${this.apiUrl}/users/${profile._id}/premium`, { isPremium, premiumDuration }, headers)
            .subscribe({
              next: (res) => observer.next(res),
              error: (err) => observer.error(err),
              complete: () => observer.complete()
            });
        },
        error: (err) => observer.error(err)
      });
    });
  }

  // Place this inside ConfigService class
  getInfluencerByUsername(username: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/influencers/username/${username}`);
  }

}
