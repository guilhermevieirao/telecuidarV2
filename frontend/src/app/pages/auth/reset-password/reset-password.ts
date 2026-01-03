import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { CustomValidators } from '@app/core/validators/custom-validators';
import { AUTH_CONSTANTS } from '@app/core/constants/auth.constants';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { InputPasswordComponent } from '@app/shared/components/atoms/input-password/input-password';
import { PasswordStrengthComponent } from '@app/shared/components/atoms/password-strength/password-strength';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    LogoComponent,
    IconComponent,
    InputPasswordComponent,
    PasswordStrengthComponent,
    ThemeToggleComponent
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss'
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  resetPasswordForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  resetToken = '';
  passwordReset = false;

  constructor() {
    this.resetPasswordForm = this.fb.group({
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

  ngOnInit(): void {
    // Get reset token from URL query params
    this.route.queryParams.subscribe(params => {
      this.resetToken = params['token'] || '';
      
      if (!this.resetToken) {
        this.errorMessage = 'Token de redefinição inválido ou expirado.';
      }
    });
  }

  onSubmit(): void {
    if (this.resetPasswordForm.invalid || !this.resetToken) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const resetData = {
      token: this.resetToken,
      password: this.resetPasswordForm.value.password,
      confirmPassword: this.resetPasswordForm.value.confirmPassword
    };

    this.authService.resetPassword(resetData).subscribe({
      next: () => {
        this.isLoading = false;
        this.passwordReset = true;
        this.successMessage = 'Senha redefinida com sucesso!';
        this.cdr.detectChanges();
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          this.router.navigate(['/entrar']);
        }, 3000);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Erro ao redefinir senha. O token pode estar expirado.';
        this.cdr.detectChanges();
      }
    });
  }

  getErrorMessage(fieldName: string): string {
    const control = this.resetPasswordForm.get(fieldName);
    
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    if (control.errors['required']) {
      return AUTH_CONSTANTS.VALIDATION_MESSAGES.REQUIRED;
    }

    if (fieldName === 'password') {
      if (control.errors['minlength']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH;
      }
      if (control.errors['weakPassword']) {
        return AUTH_CONSTANTS.VALIDATION_MESSAGES.PASSWORD_WEAK;
      }
    }

    if (fieldName === 'confirmPassword' && this.resetPasswordForm.errors?.['passwordMismatch']) {
      return AUTH_CONSTANTS.VALIDATION_MESSAGES.PASSWORD_MATCH;
    }

    return '';
  }

  goToLogin(): void {
    this.router.navigate(['/entrar']);
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }
}
