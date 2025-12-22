import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError, EMPTY } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);
  
  // Obter token do localStorage (apenas no browser)
  let token: string | null = null;
  if (isBrowser) {
    token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  }
  
  // Clonar requisição e adicionar token se existir
  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
  
  // Enviar requisição e tratar erros
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!isBrowser) {
        return throwError(() => error);
      }

      // Se erro 401 (não autorizado), redirecionar para login
      // Mas não redirecionar se já estiver em páginas de autenticação
      if (error.status === 401) {
        const currentUrl = router.url;
        const isAuthPage = currentUrl.includes('/entrar') || 
                          currentUrl.includes('/registrar') || 
                          currentUrl.includes('/esqueci-senha') ||
                          currentUrl.includes('/redefinir-senha') ||
                          currentUrl.includes('/verify-email');
        
        // Só limpar storage e redirecionar se não estiver em página de autenticação
        if (!isAuthPage) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          sessionStorage.removeItem('access_token');
          sessionStorage.removeItem('refresh_token');
          sessionStorage.removeItem('user');
          
          router.navigate(['/entrar'], { 
            queryParams: { returnUrl: router.url } 
          });
          
          // Retornar EMPTY para completar o observable sem erro
          return EMPTY;
        }
      }
      
      // Se erro 403 (sem permissão), redirecionar para página apropriada
      if (error.status === 403) {
        router.navigate(['/']);
        return EMPTY;
      }
      
      return throwError(() => error);
    })
  );
};
