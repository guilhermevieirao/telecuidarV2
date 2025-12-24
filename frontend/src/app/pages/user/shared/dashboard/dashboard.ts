import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, effect, untracked, PLATFORM_ID, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AvatarComponent } from '@app/shared/components/atoms/avatar/avatar';
import { BadgeComponent } from '@app/shared/components/atoms/badge/badge';
import { StatCardComponent } from '@app/shared/components/atoms/stat-card/stat-card';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { StatsService, PlatformStats } from '@app/core/services/stats.service';
import { AuthService } from '@app/core/services/auth.service';
import { AppointmentsService, Appointment, AppointmentStatus } from '@app/core/services/appointments.service';
import { NotificationsService, Notification } from '@app/core/services/notifications.service';
import { ScheduleBlocksService } from '@app/core/services/schedule-blocks.service';
import { RealTimeService, DashboardUpdateNotification, AppointmentStatusUpdate, EntityNotification } from '@app/core/services/real-time.service';
import { User as AuthUser } from '@app/core/models/auth.model';
import { Subscription } from 'rxjs';
import Chart from 'chart.js/auto';

interface DashboardUser {
  id: string;
  name: string;
  lastName: string;
  email: string;
  avatar?: string;
  role: string;
  memberSince: string;
  lastLogin: string;
}

interface ScheduleBlock {
  id: string;
  type: 'single' | 'range';
  date?: string;
  startDate?: string;
  endDate?: string;
  reason: string;
  status: 'pendente' | 'aprovada' | 'negada' | 'vencido';
  createdAt: string;
}

type ViewMode = 'ADMIN' | 'PATIENT' | 'PROFESSIONAL';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AvatarComponent,
    BadgeComponent,
    StatCardComponent,
    IconComponent,
    ButtonComponent
  ],
  providers: [DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  user: DashboardUser | null = null;
  stats: PlatformStats | null = null;
  nextAppointments: Appointment[] = [];
  notifications: Notification[] = [];
  scheduleBlocks: ScheduleBlock[] = [];
  viewMode: ViewMode = 'PATIENT'; // Default
  
  private realTimeSubscriptions: Subscription[] = [];
  
  @ViewChild('appointmentsChart') appointmentsChartRef!: ElementRef;
  @ViewChild('usersChart') usersChartRef!: ElementRef;
  @ViewChild('monthlyChart') monthlyChartRef!: ElementRef;

  appointmentsChart: any;
  usersChart: any;
  monthlyChart: any;

  constructor(
    private statsService: StatsService,
    private authService: AuthService,
    private appointmentsService: AppointmentsService,
    private notificationsService: NotificationsService,
    private scheduleBlocksService: ScheduleBlocksService,
    private realTimeService: RealTimeService,
    private datePipe: DatePipe,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    effect(() => {
      const authUser = this.authService.currentUser();
      if (authUser) {
        // Use untracked to avoid re-triggering effect
        untracked(() => {
          this.viewMode = authUser.role;
          this.updateUser(authUser);
          // Use queueMicrotask to schedule after current change detection cycle
          queueMicrotask(() => {
            this.loadDataForView();
            this.cdr.detectChanges();
          });
        });
      }
    });
  }

  ngOnInit(): void {
    // Initial load attempt (in case signal is already set)
    const authUser = this.authService.currentUser();
    if (authUser) {
      this.viewMode = authUser.role;
      this.updateUser(authUser);
    }
    
    // Initialize real-time updates
    if (isPlatformBrowser(this.platformId)) {
      this.initializeRealTimeUpdates();
    }
  }
  
  private initializeRealTimeUpdates(): void {
    this.realTimeService.connect().then(() => {
      // Subscribe to dashboard updates (for admin)
      const dashboardSub = this.realTimeService.dashboardUpdated$.subscribe(
        (update: DashboardUpdateNotification) => {
          if (this.viewMode === 'ADMIN') {
            this.handleDashboardUpdate(update);
          }
        }
      );
      this.realTimeSubscriptions.push(dashboardSub);
      
      // Subscribe to appointment status changes (for patient/professional)
      const appointmentSub = this.realTimeService.appointmentStatusChanged$.subscribe(
        (update: AppointmentStatusUpdate) => {
          this.handleAppointmentStatusChange(update);
        }
      );
      this.realTimeSubscriptions.push(appointmentSub);
      
      // Subscribe to new notifications
      const notificationSub = this.realTimeService.newNotification$.subscribe(() => {
        this.loadNotifications();
      });
      this.realTimeSubscriptions.push(notificationSub);
      
      // Subscribe to schedule block updates (for professional)
      const scheduleBlockSub = this.realTimeService.getEntityEvents$('ScheduleBlock').subscribe(
        (notification: EntityNotification) => {
          if (this.viewMode === 'PROFESSIONAL') {
            this.loadScheduleBlocks();
          }
        }
      );
      this.realTimeSubscriptions.push(scheduleBlockSub);
      
      // Subscribe to appointment created/updated (for lists)
      const appointmentCreatedSub = this.realTimeService.getEntityEvents$('Appointment').subscribe(
        () => {
          if (this.viewMode !== 'ADMIN') {
            this.loadNextAppointments();
          }
        }
      );
      this.realTimeSubscriptions.push(appointmentCreatedSub);
      
    }).catch(error => {
      console.error('[Dashboard] Erro ao conectar SignalR:', error);
    });
  }
  
  private handleDashboardUpdate(update: DashboardUpdateNotification): void {
    // Reload stats when any dashboard-related update occurs
    this.loadStats();
  }
  
  private handleAppointmentStatusChange(update: AppointmentStatusUpdate): void {
    const userId = this.user?.id;
    
    // Check if this update is relevant to the current user
    if (userId && (update.patientId === userId || update.professionalId === userId)) {
      // Update the appointment in the list
      const index = this.nextAppointments.findIndex(a => a.id === update.appointmentId);
      if (index !== -1) {
        this.nextAppointments[index] = {
          ...this.nextAppointments[index],
          status: update.newStatus as AppointmentStatus
        };
        this.cdr.detectChanges();
      } else {
        // Reload if not found (might be a new appointment)
        this.loadNextAppointments();
      }
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeCharts();
    }
  }

  ngOnDestroy(): void {
    // Clean up real-time subscriptions
    this.realTimeSubscriptions.forEach(sub => sub.unsubscribe());
    
    // Clean up charts when component is destroyed
    if (this.appointmentsChart) {
      this.appointmentsChart.destroy();
      this.appointmentsChart = null;
    }
    if (this.usersChart) {
      this.usersChart.destroy();
      this.usersChart = null;
    }
    if (this.monthlyChart) {
      this.monthlyChart.destroy();
      this.monthlyChart = null;
    }
  }

  private determineViewMode(user: AuthUser): void {
    this.viewMode = user.role;
    this.loadDataForView();
  }

  private updateUser(authUser: AuthUser): void {
    this.user = {
      id: authUser.id,
      name: authUser.name,
      lastName: authUser.lastName,
      email: authUser.email,
      avatar: authUser.avatar,
      role: authUser.role,
      memberSince: this.datePipe.transform(authUser.createdAt, 'MM/yyyy') || '',
      lastLogin: this.datePipe.transform(authUser.updatedAt, 'dd/MM/yyyy HH:mm') || '' // Assuming last login is tracked in updatedAt
    };
  }

  private loadDataForView(): void {
    if (this.viewMode === 'ADMIN') {
      this.loadStats();
      this.initializeCharts();
    } else {
      this.loadNextAppointments();
      this.loadNotifications();
      if (this.viewMode === 'PROFESSIONAL') {
        this.loadScheduleBlocks();
      }
    }
  }

  isAdmin(): boolean {
    return this.viewMode === 'ADMIN';
  }

  isPatient(): boolean {
    return this.viewMode === 'PATIENT';
  }

  isProfessional(): boolean {
    return this.viewMode === 'PROFESSIONAL';
  }

  getRoleLabel(): string {
    const roleMap: { [key: string]: string } = {
      'ADMIN': 'Administrador',
      'PATIENT': 'Paciente',
      'PROFESSIONAL': 'Profissional'
    };
    return roleMap[this.user?.role || 'PATIENT'] || 'Usuário';
  }

  getRoleBadgeVariant(): 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral' {
    const variantMap: { [key: string]: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral' } = {
      'ADMIN': 'primary',
      'PATIENT': 'success',
      'PROFESSIONAL': 'info'
    };
    return variantMap[this.user?.role || 'PATIENT'] || 'neutral';
  }

  openProfileEdit(): void {
    this.router.navigate(['/perfil/editar']);
  }

  getuserrolePath(): string {
    const pathMap = {
      'ADMIN': 'admin',
      'PROFESSIONAL': 'professional',
      'PATIENT': 'patient'
    };
    return pathMap[this.viewMode as keyof typeof pathMap];
  }

  private loadNextAppointments(): void {
    this.appointmentsService.getAppointments({}, 1, 3).subscribe({
      next: (response) => {
        // Take top 3 upcoming
        this.nextAppointments = response.data;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erro ao carregar consultas', err)
    });
  }

  private loadNotifications(): void {
    this.notificationsService.getNotifications({}, 1, 3).subscribe({
      next: (response) => {
        // Take top 3
        this.notifications = response.data;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erro ao carregar notificações', err)
    });
  }

  private loadScheduleBlocks(): void {
    this.scheduleBlocksService.getScheduleBlocks(undefined, undefined, 1, 5).subscribe({
      next: (response) => {
        this.scheduleBlocks = response.data.map(block => ({
          id: block.id,
          type: block.type.toLowerCase() as 'single' | 'range',
          date: block.date,
          startDate: block.startDate,
          endDate: block.endDate,
          reason: block.reason,
          status: this.mapStatusToPortuguese(block.status),
          createdAt: block.createdAt
        }));
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erro ao carregar bloqueios de agenda', err)
    });
  }

  private mapStatusToPortuguese(status: string): 'pendente' | 'aprovada' | 'negada' | 'vencido' {
    const statusMap: { [key: string]: 'pendente' | 'aprovada' | 'negada' | 'vencido' } = {
      'Pending': 'pendente',
      'Approved': 'aprovada',
      'Rejected': 'negada',
      'Expired': 'vencido'
    };
    return statusMap[status] || 'pendente';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'pendente': 'Pendente',
      'aprovada': 'Aprovada',
      'negada': 'Negada',
      'vencido': 'Vencido'
    };
    return labels[status] || status;
  }

  private loadStats(): void {
    this.statsService.getPlatformStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erro ao carregar estatísticas:', error);
      }
    });
  }

  private initializeCharts(): void {
    if (this.viewMode !== 'ADMIN') return;

    // Only load charts in the browser, not during SSR
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Wrap in timeout to ensure DOM is ready if switching views
    setTimeout(() => {
        if (!this.appointmentsChartRef || !this.usersChartRef || !this.monthlyChartRef) return;
        
        // Destroy existing charts if any to avoid duplicates/errors
        if (this.appointmentsChart) {
          this.appointmentsChart.destroy();
          this.appointmentsChart = null;
        }
        if (this.usersChart) {
          this.usersChart.destroy();
          this.usersChart = null;
        }
        if (this.monthlyChart) {
          this.monthlyChart.destroy();
          this.monthlyChart = null;
        }

        this.statsService.getAppointmentsByStatus().subscribe({
          next: (data) => {
            // Destroy again before creating, in case multiple subscriptions fire
            if (this.appointmentsChart) {
              this.appointmentsChart.destroy();
            }
            if (this.appointmentsChartRef) {
              this.appointmentsChart = new Chart(this.appointmentsChartRef.nativeElement, {
                type: 'doughnut',
                data: data,
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' }
                  }
                }
              });
            }
          },
          error: (error) => {
            console.error('Erro ao carregar dados do gráfico:', error);
          }
        });

        this.statsService.getUsersByRole().subscribe({
          next: (data) => {
            // Destroy again before creating, in case multiple subscriptions fire
            if (this.usersChart) {
              this.usersChart.destroy();
            }
            if (this.usersChartRef) {
              this.usersChart = new Chart(this.usersChartRef.nativeElement, {
                type: 'bar',
                data: data,
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { beginAtZero: true }
                  },
                  plugins: {
                    legend: { display: false }
                  }
                }
              });
            }
          },
          error: (error) => {
            console.error('Erro ao carregar dados do gráfico:', error);
          }
        });

        this.statsService.getMonthlyAppointments().subscribe({
          next: (data) => {
            // Destroy again before creating, in case multiple subscriptions fire
            if (this.monthlyChart) {
              this.monthlyChart.destroy();
            }
            if (this.monthlyChartRef) {
              this.monthlyChart = new Chart(this.monthlyChartRef.nativeElement, {
                type: 'line',
                data: data,
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { beginAtZero: true }
                  },
                  plugins: {
                    legend: { position: 'top' }
                  }
                }
              });
            }
          },
          error: (error) => {
            console.error('Erro ao carregar dados do gráfico:', error);
          }
        });
    }, 0);
  }

  goToProfile(): void {
    this.router.navigate(['/perfil']);
  }
}
