import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { CpfMaskDirective } from '@app/core/directives/cpf-mask.directive';
import { PhoneMaskDirective } from '@app/core/directives/phone-mask.directive';
import { EmailValidatorDirective } from '@app/core/directives/email-validator.directive';
import { UserRole } from '@app/core/services/users.service';
import {
  VALIDATION_MESSAGES,
  FIELD_CONSTRAINTS,
  validatePassword,
  getPasswordMissingRequirements,
  validateCPF,
  validateEmail,
  validatePhone
} from '@app/core/constants/validation.constants';

export interface CreateUserData {
  name?: string;
  lastName?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  password?: string;
  role: UserRole;
  specialtyId?: string;
}

export type CreateUserAction = 'create' | 'generate-link' | 'send-email';

@Component({
  selector: 'app-user-create-modal',
  imports: [FormsModule, IconComponent, ButtonComponent, CpfMaskDirective, PhoneMaskDirective, EmailValidatorDirective],
  templateUrl: './user-create-modal.html',
  styleUrl: './user-create-modal.scss'
})
export class UserCreateModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<{ data: CreateUserData; action: CreateUserAction }>();

  step: 1 | 2 = 1;
  selectedRole: UserRole | null = null;
  creationMode: 'manual' | 'link' = 'manual';
  linkValidity: number = 7;
  
  userData: CreateUserData = {
    name: '',
    lastName: '',
    email: '',
    cpf: '',
    phone: '',
    role: 'PATIENT'
  };

  password = '';
  confirmPassword = '';

  // Validation constants
  validationMessages = VALIDATION_MESSAGES;
  fieldConstraints = FIELD_CONSTRAINTS;

  onBackdropClick(): void {
    this.onCancel();
  }

  onCancel(): void {
    this.resetModal();
    this.close.emit();
  }

  selectRole(role: UserRole): void {
    this.selectedRole = role;
    this.userData.role = role;
    this.step = 2;
  }

  goBackToRoleSelection(): void {
    this.step = 1;
    this.selectedRole = null;
  }

  toggleCreationMode(): void {
    this.creationMode = this.creationMode === 'manual' ? 'link' : 'manual';
  }

  onCreate(): void {
    if (this.selectedRole && this.isFormValid()) {
      this.create.emit({
        data: { 
          ...this.userData,
          password: this.password
        },
        action: 'create'
      });
      this.resetModal();
    }
  }

  onGenerateLink(): void {
    if (this.selectedRole) {
      this.create.emit({
        data: { ...this.userData },
        action: 'generate-link'
      });
      this.resetModal();
    }
  }

  onSendEmail(): void {
    if (this.selectedRole && this.userData.email?.trim()) {
      this.create.emit({
        data: { ...this.userData },
        action: 'send-email'
      });
      this.resetModal();
    }
  }

  canSendEmail(): boolean {
    return !!(this.userData.email?.trim());
  }

  isFormValid(): boolean {
    return !!(
      this.userData.name?.trim() &&
      this.userData.lastName?.trim() &&
      this.isEmailValid() &&
      this.isCpfValid() &&
      this.isPhoneValid() &&
      this.isPasswordValid() &&
      this.passwordsMatch()
    );
  }

  passwordsMatch(): boolean {
    if (!this.password || !this.confirmPassword) return false;
    return this.password === this.confirmPassword;
  }

  isPasswordValid(): boolean {
    return validatePassword(this.password);
  }

  getPasswordStrength(): 'weak' | 'medium' | 'strong' {
    if (!this.password) return 'weak';
    const missing = getPasswordMissingRequirements(this.password);
    if (missing.length === 0) return 'strong';
    if (missing.length <= 2) return 'medium';
    return 'weak';
  }

  getPasswordMissingRequirements(): string {
    const missing = getPasswordMissingRequirements(this.password);
    if (missing.length === 0) return '';
    return 'Faltam: ' + missing.join(', ');
  }

  isEmailValid(): boolean {
    return !!this.userData.email?.trim() && validateEmail(this.userData.email);
  }

  isCpfValid(): boolean {
    return !!this.userData.cpf?.trim() && validateCPF(this.userData.cpf);
  }

  isPhoneValid(): boolean {
    return !!this.userData.phone?.trim() && validatePhone(this.userData.phone);
  }

  private resetModal(): void {
    this.step = 1;
    this.selectedRole = null;
    this.creationMode = 'manual';
    this.linkValidity = 7;
    this.userData = {
      name: '',
      email: '',
      cpf: '',
      phone: '',
      role: 'PATIENT'
    };
    this.password = '';
    this.confirmPassword = '';
  }

  getRoleIcon(role: UserRole): 'user' | 'users' | 'shield' {
    const iconMap: Record<UserRole, 'user' | 'users' | 'shield'> = {
      PATIENT: 'user',
      PROFESSIONAL: 'users',
      ADMIN: 'shield'
    };
    return iconMap[role];
  }

  getRoleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      PATIENT: 'Paciente',
      PROFESSIONAL: 'Profissional',
      ADMIN: 'Administrador'
    };
    return labels[role];
  }

  getRoleDescription(role: UserRole): string {
    const descriptions: Record<UserRole, string> = {
      PATIENT: 'Usuário que receberá atendimento médico',
      PROFESSIONAL: 'Profissional de saúde que realizará atendimentos',
      ADMIN: 'Administrador com acesso total ao sistema'
    };
    return descriptions[role];
  }
}
