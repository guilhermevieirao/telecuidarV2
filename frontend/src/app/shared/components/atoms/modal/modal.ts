import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ModalService, ModalConfig } from '@app/core/services/modal.service';
import { IconComponent, IconName } from '@app/shared/components/atoms/icon/icon';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, IconComponent, ButtonComponent, FormsModule],
  templateUrl: './modal.html',
  styleUrl: './modal.scss'
})
export class ModalComponent implements OnInit, OnDestroy {
  private modalService = inject(ModalService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  
  isOpen = false;
  config: ModalConfig | null = null;
  private subscription?: Subscription;
  promptValue = '';
  modalZIndex = 2010;
  safeHtmlMessage: SafeHtml | null = null;

  ngOnInit(): void {
    this.subscription = this.modalService.modal$.subscribe((config: ModalConfig) => {
      this.config = config;
      this.isOpen = true;
      this.promptValue = '';
      this.modalZIndex = this.modalService.getNextZIndex();
      
      // Sanitizar HTML se fornecido
      // Usando bypassSecurityTrustHtml pois o HTML vem de fontes controladas pela aplicação
      if (config.htmlMessage) {
        this.safeHtmlMessage = this.sanitizer.bypassSecurityTrustHtml(config.htmlMessage);
      } else {
        this.safeHtmlMessage = null;
      }
      
      // Detectar mudanças após atualizar estado do modal
      setTimeout(() => this.cdr.detectChanges(), 0);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  onConfirm(): void {
    this.modalService.close({ confirmed: true, promptValue: this.promptValue });
    this.isOpen = false;
  }

  onCancel(): void {
    this.modalService.close({ confirmed: false });
    this.isOpen = false;
  }

  onBackdropClick(): void {
    if (this.config?.type === 'alert') {
      this.onConfirm();
    } else {
      this.onCancel();
    }
  }

  get icon(): IconName {
    switch (this.config?.variant) {
      case 'danger':
        return 'x-circle';
      case 'warning':
        return 'alert-circle';
      case 'success':
        return 'check-circle';
      case 'info':
      default:
        return 'alert-circle';
    }
  }

  get iconColor(): string {
    switch (this.config?.variant) {
      case 'danger':
        return 'var(--red-600)';
      case 'warning':
        return '#f59e0b';
      case 'success':
        return 'var(--green-600)';
      case 'info':
      default:
        return 'var(--blue-600)';
    }
  }
}
