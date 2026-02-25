import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'app-logout',
  standalone: true,
  template: '<div>Logging out...</div>'
})
export class LogoutComponent {
  private session = inject(SessionService);
  private router = inject(Router);

  constructor() {
    this.session.clearSession();
    this.router.navigate(['/']);
  }
}
