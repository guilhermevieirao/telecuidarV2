import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { BadgeComponent } from '@shared/components/atoms/badge/badge';
import { AppointmentsService, Appointment, AppointmentType } from '@core/services/appointments.service';
import { AuthService } from '@core/services/auth.service';
import { TeleconsultationRealTimeService, DataUpdatedEvent } from '@core/services/teleconsultation-realtime.service';
import { ModalService } from '@core/services/modal.service';
import { BiometricsTabComponent } from '@pages/user/shared/teleconsultation/tabs/biometrics-tab/biometrics-tab';
import { AttachmentsChatTabComponent } from '@pages/user/shared/teleconsultation/tabs/attachments-chat-tab/attachments-chat-tab';
import { SoapTabComponent } from '@pages/user/shared/teleconsultation/tabs/soap-tab/soap-tab';
import { ConclusionTabComponent } from '@pages/user/shared/teleconsultation/tabs/conclusion-tab/conclusion-tab';
import { PatientDataTabComponent } from '@pages/user/shared/teleconsultation/tabs/patient-data-tab/patient-data-tab';
import { AnamnesisTabComponent } from '@pages/user/shared/teleconsultation/tabs/anamnesis-tab/anamnesis-tab';
import { SpecialtyFieldsTabComponent } from '@pages/user/shared/teleconsultation/tabs/specialty-fields-tab/specialty-fields-tab';
import { IotTabComponent } from '@pages/user/shared/teleconsultation/tabs/iot-tab/iot-tab';
import { AITabComponent } from '@pages/user/shared/teleconsultation/tabs/ai-tab/ai-tab';
import { ReceitaTabComponent } from '@pages/user/shared/teleconsultation/tabs/receita-tab/receita-tab';
import { AtestadoTabComponent } from '@pages/user/shared/teleconsultation/tabs/atestado-tab/atestado-tab';
import { ReferralTabComponent } from '@pages/user/shared/teleconsultation/tabs/referral-tab/referral-tab';
import { ReturnTabComponent } from '@pages/user/shared/teleconsultation/tabs/return-tab/return-tab';
import { getAllDetailsTabs, TabConfig } from '@pages/user/shared/teleconsultation/tabs/tab-config';
import { Subject, takeUntil } from 'rxjs';

/**
 * Componente de Detalhes da Consulta
 * 
 * Esta é uma tela de VISUALIZAÇÃO APENAS (read-only).
 * 
 * PADRÃO DE BLOQUEIO AUTOMÁTICO:
 * ===============================
 * 
 * 1. Propriedade `isDetailsView = true`:
 *    - Sinaliza que estamos em modo de visualização
 *    - Automaticamente passada para todas as tabs
 *    - Tabs devem respeitar essa propriedade para bloquear interações
 * 
 * 2. CSS Global (.details-view):
 *    - Desabilita visualmente todos os inputs, textareas, selects e botões
 *    - Aplica opacity reduzida para indicar modo read-only
 *    - Mantém navegação entre tabs funcional
 * 
 * 3. Adição de Novas Tabs:
 *    - Novas tabs são automaticamente incluídas via tab-config.ts
 *    - Basta configurar `showInDetails: true` no TELECONSULTATION_TABS
 *    - O bloqueio de interações é aplicado automaticamente via CSS
 * 
 * 4. Exceções:
 *    - Navegação entre tabs permanece ativa (tabs-nav__item)
 *    - Botões de voltar e outras ações da página principal funcionam normalmente
 */
@Component({
  selector: 'app-appointment-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    ButtonComponent,
    BadgeComponent,
    BiometricsTabComponent,
    AttachmentsChatTabComponent,
    SoapTabComponent,
    ConclusionTabComponent,
    PatientDataTabComponent,
    AnamnesisTabComponent,
    SpecialtyFieldsTabComponent,
    IotTabComponent,
    AITabComponent,
    ReceitaTabComponent,
    AtestadoTabComponent,
    ReferralTabComponent,
    ReturnTabComponent
  ],
  templateUrl: './appointment-details.html',
  styleUrls: ['./appointment-details.scss']
})
export class AppointmentDetailsComponent implements OnInit, OnDestroy {
  appointment: Appointment | null = null;
  appointmentId: string | null = null;
  loading = false;
  userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PATIENT';
  
  // Modo de visualização - todas as interações são bloqueadas
  readonly isDetailsView = true;
  
  // Tabs - usando configuração centralizada
  activeTab = 'basic';
  availableTabs: TabConfig[] = getAllDetailsTabs();
  
  private destroy$ = new Subject<void>();
  private isBrowser: boolean;

  private appointmentsService = inject(AppointmentsService);
  private authService = inject(AuthService);
  private teleconsultationRealTime = inject(TeleconsultationRealTimeService);
  private modalService = inject(ModalService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.determineuserrole();
    this.appointmentId = this.route.snapshot.paramMap.get('id');
    
    // Aguardar autenticação antes de carregar
    this.authService.authState$.subscribe((state) => {
      if (state.isAuthenticated && this.appointmentId && !this.appointment) {
        this.loadAppointment(this.appointmentId);
        
        // Setup real-time connection
        if (this.isBrowser) {
          this.setupRealTimeConnection();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Leave consultation room
    if (this.appointmentId) {
      this.teleconsultationRealTime.leaveConsultation(this.appointmentId);
    }
  }

  private setupRealTimeConnection(): void {
    if (!this.appointmentId) return;

    // Join consultation room to receive updates
    this.teleconsultationRealTime.joinConsultation(this.appointmentId).catch(error => {
      console.error('[AppointmentDetails] Erro ao conectar tempo real:', error);
    });

    // Listen for data updates and reload appointment
    this.teleconsultationRealTime.dataUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: DataUpdatedEvent) => {
        // Update appointment data based on the event type
        if (this.appointment && event.data) {
          if (event.dataType === 'soap') {
            this.appointment = { 
              ...this.appointment, 
              soapJson: JSON.stringify(event.data) 
            };
          } else if (event.dataType === 'anamnesis') {
            this.appointment = { 
              ...this.appointment, 
              anamnesisJson: JSON.stringify(event.data) 
            };
          } else if (event.dataType === 'preConsultation') {
            this.appointment = { 
              ...this.appointment, 
              preConsultationJson: JSON.stringify(event.data) 
            };
          } else if (event.dataType === 'specialtyFields') {
            this.appointment = { 
              ...this.appointment, 
              specialtyFieldsJson: JSON.stringify(event.data) 
            };
          }
          this.cdr.detectChanges();
        }
      });
  }

  determineuserrole() {
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.userrole = currentUser.role;
    } else {
      // Fallback based on URL
      const url = this.router.url;
      if (url.includes('/patient')) {
        this.userrole = 'PATIENT';
      } else if (url.includes('/professional')) {
        this.userrole = 'PROFESSIONAL';
      } else {
        this.userrole = 'ADMIN';
      }
    }
  }

  loadAppointment(id: string) {
    this.loading = true;
    this.appointmentsService.getAppointmentById(id).subscribe({
      next: (appointment) => {
        this.appointment = appointment;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erro ao carregar consulta:', error);
        // Se for erro 401, o interceptor já redireciona automaticamente
        if (error.status === 401) {
          return;
        }
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get visibleTabs(): TabConfig[] {
    // Retornar todas as tabs disponíveis para a página de detalhes, exceto CNS
    return this.availableTabs.filter(tab => tab.id !== 'cns');
  }

  changeTab(tabId: string) {
    this.activeTab = tabId;
  }

  goBack() {
    this.router.navigate(['/consultas']);
  }

  getStatusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' {
    switch (status) {
      case 'Confirmed':
        return 'success';
      case 'Scheduled':
        return 'info';
      case 'Completed':
        return 'success';
      case 'Cancelled':
        return 'error';
      default:
        return 'neutral';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'Scheduled':
        return 'Agendada';
      case 'Confirmed':
        return 'Confirmada';
      case 'Completed':
        return 'Realizada';
      case 'Cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  }

  onFinish(observations: string) {
    if (!this.appointmentId) return;

    this.appointmentsService.completeAppointment(this.appointmentId, observations).subscribe({
      next: () => {
        this.modalService.alert({
          title: 'Consulta Finalizada',
          message: 'Consulta finalizada com sucesso!',
          variant: 'success'
        }).subscribe(() => {
          this.router.navigate(['/consultas']);
        });
      },
      error: () => {
        this.modalService.alert({
          title: 'Erro',
          message: 'Erro ao finalizar consulta.',
          variant: 'danger'
        });
      }
    });
  }

  getAppointmentTypeLabel(appointment: Appointment): string {
    if (!appointment.type) return 'Consulta';
    
    const labels: Record<AppointmentType, string> = {
      'FirstVisit': 'Primeira Consulta',
      'Return': 'Retorno',
      'Routine': 'Rotina',
      'Emergency': 'Emergencial',
      'Common': 'Comum',
      'Referral': 'Encaminhamento'
    };
    return labels[appointment.type] || 'Consulta';
  }
}
