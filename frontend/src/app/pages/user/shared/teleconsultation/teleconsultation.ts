  import { Component, OnInit, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { ThemeToggleComponent } from '@shared/components/atoms/theme-toggle/theme-toggle';
import { AppointmentsService, Appointment } from '@core/services/appointments.service';
import { ModalService } from '@core/services/modal.service';
import { TeleconsultationSidebarComponent } from './sidebar/teleconsultation-sidebar';

@Component({
  selector: 'app-teleconsultation',
  standalone: true,
  imports: [CommonModule, IconComponent, ButtonComponent, ThemeToggleComponent, RouterModule, TeleconsultationSidebarComponent],
  templateUrl: './teleconsultation.html',
  styleUrls: ['./teleconsultation.scss']
})
export class TeleconsultationComponent implements OnInit {
  appointmentId: string | null = null;
  appointment: Appointment | null = null;
  userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PATIENT';
  
  // UI States
  isHeaderVisible = true;
  isSidebarOpen = false;
  isSidebarFull = false;
  activeTab: string = '';
  isMobile = false;

  // Tabs configuration
  professionalTabs = ['Biométricos', 'Chat Anexos', 'SOAP', 'Concluir'];
  patientTabs = ['Biométricos', 'Chat Anexos'];
  currentTabs: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private appointmentsService: AppointmentsService,
    private modalService: ModalService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.checkScreenSize();
    this.appointmentId = this.route.snapshot.paramMap.get('id');
    this.determineuserrole();
    this.setupTabs();
    
    if (this.appointmentId) {
      this.loadAppointment(this.appointmentId);
    }
  }

  @HostListener('window:resize', [])
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize() {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile = window.innerWidth < 768;
      if (this.isMobile && this.isSidebarOpen) {
        this.isSidebarFull = true;
      }
    }
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

  setupTabs() {
    this.currentTabs = this.userrole === 'PROFESSIONAL' ? this.professionalTabs : this.patientTabs;
    if (this.currentTabs.length > 0) {
      this.activeTab = this.currentTabs[0];
    }
  }

  loadAppointment(id: string) {
    this.appointmentsService.getAppointmentById(id).subscribe(appt => {
      if (appt) {
        this.appointment = appt;
      }
    });
  }

  toggleHeader() {
    this.isHeaderVisible = !this.isHeaderVisible;
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
    if (this.isSidebarOpen) {
      // Force full screen on mobile when opening
      if (this.isMobile) {
        this.isSidebarFull = true;
      }
    } else {
      this.isSidebarFull = false; // Reset full mode when closing
    }
  }

  toggleSidebarMode() {
    if (!this.isMobile) {
      this.isSidebarFull = !this.isSidebarFull;
    }
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  onFinishConsultation(observations: string) {
    if (this.appointmentId) {
      this.appointmentsService.completeAppointment(this.appointmentId, observations).subscribe({
        next: () => {
          this.modalService.alert({
            title: 'Consulta Finalizada',
            message: 'Consulta finalizada com sucesso!',
            variant: 'success'
          }).subscribe(() => {
            this.router.navigate(['/painel']);
          });
        },
        error: () => {
          this.modalService.alert({
            title: 'Erro',
            message: 'Erro ao finalizar consulta.',
            variant: 'danger'
          }).subscribe();
        }
      });
    }
  }

  exitCall() {
    // In a real app, we would clean up WebRTC connections here
    if (confirm('Tem certeza que deseja sair da consulta?')) {
      this.router.navigate(['/painel']);
    }
  }
}
