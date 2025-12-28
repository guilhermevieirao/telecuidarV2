import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { CpfMaskDirective } from '@app/core/directives/cpf-mask.directive';
import { PhoneMaskDirective } from '@app/core/directives/phone-mask.directive';
import { UserRole } from '@app/core/services/invites.service';

export type InviteAction = 'send-email' | 'generate-link';

export interface InviteData {
  email: string;
  role: UserRole;
  name?: string;
  lastName?: string;
  cpf?: string;
  phone?: string;
}

@Component({
  selector: 'app-invite-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonComponent, CpfMaskDirective, PhoneMaskDirective],
  templateUrl: './invite-create-modal.html',
  styleUrl: './invite-create-modal.scss'
})
export class InviteCreateModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<{ data: InviteData; action: InviteAction }>();

  inviteData: InviteData = {
    email: '',
    role: 'PATIENT' as UserRole,
    name: '',
    lastName: '',
    cpf: '',
    phone: ''
  };

  roleOptions = [
    { value: 'PATIENT', label: 'Paciente' },
    { value: 'PROFESSIONAL', label: 'Profissional' },
    { value: 'ADMIN', label: 'Administrador' }
  ];

  onBackdropClick(): void {
    this.onCancel();
  }

  onCancel(): void {
    this.resetModal();
    this.close.emit();
  }

  onSendEmail(): void {
    if (this.isFormValidForEmail()) {
      this.create.emit({ data: { ...this.inviteData }, action: 'send-email' });
      this.resetModal();
    }
  }

  onGenerateLink(): void {
    if (this.isFormValidForLink()) {
      this.create.emit({ data: { ...this.inviteData }, action: 'generate-link' });
      this.resetModal();
    }
  }

  isFormValidForEmail(): boolean {
    return !!(
      this.inviteData.email?.trim() &&
      this.isValidEmail(this.inviteData.email)
    );
  }

  isFormValidForLink(): boolean {
    return !!this.inviteData.role;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private resetModal(): void {
    this.inviteData = {
      email: '',
      role: 'PATIENT',
      name: '',
      lastName: '',
      cpf: '',
      phone: ''
    };
  }
}
