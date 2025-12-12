import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { SearchInputComponent } from '@shared/components/atoms/search-input/search-input';
import { AppointmentsService, Appointment, AppointmentsFilter, AppointmentStatus } from '@core/services/appointments.service';
import { AppointmentDetailsModalComponent } from './appointment-details-modal/appointment-details-modal';
import { ModalService } from '@core/services/modal.service';

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
    AppointmentDetailsModalComponent
  ],
  templateUrl: './appointments.html',
  styleUrls: ['./appointments.scss']
})
export class AppointmentsComponent implements OnInit {
  appointments: Appointment[] = [];
  allAppointments: Appointment[] = []; // Store all to count
  loading = false;
  userRole: 'patient' | 'professional' | 'admin' = 'patient';
  
  // Counts
  counts = {
    all: 0,
    upcoming: 0,
    past: 0,
    cancelled: 0
  };

  // Filters
  activeTab: 'all' | 'upcoming' | 'past' | 'cancelled' = 'all';
  searchQuery = '';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Modal
  selectedAppointment: Appointment | null = null;
  isDetailsModalOpen = false;

  constructor(
    private appointmentsService: AppointmentsService,
    private router: Router,
    private route: ActivatedRoute,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    this.determineUserRole();
    this.loadAppointments();
  }

  determineUserRole() {
    const url = this.router.url;
    if (url.includes('/patient')) {
      this.userRole = 'patient';
    } else if (url.includes('/professional')) {
      this.userRole = 'professional';
    } else {
      this.userRole = 'admin';
    }
  }

  loadAppointments() {
    this.loading = true;
    
    // Load all to calculate counts
    this.appointmentsService.getAppointments({}).subscribe(allData => {
        this.allAppointments = allData;
        this.calculateCounts();
        this.filterAndSortAppointments();
        this.loading = false;
    });
  }

  calculateCounts() {
    const now = new Date();
    this.counts.all = this.allAppointments.length;
    
    this.counts.upcoming = this.allAppointments.filter(a => 
        new Date(a.date) >= now && a.status !== 'cancelled' && a.status !== 'completed'
    ).length;

    this.counts.past = this.allAppointments.filter(a => 
        new Date(a.date) < now || a.status === 'completed'
    ).length;

    this.counts.cancelled = this.allAppointments.filter(a => 
        a.status === 'cancelled'
    ).length;
  }

  filterAndSortAppointments() {
    let filtered = [...this.allAppointments];
    const now = new Date();

    // Filter by Tab
    if (this.activeTab === 'upcoming') {
        filtered = filtered.filter(a => new Date(a.date) >= now && a.status !== 'cancelled' && a.status !== 'completed');
    } else if (this.activeTab === 'past') {
        filtered = filtered.filter(a => new Date(a.date) < now || a.status === 'completed');
    } else if (this.activeTab === 'cancelled') {
        filtered = filtered.filter(a => a.status === 'cancelled');
    }

    // Search
    if (this.searchQuery) {
        const searchLower = this.searchQuery.toLowerCase();
        filtered = filtered.filter(a => 
          a.professionalName.toLowerCase().includes(searchLower) ||
          a.specialtyName.toLowerCase().includes(searchLower) ||
          a.patientName.toLowerCase().includes(searchLower)
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
    if (appointment.meetLink) {
        window.open(appointment.meetLink, '_blank');
    }
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
    this.router.navigate(['/patient/scheduling']);
  }
}
