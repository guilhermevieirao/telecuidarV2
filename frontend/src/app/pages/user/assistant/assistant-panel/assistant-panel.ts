import { Component, OnInit, OnDestroy, effect, untracked, PLATFORM_ID, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { IconComponent, IconName } from '@app/shared/components/atoms/icon/icon';
import { AvatarComponent } from '@app/shared/components/atoms/avatar/avatar';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';
import { AuthService } from '@app/core/services/auth.service';
import { User as AuthUser } from '@app/core/models/auth.model';

interface PanelButton {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  route: string;
  color: 'green' | 'blue' | 'red' | 'purple' | 'orange';
  stats?: string | number;
  isLogout?: boolean;
}

interface AssistantStats {
  todayAppointments: number;
  waitingPatients: number;
  completedToday: number;
  unreadNotifications: number;
}

@Component({
  selector: 'app-assistant-panel',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    AvatarComponent,
    LogoComponent,
    ThemeToggleComponent
  ],
  providers: [DatePipe],
  templateUrl: './assistant-panel.html',
  styleUrls: ['./assistant-panel.scss']
})
export class AssistantPanelComponent implements OnInit, OnDestroy {
  user: AuthUser | null = null;
  stats: AssistantStats | null = null;
  currentTime: string = '';
  currentDate: string = '';
  private timeInterval: any;

  panelButtons: PanelButton[] = [
    {
      id: 'digital-office',
      title: 'Consultório Digital',
      description: 'Gerenciar atendimentos',
      icon: 'monitor',
      route: '/consultorio-digital',
      color: 'blue'
    },
    {
      id: 'appointments',
      title: 'Consultas',
      description: 'Visualizar consultas',
      icon: 'calendar',
      route: '/consultas',
      color: 'green'
    },
    {
      id: 'notifications',
      title: 'Notificações',
      description: 'Central de avisos',
      icon: 'bell',
      route: '/notificacoes',
      color: 'purple'
    },
    {
      id: 'profile',
      title: 'Meu Perfil',
      description: 'Dados pessoais',
      icon: 'user',
      route: '/perfil',
      color: 'orange'
    },
    {
      id: 'logout',
      title: 'Sair',
      description: 'Encerrar sessão',
      icon: 'log-out',
      route: '',
      color: 'red',
      isLogout: true
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    effect(() => {
      const authUser = this.authService.currentUser();
      if (authUser) {
        untracked(() => {
          this.user = authUser;
          this.cdr.detectChanges();
        });
      }
    });
  }

  ngOnInit(): void {
    const authUser = this.authService.currentUser();
    if (authUser) {
      this.user = authUser;
    }
    
    this.loadStats();
    this.updateTime();
    
    if (isPlatformBrowser(this.platformId)) {
      this.timeInterval = setInterval(() => this.updateTime(), 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  private updateTime(): void {
    const now = new Date();
    this.currentTime = this.datePipe.transform(now, 'HH:mm:ss') || '';
    this.currentDate = this.datePipe.transform(now, 'EEEE, dd \'de\' MMMM \'de\' yyyy', 'pt-BR') || '';
  }

  private loadStats(): void {
    // Estatísticas fixas por enquanto - pode ser expandido para chamar API
    this.stats = {
      todayAppointments: 0,
      waitingPatients: 0,
      completedToday: 0,
      unreadNotifications: 0
    };
    this.cdr.detectChanges();
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/entrar']);
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }
}
