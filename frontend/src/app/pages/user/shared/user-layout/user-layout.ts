import { Component, OnInit, PLATFORM_ID, Inject, HostListener } from '@angular/core';
import { isPlatformBrowser, TitleCasePipe, DOCUMENT } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { AvatarComponent } from '@app/shared/components/atoms/avatar/avatar';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';
import { AuthService } from '@core/services/auth.service';
import { NotificationsService, Notification } from '@core/services/notifications.service';
import { User } from '@core/models/auth.model';

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
    ThemeToggleComponent,
    TitleCasePipe
  ],
  templateUrl: './user-layout.html',
  styleUrl: './user-layout.scss'
})
export class UserLayoutComponent implements OnInit {
  isSidebarOpen = false;
  isNotificationDropdownOpen = false;
  unreadNotifications = 0;
  user: User | null = null;
  notifications: Notification[] = [];
  basePath = '';

  // Scroll handling
  isHeaderVisible = true;
  private lastScrollTop = 0;
  private readonly SCROLL_THRESHOLD = 50;

  constructor(
    private router: Router,
    private authService: AuthService,
    private notificationsService: NotificationsService,
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
        this.unreadNotifications = response.count;
      },
      error: (error) => {
        console.error('Erro ao carregar contagem de notificações:', error);
        this.unreadNotifications = 0;
      }
    });
  }

  private loadNotifications(): void {
    this.notificationsService.getNotifications({}, 1, 5).subscribe({
      next: (response) => {
        this.notifications = response.data;
      },
      error: (error) => {
        console.error('Erro ao carregar notificações:', error);
        this.notifications = [];
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
        this.notifications = this.notifications.map(notification => ({
          ...notification,
          isRead: true
        }));
        this.unreadNotifications = 0;
      },
      error: (error) => {
        console.error('Erro ao marcar notificações como lidas:', error);
      }
    });
  }
}
