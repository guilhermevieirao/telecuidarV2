import { Component, inject, DestroyRef, Inject, PLATFORM_ID, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take, distinctUntilChanged, debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-verify-email-change',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    LogoComponent,
    IconComponent,
    ThemeToggleComponent
  ],
  templateUrl: './verify-email-change.html',
  styleUrl: './verify-email-change.scss'
})
export class VerifyEmailChangeComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private isBrowser: boolean;

  isLoading = true;
  errorMessage = '';
  successMessage = '';
  verificationToken = '';
  emailChanged = false;
  verificationFailed = false;
  newEmail = '';
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
          this.verifyEmailChange();
        }, 100);
      }
    });
  }

  verifyEmailChange(): void {
    if (!this.verificationToken) {
      return;
    }

    this.authService.verifyEmailChange(this.verificationToken)
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.ngZone.run(() => {
            this.isLoading = false;
            this.verificationFailed = false;
            this.emailChanged = true;
            this.newEmail = response.user?.email || '';
            this.successMessage = 'E-mail alterado com sucesso!';
            this.cdr.detectChanges();
          });
          
          // Redirect to profile after 5 seconds
          setTimeout(() => {
            this.ngZone.run(() => {
              // Se o usuário está logado, vai para o perfil, senão vai para login
              if (this.authService.isAuthenticated()) {
                this.router.navigate(['/perfil']);
              } else {
                this.router.navigate(['/entrar']);
              }
            });
          }, 5000);
        },
        error: (error) => {
          this.ngZone.run(() => {
            this.isLoading = false;
            this.verificationFailed = true;
            this.errorMessage = error.error?.message || 'Erro ao verificar mudança de e-mail. O token pode estar expirado ou o e-mail já está em uso.';
            this.cdr.detectChanges();
          });
        }
      });
  }

  goToProfile(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/perfil']);
    } else {
      this.router.navigate(['/entrar']);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/entrar']);
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }
}
