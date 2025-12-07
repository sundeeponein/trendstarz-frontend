import { Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.scss']
})
export class UserCardComponent {
  @Input() profileImage = '';
  @Input() name = '';
  @Input() username = '';
  @Input() brandName = '';
  @Input() email = '';
  @Input() phoneNumber = '';
  @Input() categories: string[] = [];
  @Input() state = '';
  @Input() district = '';
  @Input() socialMedia: any[] = [];
  @Input() isPremium = false;
  @Input() productImages: string[] = [];
  @Input() website = '';
  @Input() googleMapAddress = '';
}
