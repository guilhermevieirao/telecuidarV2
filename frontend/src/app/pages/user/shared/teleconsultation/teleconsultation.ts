  import { Component, OnInit, OnDestroy, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { ThemeToggleComponent } from '@shared/components/atoms/theme-toggle/theme-toggle';
import { JitsiVideoComponent } from '@shared/components/organisms/jitsi-video/jitsi-video';
import { AppointmentsService, Appointment } from '@core/services/appointments.service';
import { JitsiService } from '@core/services/jitsi.service';
import { ModalService } from '@core/services/modal.service';
import { AuthService } from '@core/services/auth.service';
import { TeleconsultationSidebarComponent } from './sidebar/teleconsultation-sidebar';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-teleconsultation',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    ButtonComponent,
    ThemeToggleComponent,
    RouterModule,
    TeleconsultationSidebarComponent,
    JitsiVideoComponent
  ],
  templateUrl: './teleconsultation.html',
  styleUrls: ['./teleconsultation.scss']
})
export class TeleconsultationComponent implements OnInit, OnDestroy {
  appointmentId: string | null = null;
  appointment: Appointment | null = null;
  userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PATIENT';
  
  // UI States
  isHeaderVisible = true;
  isSidebarOpen = false;
  isSidebarFull = false;
  activeTab: string = '';
  isMobile = false;
  
  // Jitsi States
  jitsiEnabled = false;
  jitsiError: string | null = null;
  isCallConnected = false;

  // Tabs configuration
  professionalTabs = ['Dados do Paciente', 'Dados da Pré Consulta', 'Anamnese', 'Campos da Especialidade', 'Biométricos', 'Chat Anexos', 'SOAP', 'IA', 'CADSUS', 'Concluir'];
  patientTabs = ['Biométricos', 'Chat Anexos'];
  currentTabs: string[] = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private appointmentsService: AppointmentsService,
    private jitsiService: JitsiService,
    private modalService: ModalService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.checkScreenSize();
    this.appointmentId = this.route.snapshot.paramMap.get('id');
    this.determineuserrole();
    this.setupTabs();
    this.checkJitsiConfig();
    
    if (this.appointmentId) {
      this.loadAppointment(this.appointmentId);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.jitsiService.dispose();
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
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.userrole = currentUser.role;
    } else {
      // Fallback to PATIENT if no user is found
      this.userrole = 'PATIENT';
    }
  }

  setupTabs() {
    this.currentTabs = this.userrole === 'PROFESSIONAL' ? this.professionalTabs : this.patientTabs;
    if (this.currentTabs.length > 0) {
      this.activeTab = this.currentTabs[0];
    }
  }

  loadAppointment(id: string) {
    this.appointmentsService.getAppointmentById(id).subscribe({
      next: (appt) => {
        if (appt) {
          this.appointment = appt;
        }
      },
      error: (error) => {
        // Se for erro 401, o interceptor já redireciona automaticamente
        if (error.status === 401) {
          return; // Não fazer nada, deixar o interceptor cuidar
        }
        
        // Para outros erros, logar e mostrar mensagem
        console.error('Erro ao carregar consulta:', error);
        this.modalService.alert({
          title: 'Erro',
          message: 'Não foi possível carregar os dados da consulta.',
          variant: 'danger'
        }).subscribe(() => {
          this.router.navigate(['/painel']);
        });
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
    this.modalService.confirm({
      title: 'Sair da Consulta',
      message: 'Tem certeza que deseja sair da teleconsulta?',
      variant: 'warning',
      confirmText: 'Sim, sair',
      cancelText: 'Cancelar'
    }).subscribe({
      next: (result) => {
        if (result.confirmed) {
          this.jitsiService.dispose();
          this.router.navigate(['/painel']);
        }
      }
    });
  }

  /**
   * Verifica se o Jitsi está habilitado
   */
  private checkJitsiConfig(): void {
    this.subscriptions.push(
      this.jitsiService.getConfig().subscribe({
        next: (config) => {
          this.jitsiEnabled = config.enabled;
        },
        error: () => {
          this.jitsiEnabled = false;
        }
      })
    );
  }

  /**
   * Handler quando a conferência é conectada
   */
  onConferenceJoined(info: any): void {
    this.isCallConnected = true;
  }

  /**
   * Handler quando a conferência é desconectada
   */
  onConferenceLeft(info: any): void {
    this.isCallConnected = false;
  }

  /**
   * Handler para erros na chamada
   */
  onJitsiError(error: string): void {
    this.jitsiError = error;
    this.modalService.alert({
      title: 'Erro na Videochamada',
      message: error,
      variant: 'danger'
    }).subscribe();
  }

  /**
   * Handler quando a chamada é encerrada
   */
  onCallEnded(): void {
    this.isCallConnected = false;
  }
}
