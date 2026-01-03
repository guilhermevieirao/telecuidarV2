import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { AUTH_CONSTANTS } from '@app/core/constants/auth.constants';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonComponent,
    LogoComponent,
    IconComponent,
    ThemeToggleComponent
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss'
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  forgotPasswordForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  emailSent = false;

  constructor() {
    this.forgotPasswordForm = this.fb.group({
      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.pattern(AUTH_CONSTANTS.VALIDATION_PATTERNS.EMAIL)
        ]
      ]
    });
  }

  onSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const email = this.forgotPasswordForm.value.email;

    this.authService.forgotPassword({ email }).subscribe({
      next: () => {
        this.isLoading = false;
        this.emailSent = true;
        this.successMessage = 'Enviamos um link de recuperação para seu e-mail. Verifique sua caixa de entrada.';
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Erro ao enviar e-mail. Tente novamente.';
        this.cdr.detectChanges();
      }
    });
  }

  resendEmail(): void {
    if (this.forgotPasswordForm.invalid) {
      return;
    }

    this.onSubmit();
  }

  getErrorMessage(): string {
    const control = this.forgotPasswordForm.get('email');
    
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    if (control.errors['required']) {
      return AUTH_CONSTANTS.VALIDATION_MESSAGES.REQUIRED;
    }

    if (control.errors['email'] || control.errors['pattern']) {
      return AUTH_CONSTANTS.VALIDATION_MESSAGES.EMAIL;
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
