import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, AsyncValidatorFn } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '@app/core/services/auth.service';
import { InvitesService } from '@app/core/services/invites.service';
import { CustomValidators } from '@app/core/validators/custom-validators';
import { AUTH_CONSTANTS } from '@app/core/constants/auth.constants';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { InputPasswordComponent } from '@app/shared/components/atoms/input-password/input-password';
import { CheckboxComponent } from '@app/shared/components/atoms/checkbox/checkbox';
import { PasswordStrengthComponent } from '@app/shared/components/atoms/password-strength/password-strength';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';
import { CpfMaskDirective } from '@app/core/directives/cpf-mask.directive';
import { PhoneMaskDirective } from '@app/core/directives/phone-mask.directive';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

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
    PasswordStrengthComponent,
    ThemeToggleComponent,
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
        ],
        [this.emailAvailabilityValidator()]
      ],
      cpf: ['', [Validators.required, CustomValidators.cpf()], [this.cpfAvailabilityValidator()]],
      phone: ['', [Validators.required, CustomValidators.phone()], [this.phoneAvailabilityValidator()]],
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
    // Capturar token e parâmetros de pré-preenchimento da URL
    this.route.queryParams.subscribe(params => {
      this.inviteToken = params['token'];
      
      // Pré-preencher campos da URL (sem bloquear edição)
      if (params['name']) {
        this.registerForm.patchValue({ name: params['name'] });
      }
      if (params['lastName']) {
        this.registerForm.patchValue({ lastName: params['lastName'] });
      }
      if (params['email']) {
        this.registerForm.patchValue({ email: params['email'] });
      }
      if (params['cpf']) {
        this.registerForm.patchValue({ cpf: params['cpf'] });
      }
      if (params['phone']) {
        this.registerForm.patchValue({ phone: params['phone'] });
      }
      
      if (this.inviteToken) {
        this.validateInviteToken(this.inviteToken);
        // Remover validação de termos quando houver convite
        this.registerForm.get('acceptTerms')?.clearValidators();
        this.registerForm.get('acceptTerms')?.updateValueAndValidity();
      }
    });
  }

  private validateInviteToken(token: string): void {
    this.http.get<any>(`${environment.apiUrl}/invites/validate/${token}`).subscribe({
      next: (response) => {
        this.inviteRole = response.role;
        // Preencher campos do response (têm prioridade sobre os parâmetros da URL)
        if (response.email) {
          this.registerForm.patchValue({ email: response.email });
        }
        if (response.prefilledName) {
          this.registerForm.patchValue({ name: response.prefilledName });
        }
        if (response.prefilledLastName) {
          this.registerForm.patchValue({ lastName: response.prefilledLastName });
        }
        if (response.prefilledCpf) {
          this.registerForm.patchValue({ cpf: response.prefilledCpf });
        }
        if (response.prefilledPhone) {
          this.registerForm.patchValue({ phone: response.prefilledPhone });
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

      this.http.post<any>(`${environment.apiUrl}/invites/register`, registerViaInviteData).subscribe({
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
          this.successMessage = 'Registro realizado com sucesso! Acesse sua caixa de entrada do e-mail informado para confirmar seu cadastro e conseguir acessar a plataforma.';
          this.registerForm.reset();
          this.registerForm.get('acceptTerms')?.setValue(false);
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

  goToLogin(): void {
    this.router.navigate(['/entrar']);
  }

  // Async Validators
  private emailAvailabilityValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value || control.errors?.['required'] || control.errors?.['email'] || control.errors?.['pattern']) {
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
      if (!control.value || control.errors?.['required'] || control.errors?.['invalidCpf']) {
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
      if (!control.value || control.errors?.['required'] || control.errors?.['invalidPhone']) {
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
