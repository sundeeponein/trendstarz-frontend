import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app-paginator.component.html',
  styleUrls: ['./app-paginator.component.scss'],
})
export class AppPaginatorComponent {
  @Input() total = 0;
  @Input() pageSize = 25;
  @Input() currentPage = 1;
  @Input() entityLabel = 'items';
  @Input() pageSizeOptions: number[] = [10, 25, 50, 100];

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get rangeStart(): number {
    return this.total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }
  get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.total);
  }
  get hasPrev(): boolean {
    return this.currentPage > 1;
  }
  get hasNext(): boolean {
    return this.currentPage * this.pageSize < this.total;
  }

  onPageSizeSelect(val: string | number): void {
    this.pageSizeChange.emit(Number(val));
  }
  onPrev(): void {
    if (this.hasPrev) this.pageChange.emit(this.currentPage - 1);
  }
  onNext(): void {
    if (this.hasNext) this.pageChange.emit(this.currentPage + 1);
  }
}
