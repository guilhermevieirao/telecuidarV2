import { Component, OnInit, OnDestroy, effect, untracked, PLATFORM_ID, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { IconComponent, IconName } from '@app/shared/components/atoms/icon/icon';
import { AvatarComponent } from '@app/shared/components/atoms/avatar/avatar';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';
import { StatsService, PlatformStats } from '@app/core/services/stats.service';
import { AuthService } from '@app/core/services/auth.service';
import { User as AuthUser } from '@app/core/models/auth.model';
import { Subscription } from 'rxjs';

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

@Component({
  selector: 'app-admin-panel',
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
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.scss']
})
export class AdminPanelComponent implements OnInit, OnDestroy {
  user: AuthUser | null = null;
  stats: PlatformStats | null = null;
  currentTime: string = '';
  currentDate: string = '';
  private timeInterval: any;

  panelButtons: PanelButton[] = [
    {
      id: 'users',
      title: 'Usuários',
      description: 'Gerenciar usuários do sistema',
      icon: 'users',
      route: '/usuarios',
      color: 'blue'
    },
    {
      id: 'invites',
      title: 'Convites',
      description: 'Enviar e gerenciar convites',
      icon: 'mail',
      route: '/convites',
      color: 'green'
    },
    {
      id: 'specialties',
      title: 'Especialidades',
      description: 'Configurar especialidades médicas',
      icon: 'book',
      route: '/especialidades',
      color: 'purple'
    },
    {
      id: 'schedules',
      title: 'Agendas',
      description: 'Gerenciar agendas de atendimento',
      icon: 'calendar',
      route: '/agendas',
      color: 'orange'
    },
    {
      id: 'blocks',
      title: 'Bloqueios',
      description: 'Solicitações de bloqueio de horários',
      icon: 'clock',
      route: '/solicitacoes-bloqueio',
      color: 'red'
    },
    {
      id: 'notifications',
      title: 'Notificações',
      description: 'Central de notificações',
      icon: 'bell',
      route: '/notificacoes',
      color: 'blue'
    },
    {
      id: 'reports',
      title: 'Relatórios',
      description: 'Visualizar relatórios e métricas',
      icon: 'bar-chart',
      route: '/relatorios',
      color: 'green'
    },
    {
      id: 'audit',
      title: 'Auditoria',
      description: 'Logs e registros do sistema',
      icon: 'activity',
      route: '/logs-auditoria',
      color: 'purple'
    },
    {
      id: 'profile',
      title: 'Meu Perfil',
      description: 'Configurações da conta',
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
    private statsService: StatsService,
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
    this.statsService.getPlatformStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.updateButtonStats();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erro ao carregar estatísticas:', error);
      }
    });
  }

  private updateButtonStats(): void {
    if (!this.stats) return;
    
    const userBtn = this.panelButtons.find(b => b.id === 'users');
    if (userBtn) userBtn.stats = this.stats.totalUsers || 0;
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
