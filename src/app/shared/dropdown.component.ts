import { Component, Input } from '@angular/core';
import { NgSelectModule } from '@ng-select/ng-select';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [NgSelectModule, CommonModule, ReactiveFormsModule],
  template: `
    <ng-select [items]="items"
              [multiple]="multiple"
              [bindLabel]="bindLabel"
              [bindValue]="bindValue"
              [formControl]="control">
    </ng-select>
  `,
})
export class DropdownComponent {
  @Input() items: any[] = [];
  @Input() multiple = false;
  @Input() bindLabel = 'name';
  @Input() bindValue = '_id';
  @Input() control: any;
}
