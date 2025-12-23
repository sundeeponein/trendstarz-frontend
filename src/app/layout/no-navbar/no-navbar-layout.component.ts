import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FooterComponent } from '../../shared/footer/footer.component';


@Component({
  selector: 'app-no-navbar-layout',
  standalone: true,
  imports: [RouterModule, FooterComponent],
  templateUrl: './no-navbar-layout.component.html'
})
export class NoNavbarLayoutComponent {}
