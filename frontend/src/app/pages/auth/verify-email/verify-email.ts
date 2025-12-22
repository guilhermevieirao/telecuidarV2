import { Component, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take, distinctUntilChanged, filter, debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    LogoComponent,
    IconComponent
  ],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss'
})
export class VerifyEmailComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  isLoading = false;
  errorMessage = '';
  successMessage = '';
  verificationToken = '';
  emailVerified = false;
  verificationFailed = false;
  private verificationAttempted = false;

  constructor() {
    // Get verification token from URL query params
    this.route.queryParams.pipe(
      debounceTime(100),
      filter(params => !!params['token']),
      distinctUntilChanged((prev, curr) => prev['token'] === curr['token']),
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      this.verificationToken = params['token'];
      
      // Garantir que só execute uma vez
      if (!this.verificationAttempted) {
        this.verificationAttempted = true;
        this.isLoading = true;
        // Pequeno delay para garantir que Angular terminou a hidratação
        setTimeout(() => {
          this.verifyEmail();
        }, 100);
      }
    });

    // Se não houver token
    this.route.queryParams.pipe(
      filter(params => !params['token']),
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.isLoading = false;
      this.verificationFailed = true;
      this.errorMessage = 'Token de verificação inválido.';
    });
  }

  verifyEmail(): void {
    if (!this.verificationToken) {
      return;
    }

    this.authService.verifyEmail({ token: this.verificationToken })
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.emailVerified = true;
          this.successMessage = 'E-mail verificado com sucesso!';
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            this.router.navigate(['/entrar']);
          }, 3000);
        },
        error: (error) => {
          this.isLoading = false;
          this.verificationFailed = true;
          this.errorMessage = error.error?.message || 'Erro ao verificar e-mail. O token pode estar expirado.';
        }
      });
  }

  resendVerificationEmail(): void {
    this.errorMessage = 'Para reenviar o e-mail de verificação, faça login novamente.';
  }

  goToLogin(): void {
    this.router.navigate(['/entrar']);
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }
}
