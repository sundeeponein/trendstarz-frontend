import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-no-navbar-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './no-navbar-layout.component.html'
})
export class NoNavbarLayoutComponent {}
