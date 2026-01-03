import { Component, OnInit, OnDestroy, effect, untracked, PLATFORM_ID, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { IconComponent, IconName } from '@app/shared/components/atoms/icon/icon';
import { AvatarComponent } from '@app/shared/components/atoms/avatar/avatar';
import { LogoComponent } from '@app/shared/components/atoms/logo/logo';
import { ThemeToggleComponent } from '@app/shared/components/atoms/theme-toggle/theme-toggle';
import { AuthService } from '@app/core/services/auth.service';
import { AppointmentsService } from '@app/core/services/appointments.service';
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

interface ProfessionalStats {
  todayAppointments: number;
  weekAppointments: number;
  pendingBlocks: number;
  unreadNotifications: number;
}

@Component({
  selector: 'app-professional-panel',
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
  templateUrl: './professional-panel.html',
  styleUrls: ['./professional-panel.scss']
})
export class ProfessionalPanelComponent implements OnInit, OnDestroy {
  user: AuthUser | null = null;
  stats: ProfessionalStats | null = null;
  currentTime: string = '';
  currentDate: string = '';
  private timeInterval: any;

  panelButtons: PanelButton[] = [
    {
      id: 'appointments',
      title: 'Minhas Consultas',
      description: 'Consultas agendadas',
      icon: 'calendar',
      route: '/consultas',
      color: 'blue'
    },
    {
      id: 'my-schedule',
      title: 'Minha Agenda',
      description: 'Visualizar agenda',
      icon: 'clock',
      route: '/minha-agenda',
      color: 'green'
    },
    {
      id: 'blocks',
      title: 'Bloqueios',
      description: 'Solicitar bloqueio',
      icon: 'x-circle',
      route: '/bloqueios-agenda',
      color: 'red'
    },
    {
      id: 'certificates',
      title: 'Certificados',
      description: 'Certificados digitais',
      icon: 'award',
      route: '/certificados',
      color: 'purple'
    },
    {
      id: 'notifications',
      title: 'Notificações',
      description: 'Central de avisos',
      icon: 'bell',
      route: '/notificacoes',
      color: 'orange'
    },
    {
      id: 'profile',
      title: 'Meu Perfil',
      description: 'Dados pessoais',
      icon: 'user',
      route: '/perfil',
      color: 'blue'
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
    private appointmentsService: AppointmentsService,
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
    // Carregar estatísticas do profissional
    this.appointmentsService.getAppointments({ status: 'Scheduled' }).subscribe({
      next: (response) => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const todayAppointments = response.data?.filter((apt) => 
          apt.date?.startsWith(todayStr)
        ).length || 0;

        this.stats = {
          todayAppointments,
          weekAppointments: response.total || 0,
          pendingBlocks: 0,
          unreadNotifications: 0
        };
        this.updateButtonStats();
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('Erro ao carregar estatísticas:', err);
        this.stats = {
          todayAppointments: 0,
          weekAppointments: 0,
          pendingBlocks: 0,
          unreadNotifications: 0
        };
      }
    });
  }

  private updateButtonStats(): void {
    if (!this.stats) return;
    
    const appointmentsBtn = this.panelButtons.find(b => b.id === 'appointments');
    if (appointmentsBtn && this.stats.todayAppointments > 0) {
      appointmentsBtn.stats = this.stats.todayAppointments;
    }
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
