import { Component, inject, DestroyRef, Inject, PLATFORM_ID, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take, distinctUntilChanged, debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    LogoComponent,
    IconComponent,
    ThemeToggleComponent
  ],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss'
})
export class VerifyEmailComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private isBrowser: boolean;

  isLoading = true; // Iniciar como true para não mostrar erro antes da tentativa
  errorMessage = '';
  successMessage = '';
  verificationToken = '';
  emailVerified = false;
  verificationFailed = false;
  private verificationAttempted = false;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Não executar verificação no servidor (SSR)
    if (!this.isBrowser) {
      return;
    }

    // Get verification token from URL query params
    this.route.queryParams.pipe(
      debounceTime(100),
      distinctUntilChanged((prev, curr) => prev['token'] === curr['token']),
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      if (!params['token']) {
        this.isLoading = false;
        this.verificationFailed = true;
        this.errorMessage = 'Token de verificação inválido.';
        return;
      }

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
          this.ngZone.run(() => {
            this.isLoading = false;
            this.verificationFailed = false;
            this.emailVerified = true;
            this.successMessage = 'E-mail verificado com sucesso!';
            this.cdr.detectChanges();
          });
          
          // Redirect to login after 5 seconds (mais tempo para o usuário ver a mensagem)
          setTimeout(() => {
            this.ngZone.run(() => {
              this.router.navigate(['/entrar']);
            });
          }, 5000);
        },
        error: (error) => {
          this.ngZone.run(() => {
            this.isLoading = false;
            this.verificationFailed = true;
            this.errorMessage = error.error?.message || 'Erro ao verificar e-mail. O token pode estar expirado.';
            this.cdr.detectChanges();
          });
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
