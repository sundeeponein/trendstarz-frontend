import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-host" aria-live="polite" aria-atomic="true">
      <div
        *ngFor="let t of toast.toasts(); trackBy: trackById"
        class="toast-item"
        [class.toast-success]="t.kind === 'success'"
        [class.toast-error]="t.kind === 'error'"
        [class.toast-warning]="t.kind === 'warning'"
        [class.toast-info]="t.kind === 'info'"
        role="status"
      >
        <i class="bi" [ngClass]="iconFor(t.kind)"></i>
        <span class="toast-text">{{ t.text }}</span>
        <button type="button" class="toast-close" (click)="toast.dismiss(t.id)" aria-label="Dismiss">
          <i class="bi bi-x"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-host {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: min(380px, calc(100vw - 2rem));
      pointer-events: none;
    }
    .toast-item {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 0.7rem 0.9rem;
      border-radius: 10px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-left: 4px solid #6b7280;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      color: #1f2937;
      font-size: 0.88rem;
      line-height: 1.4;
      animation: toastSlideIn 220ms ease-out;
    }
    .toast-item i.bi { font-size: 1.05rem; margin-top: 1px; }
    .toast-text { flex: 1; }
    .toast-close {
      background: transparent;
      border: 0;
      color: #94a3b8;
      cursor: pointer;
      font-size: 1.1rem;
      padding: 0 2px;
      line-height: 1;
    }
    .toast-close:hover { color: #475569; }

    .toast-success { border-left-color: #16a34a; }
    .toast-success > i.bi { color: #16a34a; }
    .toast-error   { border-left-color: #dc2626; }
    .toast-error   > i.bi { color: #dc2626; }
    .toast-warning { border-left-color: #ea580c; }
    .toast-warning > i.bi { color: #ea580c; }
    .toast-info    { border-left-color: #2563eb; }
    .toast-info    > i.bi { color: #2563eb; }

    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateY(-6px) translateX(8px); }
      to   { opacity: 1; transform: none; }
    }
  `],
})
export class ToastHostComponent {
  constructor(public toast: ToastService) {}

  trackById = (_: number, t: { id: number }) => t.id;

  iconFor(kind: 'success' | 'error' | 'info' | 'warning'): string {
    switch (kind) {
      case 'success': return 'bi-check-circle-fill';
      case 'error':   return 'bi-x-octagon-fill';
      case 'warning': return 'bi-exclamation-triangle-fill';
      default:        return 'bi-info-circle-fill';
    }
  }
}
