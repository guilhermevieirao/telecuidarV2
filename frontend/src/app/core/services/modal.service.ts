import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface ModalConfig {
  title: string;
  message?: string;
  htmlMessage?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'confirm' | 'alert' | 'prompt';
  variant?: 'danger' | 'warning' | 'info' | 'success';
  prompt?: {
    label: string;
    placeholder?: string;
    required?: boolean;
  };
}

export interface ModalResult {
  confirmed: boolean;
  promptValue?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modalSubject = new Subject<ModalConfig>();
  private resultSubject = new Subject<ModalResult>();
  private modalCounter = 0;
  private baseZIndex = 2010;

  modal$ = this.modalSubject.asObservable();
  result$ = this.resultSubject.asObservable();

  open(config: ModalConfig): Observable<ModalResult> {
    this.modalSubject.next(config);
    return new Observable(observer => {
      const subscription = this.result$.subscribe(result => {
        observer.next(result);
        observer.complete();
      });
      return () => subscription.unsubscribe();
    });
  }

  getNextZIndex(): number {
    this.modalCounter += 2; // Incrementa por 2 (backdrop + modal)
    return this.baseZIndex + this.modalCounter;
  }

  resetZIndex(): void {
    this.modalCounter = 0;
  }

  confirm(config: Omit<ModalConfig, 'type'>): Observable<ModalResult> {
    return this.open({ ...config, type: 'confirm' });
  }

  alert(config: Omit<ModalConfig, 'type'>): Observable<ModalResult> {
    return this.open({ ...config, type: 'alert' });
  }

  prompt(config: Omit<ModalConfig, 'type'>): Observable<ModalResult> {
    return this.open({ ...config, type: 'prompt' });
  }

  close(result: ModalResult): void {
    this.resultSubject.next(result);
  }
}
