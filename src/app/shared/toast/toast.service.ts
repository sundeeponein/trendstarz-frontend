import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  /** Reactive list of currently visible toasts. */
  readonly toasts = signal<ToastMessage[]>([]);

  private nextId = 1;

  show(text: string, kind: ToastKind = 'info', durationMs = 4000) {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, text, kind }]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
    return id;
  }

  success(text: string, durationMs = 4000) { return this.show(text, 'success', durationMs); }
  error(text: string, durationMs = 5000)   { return this.show(text, 'error',   durationMs); }
  info(text: string, durationMs = 4000)    { return this.show(text, 'info',    durationMs); }
  warning(text: string, durationMs = 5000) { return this.show(text, 'warning', durationMs); }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear() {
    this.toasts.set([]);
  }
}
