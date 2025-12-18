import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // Durante SSR, sempre permitir (deixar o browser decidir depois)
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // Check if authenticated via signal
  if (authService.isAuthenticated()) {
    return true;
  }

  // Fallback: check if token exists in storage (for page refresh)
  const hasToken = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  if (hasToken) {
    return true;
  }

  router.navigate(['/entrar'], { queryParams: { returnUrl: state.url } });
  return false;
};
