import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { SessionService } from './core/session.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgSelectModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('Trend Starz');

  constructor(private session: SessionService, private router: Router) {}

  ngOnInit() {
    // Always load user from storage before any layout is rendered
    this.session.loadUserFromStorage();
    // Session expiration is now handled by route guards on protected routes only.
  }
}
