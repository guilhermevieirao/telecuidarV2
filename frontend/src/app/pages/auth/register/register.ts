import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { InvitesService } from '@app/core/services/invites.service';
import { CustomValidators } from '@app/core/validators/custom-validators';
import { AUTH_CONSTANTS } from '@app/core/constants/auth.constants';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { InputPasswordComponent } from '@app/shared/components/atoms/input-password/input-password';
import { CheckboxComponent } from '@app/shared/components/atoms/checkbox/checkbox';
import { CpfMaskDirective } from '@app/core/directives/cpf-mask.directive';
import { PhoneMaskDirective } from '@app/core/directives/phone-mask.directive';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    LogoComponent,
    IconComponent,
    InputPasswordComponent,
    CheckboxComponent,
    CpfMaskDirective,
    PhoneMaskDirective
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  registerForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  inviteToken: string | null = null;
  inviteRole: string | null = null;

  constructor() {
    this.registerForm = this.fb.group({
      name: [
        '',
        [
          Validators.required,
          Validators.pattern(AUTH_CONSTANTS.VALIDATION_PATTERNS.NAME),
          Validators.minLength(AUTH_CONSTANTS.FIELD_LENGTHS.NAME.min),
          Validators.maxLength(AUTH_CONSTANTS.FIELD_LENGTHS.NAME.max)
        ]
      ],
      lastName: [
        '',
        [
          Validators.required,
          Validators.pattern(AUTH_CONSTANTS.VALIDATION_PATTERNS.NAME),
          Validators.minLength(AUTH_CONSTANTS.FIELD_LENGTHS.NAME.min),
          Validators.maxLength(AUTH_CONSTANTS.FIELD_LENGTHS.NAME.max)
        ]
      ],
      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.pattern(AUTH_CONSTANTS.VALIDATION_PATTERNS.EMAIL)
        ]
      ],
      cpf: ['', [Validators.required, CustomValidators.cpf()]],
      phone: ['', [Validators.required, CustomValidators.phone()]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(AUTH_CONSTANTS.FIELD_LENGTHS.PASSWORD.min),
          CustomValidators.strongPassword()
        ]
      ],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    }, {
      validators: CustomValidators.passwordMatch('password', 'confirmPassword')
    });
  }

  ngOnInit(): void {
    // Capturar token da URL
    this.route.queryParams.subscribe(params => {
      this.inviteToken = params['token'];
      if (this.inviteToken) {
        this.validateInviteToken(this.inviteToken);
        // Remover validação de termos quando houver convite
        this.registerForm.get('acceptTerms')?.clearValidators();
        this.registerForm.get('acceptTerms')?.updateValueAndValidity();
      }
    });
  }

  private validateInviteToken(token: string): void {
    this.http.get<any>(`http://localhost:5239/api/invites/validate/${token}`).subscribe({
      next: (response) => {
        this.inviteRole = response.role;
        // Preencher email se disponível
        if (response.email) {
          this.registerForm.patchValue({ email: response.email });
        }
      },
      error: (error) => {
        this.errorMessage = 'Link de convite inválido ou expirado.';
      }
    });
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.registerForm.value;

    // Se tiver token de convite, usar endpoint de registro via convite
    if (this.inviteToken) {
      const registerViaInviteData = {
        token: this.inviteToken,
        email: formValue.email,
        name: formValue.name,
        lastName: formValue.lastName,
        cpf: formValue.cpf.replace(/\D/g, ''),
        phone: formValue.phone.replace(/\D/g, ''),
        password: formValue.password
      };

      this.http.post<any>('http://localhost:5239/api/invites/register', registerViaInviteData).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = 'Cadastro realizado com sucesso! Redirecionando para login...';
          
          setTimeout(() => {
            this.router.navigate(['/entrar']);
          }, 2000);
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Erro ao realizar cadastro. Tente novamente.';
        }
      });
    } else {
      // Registro normal sem convite
      const registerData = {
        name: formValue.name,
        lastName: formValue.lastName,
        email: formValue.email,
        cpf: formValue.cpf.replace(/\D/g, ''),
        phone: formValue.phone.replace(/\D/g, ''),
        password: formValue.password,
        confirmPassword: formValue.confirmPassword,
        acceptTerms: formValue.acceptTerms
      };

      this.authService.register(registerData).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = 'Cadastro realizado com sucesso! Verifique seu e-mail para confirmar sua conta.';
          
          setTimeout(() => {
            this.router.navigate(['/entrar']);
          }, 3000);
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Erro ao realizar cadastro. Tente novamente.';
        }
      });
    }
  }

  registerWithGoogle(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // TODO: Implement Google OAuth when backend is ready
    this.authService.loginWithGoogle();
    this.isLoading = false;
    this.errorMessage = 'Login com Google ainda não está disponível.';
  }

  getErrorMessage(fieldName: string): string {
    const control = this.registerForm.get(fieldName);
    
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
    }

    if (fieldName === 'name' || fieldName === 'lastName') {
      if (control.errors['pattern']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.NAME;
      }
      if (control.errors['minlength']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.NAME_MIN_LENGTH;
      }
    }

    if (fieldName === 'cpf' && control.errors['invalidCpf']) {
      return AUTH_CONSTANTS.VALIDATION_MESSAGES.CPF;
    }

    if (fieldName === 'phone' && control.errors['invalidPhone']) {
      return AUTH_CONSTANTS.VALIDATION_MESSAGES.PHONE;
    }

    if (fieldName === 'password') {
      if (control.errors['minlength']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH;
      }
      if (control.errors['weakPassword']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.PASSWORD_WEAK;
      }
    }

    if (fieldName === 'confirmPassword' && this.registerForm.errors?.['passwordMismatch']) {
      return AUTH_CONSTANTS.VALIDATION_MESSAGES.PASSWORD_MATCH;
    }

    if (fieldName === 'acceptTerms' && control.errors['required']) {
      return 'Você deve aceitar os termos de uso';
    }

    return '';
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }
}
