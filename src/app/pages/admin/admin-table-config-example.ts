// Example Angular admin table for config management
import { Component, OnInit } from '@angular/core';
import { ConfigService } from '../../shared/config.service';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-table-config-example',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2>Categories</h2>
    <table>
      <tr><th>Name</th><th>Visible</th><th>Toggle</th></tr>
      <tr *ngFor="let cat of categories">
        <td>{{cat.name}}</td>
        <td>{{cat.visible ? 'Yes' : 'No'}}</td>
        <td>
          <button (click)="toggleCategory(cat)">{{cat.visible ? 'Hide' : 'Show'}}</button>
        </td>
      </tr>
    </table>
  `
})
export class AdminTableConfigExampleComponent implements OnInit {
  categories: any[] = [];

  constructor(private configService: ConfigService, private http: HttpClient) {}

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.configService.getCategories().subscribe(data => {
      this.categories = data;
    });
  }

  toggleCategory(cat: any) {
    const updated = { visible: !cat.visible };
    this.http.patch(`/api/categories/${cat._id}`, updated).subscribe(() => {
      cat.visible = !cat.visible;
    });
  }
}
