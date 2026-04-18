import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { SessionService } from './core/session.service';
import { WarmupService } from './core/warmup.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('Trend Starz');

  // WarmupService injected here so it starts pinging the backend immediately on app boot
  constructor(private session: SessionService, private router: Router, private warmup: WarmupService) {}

  ngOnInit() {
    // Always load user from storage before any layout is rendered
    this.session.loadUserFromStorage();
    // Session expiration is now handled by route guards on protected routes only.
  }
}
