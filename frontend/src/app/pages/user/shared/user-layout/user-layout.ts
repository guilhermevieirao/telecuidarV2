import { Component, OnInit, PLATFORM_ID, Inject, HostListener } from '@angular/core';
import { isPlatformBrowser, TitleCasePipe, DOCUMENT } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { AvatarComponent } from '@app/shared/components/atoms/avatar/avatar';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';
import { AuthService } from '@core/services/auth.service';
import { User } from '@core/models/auth.model';

interface Notification {
  id: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

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
    this.router.navigate(['/auth/login']);
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
    // TODO: Integrar com serviço de notificações
    this.unreadNotifications = 5;
  }

  private loadNotifications(): void {
    const basePath = this.getBasePath();
    // TODO: Integrar com serviço de notificações
    this.notifications = [
      {
        id: '1',
        title: 'Nova mensagem',
        message: 'Você recebeu uma nova mensagem do paciente João Silva',
        link: '/notificacoes',
        isRead: false,
        createdAt: new Date(Date.now() - 5 * 60000).toISOString()
      },
      {
        id: '2',
        title: 'Consulta confirmada',
        message: 'A consulta de Maria Santos foi confirmada para 15/12/2025',
        link: '/notificacoes',
        isRead: false,
        createdAt: new Date(Date.now() - 15 * 60000).toISOString()
      },
      {
        id: '3',
        title: 'Aviso de sistema',
        message: 'Sistema será atualizado em 2 horas',
        link: '/notificacoes',
        isRead: true,
        createdAt: new Date(Date.now() - 1 * 3600000).toISOString()
      },
      {
        id: '4',
        title: 'Novo usuário registrado',
        message: 'Um novo profissional se registrou no sistema',
        link: '/notificacoes',
        isRead: true,
        createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
      },
      {
        id: '5',
        title: 'Agendamento cancelado',
        message: 'Agendamento do paciente Pedro Santos foi cancelado',
        link: '/notificacoes',
        isRead: true,
        createdAt: new Date(Date.now() - 6 * 3600000).toISOString()
      }
    ];
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
    // TODO: Integrar com serviço de notificações
    this.notifications = this.notifications.map(notification => ({
      ...notification,
      isRead: true
    }));
    this.unreadNotifications = 0;
  }
}
