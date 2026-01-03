import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '@app/core/services/auth.service';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { InputPasswordComponent } from '@app/shared/components/atoms/input-password/input-password';
import { CheckboxComponent } from '@app/shared/components/atoms/checkbox/checkbox';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';
import { VALIDATION_MESSAGES } from '@app/core/constants/auth.constants';

@Component({
  selector: 'app-login',
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
    ThemeToggleComponent
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;

  validationMessages = VALIDATION_MESSAGES;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rememberMe: [false]
    });
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          const dashboardUrl = this.authService.getDashboardUrl();
          this.router.navigate([dashboardUrl]);
        },
        error: (error) => {
          console.error('Erro no login:', error);
          this.errorMessage = error.error?.message || 'Email ou senha incorretos';
          this.cdr.markForCheck();
        }
      });
  }

  loginWithGoogle(): void {
    this.authService.loginWithGoogle();
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  getErrorMessage(controlName: string): string {
    const control = this.loginForm.get(controlName);
    
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    if (control.errors['required']) {
      return this.validationMessages.REQUIRED;
    }

    if (control.errors['email']) {
      return this.validationMessages.EMAIL;
    }

    if (control.errors['minlength']) {
      return this.validationMessages.MIN_LENGTH(8);
    }

    return '';
  }
}
