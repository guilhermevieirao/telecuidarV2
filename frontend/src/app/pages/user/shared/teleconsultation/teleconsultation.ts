  import { Component, OnInit, OnDestroy, HostListener, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
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
import { DeviceDetectorService } from '@core/services/device-detector.service';
import { TeleconsultationRealTimeService, StatusChangedEvent, DataUpdatedEvent } from '@core/services/teleconsultation-realtime.service';
import { TeleconsultationSidebarComponent } from './sidebar/teleconsultation-sidebar';
import { getTeleconsultationTabs, TAB_ID_TO_LEGACY_NAME, TabConfig } from './tabs/tab-config';
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

  // Tabs configuration - usando configuração centralizada
  currentTabs: string[] = [];
  private tabConfigs: TabConfig[] = [];

  private subscriptions: Subscription[] = [];
  private isBrowser: boolean;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private appointmentsService: AppointmentsService,
    private jitsiService: JitsiService,
    private modalService: ModalService,
    private authService: AuthService,
    private deviceDetector: DeviceDetectorService,
    private teleconsultationRealTime: TeleconsultationRealTimeService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.checkScreenSize();
    this.appointmentId = this.route.snapshot.paramMap.get('id');
    this.determineuserrole();
    this.setupTabs();
    this.checkJitsiConfig();
    
    if (this.appointmentId) {
      this.loadAppointment(this.appointmentId);
      
      // Setup real-time connection
      if (this.isBrowser) {
        this.setupRealTimeConnection();
      }
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.jitsiService.dispose();
    
    // Leave teleconsultation room
    if (this.appointmentId) {
      this.teleconsultationRealTime.leaveConsultation(this.appointmentId);
    }
  }

  private setupRealTimeConnection(): void {
    if (!this.appointmentId) return;
    
    // Join the teleconsultation room
    this.teleconsultationRealTime.joinConsultation(this.appointmentId).catch(error => {
      console.error('[Teleconsultation] Erro ao conectar tempo real:', error);
    });
    
    // Subscribe to status changes
    const statusSub = this.teleconsultationRealTime.statusChanged$.subscribe(
      (event: StatusChangedEvent) => {
        if (this.appointment) {
          this.appointment = { ...this.appointment, status: event.status as any };
          this.cdr.detectChanges();
        }
      }
    );
    this.subscriptions.push(statusSub);
    
    // Subscribe to data updates to reload appointment when needed
    const dataSub = this.teleconsultationRealTime.dataUpdated$.subscribe(
      (event: DataUpdatedEvent) => {
        // Reload appointment when important data changes
        if (['soap', 'anamnesis', 'preConsultation'].includes(event.dataType)) {
          this.reloadAppointment();
        }
      }
    );
    this.subscriptions.push(dataSub);
  }

  private reloadAppointment(): void {
    if (this.appointmentId) {
      this.appointmentsService.getAppointmentById(this.appointmentId).subscribe({
        next: (appt) => {
          if (appt) {
            this.appointment = appt;
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('[Teleconsultation] Erro ao recarregar consulta:', error);
        }
      });
    }
  }

  @HostListener('window:resize', [])
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize() {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile = this.deviceDetector.isMobile();
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
    // Usar configuração centralizada de tabs
    this.tabConfigs = getTeleconsultationTabs(this.userrole);
    // Converter para nomes legados usados pelo sidebar
    this.currentTabs = this.tabConfigs.map(tab => TAB_ID_TO_LEGACY_NAME[tab.id] || tab.label);
    if (this.currentTabs.length > 0) {
      this.activeTab = this.currentTabs[0];
    }
  }

  loadAppointment(id: string) {
    this.appointmentsService.getAppointmentById(id).subscribe({
      next: (appt) => {
        if (appt) {
          this.appointment = appt;
          this.cdr.detectChanges();
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
