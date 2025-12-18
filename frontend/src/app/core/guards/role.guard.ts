import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const platformId = inject(PLATFORM_ID);

    // Durante SSR, sempre permitir (deixar o browser decidir depois)
    if (!isPlatformBrowser(platformId)) {
      return true;
    }

    const user = authService.currentUser();
    
    if (!user) {
      router.navigate(['/entrar']);
      return false;
    }

    if (!allowedRoles.includes(user.role)) {
      router.navigate(['/painel']);
      return false;
    }

    return true;
  };
};
