import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject, HostListener, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { AvatarComponent } from '@app/shared/components/atoms/avatar/avatar';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';
import { AuthService } from '@core/services/auth.service';
import { NotificationsService, Notification } from '@core/services/notifications.service';
import { RealTimeService, UserNotificationUpdate } from '@core/services/real-time.service';
import { User } from '@core/models/auth.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LogoComponent,
    IconComponent,
    AvatarComponent,
    ThemeToggleComponent
  ],
  templateUrl: './user-layout.html',
  styleUrl: './user-layout.scss'
})
export class UserLayoutComponent implements OnInit, OnDestroy {
  isSidebarOpen = false;
  isNotificationDropdownOpen = false;
  unreadNotifications = 0;
  user: User | null = null;
  notifications: Notification[] = [];
  basePath = '';
  private notificationPollingInterval: any;
  private realTimeSubscriptions: Subscription[] = [];

  // Scroll handling
  isHeaderVisible = true;
  private lastScrollTop = 0;
  private readonly SCROLL_THRESHOLD = 50;

  constructor(
    private router: Router,
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private realTimeService: RealTimeService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.basePath = this.getBasePath();
    // Subscribe to auth state to get user updates
    this.authService.authState$.subscribe(state => {
      this.user = state.user;
    });
    this.loadUserData();
    this.loadUnreadNotifications();
    this.loadNotifications();
    
    // Initialize real-time connection for notifications
    if (isPlatformBrowser(this.platformId)) {
      this.initializeRealTime();
      
      // Fallback polling (reduced frequency since we have real-time now)
      this.notificationPollingInterval = setInterval(() => {
        this.loadUnreadNotifications();
        if (this.isNotificationDropdownOpen) {
          this.loadNotifications();
        }
      }, 30000); // Reduced from 3s to 30s as fallback
    }
  }
  
  private initializeRealTime(): void {
    this.realTimeService.connect().then(() => {
      // Subscribe to new notifications
      const notificationSub = this.realTimeService.newNotification$.subscribe(
        (notification: UserNotificationUpdate) => {
          this.handleNewNotification(notification);
        }
      );
      this.realTimeSubscriptions.push(notificationSub);
    }).catch(error => {
      console.error('[UserLayout] Erro ao conectar SignalR:', error);
    });
  }
  
  private handleNewNotification(update: UserNotificationUpdate): void {
    if (update.type === 'AllRead') {
      // All notifications marked as read
      this.unreadNotifications = 0;
      this.notifications = this.notifications.map(n => ({ ...n, isRead: true }));
      this.cdr.detectChanges();
    } else {
      // New notification received - reload from server to get real IDs
      this.loadUnreadNotifications();
      if (this.isNotificationDropdownOpen) {
        this.loadNotifications();
      }
    }
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (!isPlatformBrowser(this.platformId)) return;

    const currentScroll = window.scrollY || this.document.documentElement.scrollTop;
    
    // Ignore negative scroll (bounce effect on some browsers)
    if (currentScroll < 0) return;

    // Determine scroll direction
    if (Math.abs(currentScroll - this.lastScrollTop) > 5) { // minimal threshold to avoid noise
      if (currentScroll > this.lastScrollTop && currentScroll > this.SCROLL_THRESHOLD) {
        // Scrolling Down
        this.isHeaderVisible = false;
      } else {
        // Scrolling Up
        this.isHeaderVisible = true;
      }
    }

    this.lastScrollTop = currentScroll;
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleNotificationDropdown(): void {
    this.isNotificationDropdownOpen = !this.isNotificationDropdownOpen;
    if (this.isNotificationDropdownOpen) {
      this.loadNotifications();
    }
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  closeSidebarOnMobile(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (window.innerWidth < 768) {
        this.closeSidebar();
      }
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/entrar']);
  }

  private getBasePath(): string {
    const urlSegments = this.router.url.split('/');
    if (urlSegments.length > 1) {
      return urlSegments[1];
    }
    return 'ADMIN'; // Fallback
  }

  private loadUserData(): void {
    // Get user from AuthService
    this.user = this.authService.getCurrentUser();
  }

  private loadUnreadNotifications(): void {
    this.notificationsService.getUnreadCount().subscribe({
      next: (response) => {
        setTimeout(() => {
          this.unreadNotifications = response.count;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Erro ao carregar contagem de notificações:', error);
        setTimeout(() => {
          this.unreadNotifications = 0;
          this.cdr.detectChanges();
        });
      }
    });
  }

  private loadNotifications(): void {
    this.notificationsService.getNotifications({}, 1, 5).subscribe({
      next: (response) => {
        setTimeout(() => {
          this.notifications = response.data;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Erro ao carregar notificações:', error);
        setTimeout(() => {
          this.notifications = [];
          this.cdr.detectChanges();
        });
      }
    });
  }

  formatNotificationTime(date: string): string {
    const notificationDate = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - notificationDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `há ${diffMins}m`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays < 7) return `há ${diffDays}d`;

    return notificationDate.toLocaleDateString('pt-BR');
  }

  markAllAsRead(): void {
    this.notificationsService.markAllAsRead().subscribe({
      next: () => {
        setTimeout(() => {
          this.notifications = this.notifications.map(notification => ({
            ...notification,
            isRead: true
          }));
          this.unreadNotifications = 0;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Erro ao marcar notificações como lidas:', error);
      }
    });
  }
  
  ngOnDestroy(): void {
    if (this.notificationPollingInterval) {
      clearInterval(this.notificationPollingInterval);
    }
    // Clean up real-time subscriptions
    this.realTimeSubscriptions.forEach(sub => sub.unsubscribe());
    this.realTimeService.disconnect();
  }

  getRoleLabel(role: string | undefined): string {
    if (!role) return '';
    const roleMap: { [key: string]: string } = {
      'PATIENT': 'Paciente',
      'PROFESSIONAL': 'Profissional',
      'ADMIN': 'Administrador'
    };
    return roleMap[role] || role;
  }
}
