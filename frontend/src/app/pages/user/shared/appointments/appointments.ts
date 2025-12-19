import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { filter, take } from 'rxjs/operators';

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
export class AppointmentsComponent implements OnInit {
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

  private appointmentsService = inject(AppointmentsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private modalService = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);

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
          this.cdr.detectChanges();
        }, 0);
      });
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
    this.appointmentsService.getAppointments({}, 1, 1000).subscribe(response => {
        this.allAppointments = response.data;
        this.calculateCounts();
        this.filterAndSortAppointments();
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        });
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
    this.selectedAppointment = appointment;
    this.isDetailsModalOpen = true;
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
    if (appointment.preConsultation) {
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
