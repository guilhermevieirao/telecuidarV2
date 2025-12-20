import { Injectable, signal, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, BehaviorSubject, tap, catchError, of, throwError } from 'rxjs';
import {
  User,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  AuthState
} from '@app/core/models/auth.model';
import { AUTH_ENDPOINTS, STORAGE_KEYS } from '@app/core/constants/auth.constants';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authState = new BehaviorSubject<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null
  });

  public authState$ = this.authState.asObservable();
  public currentUser = signal<User | null>(null);
  public isAuthenticated = signal<boolean>(false);
  private storageLoaded = false;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Load from storage only in browser
    if (isPlatformBrowser(this.platformId)) {
      this.loadUserFromStorage();
    }
  }

  // Login
  login(request: LoginRequest): Observable<LoginResponse> {
    this.setLoading(true);
    
    return this.http.post<LoginResponse>(AUTH_ENDPOINTS.LOGIN, request).pipe(
      tap(response => {
        this.handleAuthSuccess(response, request.rememberMe);
        this.setLoading(false);
      }),
      catchError(error => {
        this.setError(error.error?.message || 'Erro ao fazer login');
        this.setLoading(false);
        throw error;
      })
    );
  }

  // Register
  register(request: RegisterRequest): Observable<RegisterResponse> {
    this.setLoading(true);
    
    return this.http.post<RegisterResponse>(AUTH_ENDPOINTS.REGISTER, request).pipe(
      tap(response => {
        this.setLoading(false);
      }),
      catchError(error => {
        this.setError(error.error?.message || 'Erro ao criar conta');
        this.setLoading(false);
        throw error;
      })
    );
  }

  // Logout
  logout(): void {
    this.clearStorage();
    this.authState.next({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  // Forgot Password
  forgotPassword(request: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    this.setLoading(true);
    
    return this.http.post<ForgotPasswordResponse>(AUTH_ENDPOINTS.FORGOT_PASSWORD, request).pipe(
      tap(() => this.setLoading(false)),
      catchError(error => {
        this.setError(error.error?.message || 'Erro ao enviar email');
        this.setLoading(false);
        throw error;
      })
    );
  }

  // Reset Password
  resetPassword(request: ResetPasswordRequest): Observable<ResetPasswordResponse> {
    this.setLoading(true);
    
    return this.http.post<ResetPasswordResponse>(AUTH_ENDPOINTS.RESET_PASSWORD, request).pipe(
      tap(() => this.setLoading(false)),
      catchError(error => {
        this.setError(error.error?.message || 'Erro ao redefinir senha');
        this.setLoading(false);
        throw error;
      })
    );
  }

  // Verify Email
  verifyEmail(request: VerifyEmailRequest): Observable<VerifyEmailResponse> {
    this.setLoading(true);
    
    return this.http.post<VerifyEmailResponse>(AUTH_ENDPOINTS.VERIFY_EMAIL, request).pipe(
      tap(response => {
        if (response.user) {
          this.currentUser.set(response.user);
        }
        this.setLoading(false);
      }),
      catchError(error => {
        this.setError(error.error?.message || 'Erro ao verificar email');
        this.setLoading(false);
        throw error;
      })
    );
  }

  // Resend Verification Email
  resendVerificationEmail(email: string): Observable<any> {
    return this.http.post(AUTH_ENDPOINTS.RESEND_VERIFICATION, { email });
  }

  // Google Login (placeholder)
  loginWithGoogle(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Implementar OAuth2 com Google
      window.location.href = AUTH_ENDPOINTS.GOOGLE_LOGIN;
    }
  }

  // Refresh Token
  refreshToken(): Observable<LoginResponse> {
    let refreshToken: string | null = null;
    
    if (isPlatformBrowser(this.platformId)) {
      refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    }
    
    return this.http.post<LoginResponse>(AUTH_ENDPOINTS.REFRESH_TOKEN, { refreshToken }).pipe(
      tap(response => {
        this.handleAuthSuccess(response, true);
      })
    );
  }

  // Get Access Token
  getAccessToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    }
    return null;
  }

  // Private helper methods
  private handleAuthSuccess(response: LoginResponse, rememberMe?: boolean): void {
    
    this.authState.next({
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      isAuthenticated: true,
      isLoading: false,
      error: null
    });
    
    this.currentUser.set(response.user);
    this.isAuthenticated.set(true);
    
    if (isPlatformBrowser(this.platformId)) {
      if (rememberMe) {

        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
        localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
      } else {
        sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken);
        sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
        sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
      }
    }
  }

  private loadUserFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.storageLoaded) {
      return;
    }

    this.storageLoaded = true;

    // Try localStorage first (remember me)
    let accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    let refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    let userStr = localStorage.getItem(STORAGE_KEYS.USER);
    
    // If not in localStorage, try sessionStorage
    if (!accessToken) {
      accessToken = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      refreshToken = sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      userStr = sessionStorage.getItem(STORAGE_KEYS.USER);
    }
    
    if (accessToken && refreshToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.authState.next({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
        
        // Refetch user data from server to get latest avatar and other info
        this.refetchCurrentUser().subscribe({
          error: (err) => console.warn('[AuthService] Failed to refetch user data:', err)
        });
      } catch (error) {
        console.error('[AuthService] Error parsing user data from storage:', error);
        this.clearStorage();
      }
    }
  }

  private clearStorage(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
      
      sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.USER);
    }
  }

  private setLoading(isLoading: boolean): void {
    const current = this.authState.value;
    this.authState.next({ ...current, isLoading });
  }

  private setError(error: string): void {
    const current = this.authState.value;
    this.authState.next({ ...current, error });
  }

  // Get dashboard URL
  getDashboardUrl(): string {
    const user = this.currentUser();
    if (!user) return '/entrar';
    return '/painel';
  }

  // Get current user safely
  getCurrentUser(): User | null {
    // Ensure storage is loaded in browser
    if (isPlatformBrowser(this.platformId) && !this.storageLoaded) {
      this.loadUserFromStorage();
    }
    return this.currentUser();
  }

  // Update current user in memory and storage
  updateCurrentUser(user: User): void {
    this.currentUser.set(user);
    
    if (isPlatformBrowser(this.platformId)) {
      // Update in localStorage
      if (localStorage.getItem(STORAGE_KEYS.USER)) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      }
      
      // Update in sessionStorage
      if (sessionStorage.getItem(STORAGE_KEYS.USER)) {
        sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      }
    }
  }

  // Refetch user data from server
  refetchCurrentUser(): Observable<User> {
    const currentUserId = this.currentUser()?.id;
    if (!currentUserId) {
      console.warn('[AuthService] No user ID available for refetch');
      return throwError(() => new Error('User ID not available'));
    }
    
    return this.http.get<User>(`http://localhost:5239/api/users/${currentUserId}`).pipe(
      tap(user => {
        this.updateCurrentUser(user);
      }),
      catchError(error => {
        console.error('[AuthService] Error refetching user:', error);
        throw error;
      })
    );
  }

  // Change Password
  changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Observable<any> {
    this.setLoading(true);
    
    const request = {
      currentPassword,
      newPassword,
      confirmPassword
    };

    return this.http.post(AUTH_ENDPOINTS.CHANGE_PASSWORD, request).pipe(
      tap(() => {
        this.setLoading(false);
      }),
      catchError(error => {
        this.setError(error.error?.message || 'Erro ao trocar senha');
        this.setLoading(false);
        throw error;
      })
    );
  }

  // Check Email Availability
  checkEmailAvailability(email: string): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(`${AUTH_ENDPOINTS.CHECK_EMAIL}/${encodeURIComponent(email)}`).pipe(
      catchError(() => of({ available: true }))
    );
  }

  // Check CPF Availability
  checkCpfAvailability(cpf: string): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(`${AUTH_ENDPOINTS.CHECK_CPF}/${encodeURIComponent(cpf)}`).pipe(
      catchError(() => of({ available: true }))
    );
  }

  // Check Phone Availability
  checkPhoneAvailability(phone: string): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(`${AUTH_ENDPOINTS.CHECK_PHONE}/${encodeURIComponent(phone)}`).pipe(
      catchError(() => of({ available: true }))
    );
  }
}
