import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, AsyncValidatorFn } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { CpfMaskDirective } from '@app/core/directives/cpf-mask.directive';
import { PhoneMaskDirective } from '@app/core/directives/phone-mask.directive';
import { PasswordStrengthComponent } from '@app/shared/components/atoms/password-strength/password-strength';
import { UserRole } from '@app/core/services/users.service';
import { AuthService } from '@app/core/services/auth.service';
import { CustomValidators } from '@app/core/validators/custom-validators';
import { AUTH_CONSTANTS } from '@app/core/constants/auth.constants';

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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IconComponent, ButtonComponent, CpfMaskDirective, PhoneMaskDirective, PasswordStrengthComponent],
  templateUrl: './user-create-modal.html',
  styleUrl: './user-create-modal.scss'
})
export class UserCreateModalComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<{ data: CreateUserData; action: CreateUserAction }>();

  step: 1 | 2 = 1;
  selectedRole: UserRole | null = null;
  creationMode: 'manual' | 'link' = 'manual';
  linkValidity: number = 7;
  userForm!: FormGroup;
  
  userData: CreateUserData = {
    name: '',
    lastName: '',
    email: '',
    cpf: '',
    phone: '',
    role: 'PATIENT'
  };

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
    this.initializeForm();
    this.step = 2;
  }

  private initializeForm(): void {
    this.userForm = this.fb.group({
      name: [
        this.userData.name || '',
        [
          Validators.required,
          Validators.pattern(AUTH_CONSTANTS.VALIDATION_PATTERNS.NAME),
          Validators.minLength(AUTH_CONSTANTS.FIELD_LENGTHS.NAME.min),
          Validators.maxLength(AUTH_CONSTANTS.FIELD_LENGTHS.NAME.max)
        ]
      ],
      lastName: [
        this.userData.lastName || '',
        [
          Validators.required,
          Validators.pattern(AUTH_CONSTANTS.VALIDATION_PATTERNS.NAME),
          Validators.minLength(AUTH_CONSTANTS.FIELD_LENGTHS.NAME.min),
          Validators.maxLength(AUTH_CONSTANTS.FIELD_LENGTHS.NAME.max)
        ]
      ],
      email: [
        this.userData.email || '',
        [
          Validators.required,
          Validators.email,
          Validators.pattern(AUTH_CONSTANTS.VALIDATION_PATTERNS.EMAIL)
        ],
        [this.emailAvailabilityValidator()]
      ],
      cpf: [
        this.userData.cpf || '',
        [Validators.required, CustomValidators.cpf()],
        [this.cpfAvailabilityValidator()]
      ],
      phone: [
        this.userData.phone || '',
        [Validators.required, CustomValidators.phone()],
        [this.phoneAvailabilityValidator()]
      ],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(AUTH_CONSTANTS.FIELD_LENGTHS.PASSWORD.min),
          CustomValidators.strongPassword()
        ]
      ],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: CustomValidators.passwordMatch('password', 'confirmPassword')
    });
  }

  goBackToRoleSelection(): void {
    this.step = 1;
    this.selectedRole = null;
  }

  toggleCreationMode(): void {
    this.creationMode = this.creationMode === 'manual' ? 'link' : 'manual';
  }

  onCreate(): void {
    if (!this.userForm || !this.selectedRole) return;
    
    // Marca todos os campos como touched para exibir erros
    Object.keys(this.userForm.controls).forEach(key => {
      this.userForm.get(key)?.markAsTouched();
    });

    if (this.userForm.valid) {
      const formValue = this.userForm.value;
      this.create.emit({
        data: { 
          name: formValue.name,
          lastName: formValue.lastName,
          email: formValue.email,
          cpf: formValue.cpf,
          phone: formValue.phone,
          password: formValue.password,
          role: this.selectedRole
        },
        action: 'create'
      });
      // Não resetar aqui - deixar o componente pai resetar após sucesso
    }
  }

  onGenerateLink(): void {
    if (this.selectedRole) {
      const formValue = this.userForm?.value || {};
      this.create.emit({
        data: { 
          name: formValue.name || this.userData.name,
          lastName: formValue.lastName || this.userData.lastName,
          email: formValue.email || this.userData.email,
          cpf: formValue.cpf || this.userData.cpf,
          phone: formValue.phone || this.userData.phone,
          role: this.selectedRole
        },
        action: 'generate-link'
      });
      // Não resetar aqui - deixar o componente pai resetar após sucesso
    }
  }

  onSendEmail(): void {
    if (this.selectedRole && this.userForm?.get('email')?.valid) {
      const formValue = this.userForm.value;
      this.create.emit({
        data: { 
          name: formValue.name || this.userData.name,
          lastName: formValue.lastName || this.userData.lastName,
          email: formValue.email || this.userData.email,
          cpf: formValue.cpf || this.userData.cpf,
          phone: formValue.phone || this.userData.phone,
          role: this.selectedRole
        },
        action: 'send-email'
      });
      // Não resetar aqui - deixar o componente pai resetar após sucesso
    }
  }

  canSendEmail(): boolean {
    return this.userForm?.get('email')?.valid || false;
  }

  isFormValid(): boolean {
    return this.userForm?.valid || false;
  }

  resetModal(): void {
    this.step = 1;
    this.selectedRole = null;
    this.creationMode = 'manual';
    this.linkValidity = 7;
    this.userData = {
      name: '',
      lastName: '',
      email: '',
      cpf: '',
      phone: '',
      role: 'PATIENT'
    };
    if (this.userForm) {
      this.userForm.reset();
    }
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

  getErrorMessage(fieldName: string): string {
    const control = this.userForm?.get(fieldName);
    
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    if (control.errors['required']) {
      return AUTH_CONSTANTS.VALIDATION_MESSAGES.REQUIRED;
    }

    if (fieldName === 'email') {
      if (control.errors['email'] || control.errors['pattern']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.EMAIL;
      }
      if (control.errors['emailTaken']) {
        return 'Este e-mail já está em uso';
      }
    }

    if (fieldName === 'name' || fieldName === 'lastName') {
      if (control.errors['pattern']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.NAME;
      }
      if (control.errors['minlength']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.NAME_MIN_LENGTH;
      }
    }

    if (fieldName === 'cpf') {
      if (control.errors['invalidCpf']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.CPF;
      }
      if (control.errors['cpfTaken']) {
        return 'Este CPF já está cadastrado';
      }
    }

    if (fieldName === 'phone') {
      if (control.errors['invalidPhone']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.PHONE;
      }
      if (control.errors['phoneTaken']) {
        return 'Este telefone já está cadastrado';
      }
    }

    if (fieldName === 'password') {
      if (control.errors['minlength']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH;
      }
      if (control.errors['weakPassword']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.PASSWORD_WEAK;
      }
    }

    if (fieldName === 'confirmPassword') {
      if (control.errors['passwordMismatch']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.PASSWORD_MATCH;
      }
    }

    return '';
  }

  private emailAvailabilityValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }

      return timer(500).pipe(
        switchMap(() => this.authService.checkEmailAvailability(control.value)),
        map(result => result.available ? null : { emailTaken: true }),
        catchError(() => of(null))
      );
    };
  }

  private cpfAvailabilityValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }

      return timer(500).pipe(
        switchMap(() => this.authService.checkCpfAvailability(control.value)),
        map(result => result.available ? null : { cpfTaken: true }),
        catchError(() => of(null))
      );
    };
  }

  private phoneAvailabilityValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }

      return timer(500).pipe(
        switchMap(() => this.authService.checkPhoneAvailability(control.value)),
        map(result => result.available ? null : { phoneTaken: true }),
        catchError(() => of(null))
      );
    };
  }
}
