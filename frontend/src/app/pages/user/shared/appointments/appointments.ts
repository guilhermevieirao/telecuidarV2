import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { SearchInputComponent } from '@shared/components/atoms/search-input/search-input';
import { BadgeComponent, BadgeVariant } from '@shared/components/atoms/badge/badge';
import { AppointmentsService, Appointment, AppointmentsFilter, AppointmentStatus, AppointmentType } from '@core/services/appointments.service';
import { AppointmentDetailsModalComponent } from './appointment-details-modal/appointment-details-modal';
import { PreConsultationDetailsModalComponent } from './pre-consultation-details-modal/pre-consultation-details-modal';
import { ModalService } from '@core/services/modal.service';
import { AuthService } from '@core/services/auth.service';
import { RealTimeService, AppointmentStatusUpdate, EntityNotification } from '@core/services/real-time.service';
import { filter, take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonComponent,
    IconComponent,
    SearchInputComponent,
    BadgeComponent,
    AppointmentDetailsModalComponent,
    PreConsultationDetailsModalComponent
  ],
  templateUrl: './appointments.html',
  styleUrls: ['./appointments.scss']
})
export class AppointmentsComponent implements OnInit, OnDestroy {
  appointments: Appointment[] = [];
  allAppointments: Appointment[] = []; // Store all to count
  loading = false;
  userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PATIENT';
  
  // Counts
  counts = {
    all: 0,
    upcoming: 0,
    past: 0,
    Cancelled: 0
  };

  // Filters
  activeTab: 'all' | 'upcoming' | 'past' | 'cancelled' = 'all';
  searchQuery = '';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Modal
  selectedAppointment: Appointment | null = null;
  isDetailsModalOpen = false;
  isPreConsultationModalOpen = false;

  // Real-time subscriptions
  private realTimeSubscriptions: Subscription[] = [];
  private isBrowser: boolean;

  private appointmentsService = inject(AppointmentsService);
  private authService = inject(AuthService);
  private realTimeService = inject(RealTimeService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private modalService = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // Aguardar até que o usuário esteja autenticado
    this.authService.authState$
      .pipe(
        filter(state => state.isAuthenticated && state.user !== null),
        take(1)
      )
      .subscribe((state) => {
        console.log('[Appointments] Usuário autenticado, carregando consultas');
        console.log('[Appointments] User role:', state.user?.role);
        // Usar o role do usuário autenticado (prioridade)
        if (state.user?.role) {
          this.userrole = state.user.role;
        } else {
          // Fallback para URL
          this.determineuserrole();
        }
        console.log('[Appointments] Final userrole:', this.userrole);
        
        // Envolver em setTimeout para evitar ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
          this.loadAppointments();
          this.initializeRealTime();
          this.cdr.detectChanges();
        }, 0);
      });
  }
  
  private initializeRealTime(): void {
    if (!this.isBrowser) return;
    
    this.realTimeService.connect().then(() => {
      // Subscribe to appointment status changes
      const statusSub = this.realTimeService.appointmentStatusChanged$.subscribe(
        (update: AppointmentStatusUpdate) => {
          this.handleAppointmentStatusChange(update);
        }
      );
      this.realTimeSubscriptions.push(statusSub);
      
      // Subscribe to appointment created/updated/deleted
      const entitySub = this.realTimeService.getEntityEvents$('Appointment').subscribe(
        (notification: EntityNotification) => {
          this.handleAppointmentEntityChange(notification);
        }
      );
      this.realTimeSubscriptions.push(entitySub);
    }).catch(error => {
      console.error('[Appointments] Erro ao conectar SignalR:', error);
    });
  }
  
  private handleAppointmentStatusChange(update: AppointmentStatusUpdate): void {
    const index = this.allAppointments.findIndex(a => a.id === update.appointmentId);
    if (index !== -1) {
      // Update status in the local list
      this.allAppointments[index] = {
        ...this.allAppointments[index],
        status: update.newStatus as AppointmentStatus
      };
      this.calculateCounts();
      this.filterAndSortAppointments();
      this.cdr.detectChanges();
    }
  }
  
  private handleAppointmentEntityChange(notification: EntityNotification): void {
    if (notification.action === 'Created') {
      // Reload to get the new appointment
      this.loadAppointments();
    } else if (notification.action === 'Deleted') {
      // Remove from local list
      this.allAppointments = this.allAppointments.filter(a => a.id !== notification.entityId);
      this.calculateCounts();
      this.filterAndSortAppointments();
      this.cdr.detectChanges();
    } else if (notification.action === 'Updated') {
      // Update or reload
      if (notification.data) {
        const index = this.allAppointments.findIndex(a => a.id === notification.entityId);
        if (index !== -1) {
          this.allAppointments[index] = { ...this.allAppointments[index], ...notification.data };
          this.calculateCounts();
          this.filterAndSortAppointments();
          this.cdr.detectChanges();
        }
      } else {
        this.loadAppointments();
      }
    }
  }
  
  ngOnDestroy(): void {
    this.realTimeSubscriptions.forEach(sub => sub.unsubscribe());
  }

  determineuserrole() {
    const url = this.router.url;
    if (url.includes('/patient')) {
      this.userrole = 'PATIENT';
    } else if (url.includes('/professional')) {
      this.userrole = 'PROFESSIONAL';
    } else {
      this.userrole = 'ADMIN';
    }
  }

  loadAppointments() {
    this.loading = true;
    
    // Load all to calculate counts
    this.appointmentsService.getAppointments({}, 1, 1000).subscribe({
      next: (response) => {
        this.allAppointments = response.data;
        this.calculateCounts();
        this.filterAndSortAppointments();
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Erro ao carregar consultas:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  calculateCounts() {
    const now = new Date();
    this.counts.all = this.allAppointments.length;
    
    this.counts.upcoming = this.allAppointments.filter(a => 
        new Date(a.date) >= now && a.status !== 'Cancelled' && a.status !== 'Completed'
    ).length;

    this.counts.past = this.allAppointments.filter(a => 
        new Date(a.date) < now || a.status === 'Completed'
    ).length;

    this.counts.Cancelled = this.allAppointments.filter(a => 
        a.status === 'Cancelled'
    ).length;
  }

  filterAndSortAppointments() {
    let filtered = [...this.allAppointments];
    const now = new Date();

    // Filter by Tab
    if (this.activeTab === 'upcoming') {
        filtered = filtered.filter(a => new Date(a.date) >= now && a.status !== 'Cancelled' && a.status !== 'Completed');
    } else if (this.activeTab === 'past') {
        filtered = filtered.filter(a => new Date(a.date) < now || a.status === 'Completed');
    } else if (this.activeTab === 'cancelled') {
        filtered = filtered.filter(a => a.status === 'Cancelled');
    }

    // Search
    if (this.searchQuery) {
        const searchLower = this.searchQuery.toLowerCase();
        filtered = filtered.filter(a => 
          a.professionalName?.toLowerCase().includes(searchLower) ||
          a.specialtyName?.toLowerCase().includes(searchLower) ||
          a.patientName?.toLowerCase().includes(searchLower)
        );
    }

    this.appointments = filtered;
    this.sortAppointments();
  }

  onTabChange(tab: 'all' | 'upcoming' | 'past' | 'cancelled') {
    this.activeTab = tab;
    this.filterAndSortAppointments();
  }

  onSearch(query: string) {
    this.searchQuery = query;
    this.filterAndSortAppointments();
  }

  toggleSort() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.sortAppointments();
  }

  sortAppointments() {
    this.appointments.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return this.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }

  // Actions
  openDetails(appointment: Appointment) {
    // Navigate to the details page instead of opening a modal
    this.router.navigate(['/consultas', appointment.id, 'detalhes']);
  }

  closeDetails() {
    this.isDetailsModalOpen = false;
    this.selectedAppointment = null;
  }

  accessConsultation(appointment: Appointment) {
    // Navigate to teleconsultation screen within the app
    this.router.navigate(['/teleconsulta', appointment.id]);
  }

  cancelAppointment(appointment: Appointment) {
    this.modalService.confirm({
      title: 'Cancelar Consulta',
      message: 'Tem certeza que deseja cancelar esta consulta? Essa ação não pode ser desfeita.',
      confirmText: 'Sim, Cancelar',
      cancelText: 'Voltar',
      variant: 'danger'
    }).subscribe(result => {
      if (result.confirmed) {
        this.appointmentsService.cancelAppointment(appointment.id).subscribe(success => {
            if (success) {
                this.loadAppointments(); // Reload list
            }
        });
      }
    });
  }

  scheduleNew() {
    this.router.navigate(['/agendar']);
  }

  goToPreConsultation(appointment: Appointment) {
    this.router.navigate(['/consultas', appointment.id, 'pre-consulta']);
  }

  viewPreConsultation(appointment: Appointment) {
    if (appointment.preConsultationJson) {
      this.selectedAppointment = appointment;
      this.isPreConsultationModalOpen = true;
    } else {
      this.modalService.alert({
        title: 'Aviso',
        message: 'O paciente ainda não preencheu a pré-consulta.',
        variant: 'info'
      });
    }
  }

  closePreConsultationModal() {
    this.isPreConsultationModalOpen = false;
    this.selectedAppointment = null;
  }

  getAppointmentTypeLabel(type: AppointmentType): string {
    const labels: Record<AppointmentType, string> = {
      'FirstVisit': 'Primeira Consulta',
      'Return': 'Retorno',
      'Routine': 'Rotina',
      'Emergency': 'Emergencial',
      'Common': 'Comum'
    };
    return labels[type] || 'Consulta';
  }

  getAppointmentTypeVariant(type: AppointmentType): BadgeVariant {
    const variants: Record<AppointmentType, BadgeVariant> = {
      'FirstVisit': 'primary',
      'Return': 'info',
      'Routine': 'success',
      'Emergency': 'error',
      'Common': 'neutral'
    };
    return variants[type] || 'neutral';
  }
}
