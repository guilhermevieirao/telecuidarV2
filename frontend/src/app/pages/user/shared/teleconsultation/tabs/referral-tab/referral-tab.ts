import { Component, Input, afterNextRender, inject, ChangeDetectorRef, LOCALE_ID, OnDestroy, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { AvatarComponent } from '@shared/components/atoms/avatar/avatar';
import { SearchInputComponent } from '@shared/components/atoms/search-input/search-input';
import { SpecialtiesService, Specialty } from '@core/services/specialties.service';
import { SchedulesService } from '@core/services/schedules.service';
import { UsersService, User } from '@core/services/users.service';
import { ScheduleBlocksService } from '@core/services/schedule-blocks.service';
import { AppointmentsService, Appointment, CreateAppointmentDto } from '@core/services/appointments.service';
import { ModalService } from '@core/services/modal.service';
import { SlotReservationService } from '@core/services/slot-reservation.service';
import { SchedulingSignalRService, SlotUpdateNotification, DayUpdateNotification, SpecialtyAvailabilityNotification, SlotProfessionalsUpdateNotification, ScheduleBlockNotification } from '@core/services/scheduling-signalr.service';
import { forkJoin, Observable, Observer, Subscription } from 'rxjs';
import localePt from '@angular/common/locales/pt';

registerLocaleData(localePt);

type Step = 'specialty' | 'date' | 'time' | 'professional-selection' | 'confirmation';

interface DayAvailability {
  date: Date;
  slots: number;
  professionalsCount: number;
  available: boolean;
}

interface TimeSlot {
  time: string;
  professionals: User[];
}

@Component({
  selector: 'app-referral-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonComponent,
    IconComponent,
    AvatarComponent,
    SearchInputComponent
  ],
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' }
  ],
  templateUrl: './referral-tab.html',
  styleUrls: ['./referral-tab.scss']
})
export class ReferralTabComponent implements OnDestroy, OnChanges {
  @Input() appointmentId: string | null = null;
  @Input() appointment: Appointment | null = null;
  @Input() userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PROFESSIONAL';

  currentStep: Step = 'specialty';
  
  steps: { id: Step, label: string }[] = [
    { id: 'specialty', label: 'Especialidade' },
    { id: 'date', label: 'Data' },
    { id: 'time', label: 'Horário' },
    { id: 'professional-selection', label: 'Profissional' },
    { id: 'confirmation', label: 'Confirmação' }
  ];

  weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Step 1: Specialties
  specialties: Specialty[] = [];
  filteredSpecialties: Specialty[] = [];
  selectedSpecialty: Specialty | null = null;
  searchQuery: string = '';

  // Step 2: Date Selection
  currentMonth: Date = new Date();
  calendarDays: DayAvailability[] = [];
  selectedDate: Date | null = null;

  // Step 3: Time & Professional
  availableSlots: TimeSlot[] = [];
  selectedSlot: TimeSlot | null = null;
  selectedProfessional: User | null = null;
  
  // Step 4: Confirmation
  observation: string = '';
  loading: boolean = false;
  
  // Success state
  referralScheduled: boolean = false;
  scheduledAppointment: Appointment | null = null;

  // SignalR subscriptions
  private signalRSubscriptions: Subscription[] = [];
  private currentSpecialtyGroup: string | null = null;
  private pendingReservation: { professionalId: string; time: string } | null = null;
  private isCreatingAppointment: boolean = false;
  timeRemainingSeconds: number = 0;

  private specialtiesService = inject(SpecialtiesService);
  private schedulesService = inject(SchedulesService);
  private usersService = inject(UsersService);
  private scheduleBlocksService = inject(ScheduleBlocksService);
  private appointmentsService = inject(AppointmentsService);
  private modalService = inject(ModalService);
  private slotReservationService = inject(SlotReservationService);
  private schedulingSignalR = inject(SchedulingSignalRService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    afterNextRender(() => {
      this.initializeSignalR();
      this.loadSpecialties();
      
      // Monitorar expiração de reserva
      this.slotReservationService.getReservationExpired$().subscribe(() => {
        this.handleReservationExpired();
      });

      // Atualizar contador a cada segundo
      setInterval(() => {
        this.timeRemainingSeconds = this.slotReservationService.getTimeRemainingSeconds();
        this.cdr.detectChanges();
      }, 1000);
    });
  }

  /**
   * Libera a reserva quando o usuário fecha a aba/navegador
   */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    this.releaseCurrentReservation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appointment'] && this.appointment) {
      // Reset when appointment changes
      this.releaseCurrentReservation();
      this.resetAll();
    }
  }

  ngOnDestroy(): void {
    // Liberar reserva ao sair do componente
    this.releaseCurrentReservation();
    this.pendingReservation = null;

    // Clean up SignalR subscriptions and connection
    this.signalRSubscriptions.forEach(sub => sub.unsubscribe());
    if (this.currentSpecialtyGroup) {
      this.schedulingSignalR.leaveSpecialtyGroup(this.currentSpecialtyGroup);
    }
    this.schedulingSignalR.disconnect();
  }

  /**
   * Libera a reserva atual do usuário
   */
  private releaseCurrentReservation(): void {
    const reservation = this.slotReservationService.getCurrentReservation();
    if (reservation) {
      const url = `${this.slotReservationService.getApiUrl()}/${reservation.id}`;
      const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
      
      fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        keepalive: true
      }).catch(() => {});
      
      this.slotReservationService.clearCurrentReservation();
    }
  }

  /**
   * Chamado quando a reserva expira
   */
  private handleReservationExpired(): void {
    console.log('[Reserva] Reserva expirou!');
    this.slotReservationService.clearCurrentReservation();
    
    if (this.currentStep === 'confirmation' || this.currentStep === 'professional-selection') {
      this.modalService.alert({
        title: 'Reserva Expirada',
        message: 'Sua reserva expirou. Por favor, selecione um novo horário.',
        variant: 'warning'
      }).subscribe(() => {
        this.selectedSlot = null;
        this.selectedProfessional = null;
        this.currentStep = 'time';
        this.loadTimeSlots();
      });
    }
  }

  private initializeSignalR(): void {
    this.schedulingSignalR.connect();
    
    // Subscribe to slot updates
    const slotSub = this.schedulingSignalR.slotUpdated$.subscribe(notification => {
      if (notification) {
        this.handleSlotUpdate(notification);
      }
    });
    this.signalRSubscriptions.push(slotSub);
    
    // Subscribe to day updates
    const daySub = this.schedulingSignalR.dayUpdated$.subscribe(notification => {
      if (notification) {
        this.handleDayUpdate(notification);
      }
    });
    this.signalRSubscriptions.push(daySub);

    // Subscribe to specialty availability updates
    const specialtySub = this.schedulingSignalR.specialtyAvailabilityUpdated$.subscribe(notification => {
      if (notification) {
        this.handleSpecialtyAvailabilityUpdate(notification);
      }
    });
    this.signalRSubscriptions.push(specialtySub);

    // Subscribe to slot professionals updates
    const slotProfessionalsSub = this.schedulingSignalR.slotProfessionalsUpdated$.subscribe(notification => {
      if (notification) {
        this.handleSlotProfessionalsUpdate(notification);
      }
    });
    this.signalRSubscriptions.push(slotProfessionalsSub);

    // Subscribe to schedule block changes
    const scheduleBlockSub = this.schedulingSignalR.scheduleBlockChanged$.subscribe(notification => {
      if (notification) {
        this.handleScheduleBlockChanged(notification);
      }
    });
    this.signalRSubscriptions.push(scheduleBlockSub);
  }

  private handleSlotUpdate(notification: SlotUpdateNotification): void {
    // Check if this update is relevant to current specialty
    if (!this.selectedSpecialty || notification.specialtyId !== this.selectedSpecialty.id) {
      return;
    }

    // Ignorar notificações durante criação de agendamento
    if (this.isCreatingAppointment && this.currentStep === 'confirmation') {
      return;
    }

    // Verificar se é nossa própria reserva (pendente ou confirmada)
    const currentReservation = this.slotReservationService.getCurrentReservation();
    const isPendingReservation = this.pendingReservation &&
        this.pendingReservation.professionalId === notification.professionalId &&
        this.pendingReservation.time === notification.time;
    const isCurrentReservation = currentReservation && 
        currentReservation.professionalId === notification.professionalId &&
        currentReservation.time === notification.time;
    
    if ((isPendingReservation || isCurrentReservation) && !notification.isAvailable) {
      console.log('[SignalR] Ignorando notificação - é nossa própria reserva');
      return;
    }

    // Check if the update is for the currently selected date
    if (this.selectedDate) {
      const updateDate = new Date(notification.date);
      if (updateDate.toDateString() === this.selectedDate.toDateString()) {
        // Update the slot availability in real-time
        const slotIndex = this.availableSlots.findIndex(s => s.time === notification.time);
        
        if (!notification.isAvailable) {
          // Slot was taken - remove the professional from the slot
          if (slotIndex !== -1) {
            const slot = this.availableSlots[slotIndex];
            slot.professionals = slot.professionals.filter(p => p.id !== notification.professionalId);
            
            // If no professionals left, remove the slot entirely
            if (slot.professionals.length === 0) {
              this.availableSlots.splice(slotIndex, 1);
            }
            
            // If this was the selected slot with this professional, deselect it
            if (this.selectedSlot?.time === notification.time && 
                this.selectedProfessional?.id === notification.professionalId) {
              this.selectedSlot = null;
              this.selectedProfessional = null;
              this.modalService.alert({
                title: 'Horário indisponível',
                message: 'Este horário acabou de ser reservado por outro paciente. Por favor, escolha outro horário.',
                variant: 'warning'
              }).subscribe(() => {
                if (this.currentStep === 'confirmation' || this.currentStep === 'professional-selection') {
                  this.currentStep = 'time';
                }
              });
            }
          }
        } else {
          // Slot became available - reload time slots to get fresh data
          this.loadTimeSlots();
        }
        
        this.cdr.detectChanges();
      }
    }
  }

  private handleDayUpdate(notification: DayUpdateNotification): void {
    // Check if this update is relevant to current specialty
    if (!this.selectedSpecialty || notification.specialtyId !== this.selectedSpecialty.id) {
      return;
    }

    // Update the calendar day availability
    const updateDate = new Date(notification.date);
    const dayIndex = this.calendarDays.findIndex(d => 
      d.date.toDateString() === updateDate.toDateString()
    );
    
    if (dayIndex !== -1) {
      // Aplicar o delta ao número de slots
      const newSlots = Math.max(0, this.calendarDays[dayIndex].slots + notification.slotsDelta);
      this.calendarDays[dayIndex].slots = newSlots;
      this.calendarDays[dayIndex].available = newSlots > 0;
      this.cdr.detectChanges();
    }
  }

  private handleSpecialtyAvailabilityUpdate(notification: SpecialtyAvailabilityNotification): void {
    // Atualizar a lista de especialidades em tempo real
    const specialtyIndex = this.specialties.findIndex(s => s.id === notification.specialtyId);
    
    if (specialtyIndex !== -1) {
      if (!notification.hasAvailability) {
        // Especialidade não tem mais vagas - remover da lista
        this.specialties.splice(specialtyIndex, 1);
        this.filteredSpecialties = this.specialties.filter(s => 
          s.name.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
        
        // Se a especialidade selecionada perdeu disponibilidade, alertar o usuário
        if (this.selectedSpecialty?.id === notification.specialtyId) {
          this.modalService.alert({
            title: 'Especialidade indisponível',
            message: 'Esta especialidade não possui mais vagas disponíveis. Por favor, escolha outra.',
            variant: 'warning'
          }).subscribe(() => {
            this.resetAll();
          });
        }
      }
      this.cdr.detectChanges();
    } else if (notification.hasAvailability) {
      // Especialidade voltou a ter vagas - recarregar lista
      this.loadSpecialties();
    }
  }

  private handleSlotProfessionalsUpdate(notification: SlotProfessionalsUpdateNotification): void {
    // Atualizar número de profissionais disponíveis no slot
    if (!this.selectedSpecialty || notification.specialtyId !== this.selectedSpecialty.id) {
      return;
    }

    if (this.selectedDate) {
      const updateDate = new Date(notification.date);
      if (updateDate.toDateString() === this.selectedDate.toDateString()) {
        const slotIndex = this.availableSlots.findIndex(s => s.time === notification.time);
        
        if (slotIndex !== -1) {
          if (!notification.isAvailable) {
            // Profissional removido do slot
            const slot = this.availableSlots[slotIndex];
            slot.professionals = slot.professionals.filter(p => p.id !== notification.professionalId);
            
            if (slot.professionals.length === 0) {
              this.availableSlots.splice(slotIndex, 1);
            }
          }
          this.cdr.detectChanges();
        }
      }
    }
  }

  private handleScheduleBlockChanged(notification: ScheduleBlockNotification): void {
    console.log('[SignalR] Bloqueio de agenda alterado:', notification);
    
    // Verificar se o bloqueio afeta a data selecionada
    if (this.selectedDate) {
      const selectedDateStr = this.selectedDate.toISOString().split('T')[0];
      let affectsSelectedDate = false;
      
      if (notification.blockType === 'Single' && notification.date) {
        const blockDate = new Date(notification.date).toISOString().split('T')[0];
        affectsSelectedDate = blockDate === selectedDateStr;
      } else if (notification.blockType === 'Range' && notification.startDate && notification.endDate) {
        const start = new Date(notification.startDate);
        const end = new Date(notification.endDate);
        affectsSelectedDate = this.selectedDate >= start && this.selectedDate <= end;
      }
      
      if (affectsSelectedDate) {
        // Se estamos na etapa de horário ou posterior, voltar e alertar
        if (this.currentStep === 'time' || this.currentStep === 'professional-selection' || this.currentStep === 'confirmation') {
          this.modalService.alert({
            title: notification.isBlocked ? 'Data bloqueada' : 'Data desbloqueada',
            message: notification.isBlocked 
              ? 'A data selecionada foi bloqueada. Por favor, escolha outra data.'
              : 'A data selecionada foi desbloqueada e agora pode ter novos horários disponíveis.',
            variant: notification.isBlocked ? 'warning' : 'info'
          }).subscribe(() => {
            if (notification.isBlocked) {
              this.selectedDate = null;
              this.selectedSlot = null;
              this.selectedProfessional = null;
              this.currentStep = 'date';
            }
            // Recarregar calendário
            this.generateCalendar();
          });
        } else {
          // Apenas recarregar o calendário
          this.generateCalendar();
        }
        return;
      }
    }
    
    // Se estamos na etapa de data, recarregar o calendário
    if (this.currentStep === 'date') {
      this.generateCalendar();
    }
  }

  getStepIndex(stepId: Step): number {
    return this.steps.findIndex(s => s.id === stepId);
  }

  // --- Step 1: Specialties ---
  loadSpecialties() {
    this.specialtiesService.getSpecialties({ status: 'Active' }).subscribe({
      next: (response) => {
        this.specialties = response.data;
        this.filteredSpecialties = response.data;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erro ao carregar especialidades:', error);
        this.cdr.detectChanges();
      }
    });
  }

  onSearch(query: string) {
    this.searchQuery = query;
    this.filteredSpecialties = this.specialties.filter(s => 
      s.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  selectSpecialty(specialty: Specialty) {
    // Leave previous specialty group if any
    if (this.currentSpecialtyGroup) {
      this.schedulingSignalR.leaveSpecialtyGroup(this.currentSpecialtyGroup);
    }
    
    this.selectedSpecialty = specialty;
    this.currentStep = 'date';
    
    // Join the SignalR group for this specialty to receive real-time updates
    this.currentSpecialtyGroup = specialty.id;
    this.schedulingSignalR.joinSpecialtyGroup(specialty.id);
    
    this.generateCalendar();
  }

  // --- Step 2: Date ---
  generateCalendar() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    this.calendarDays = [];
    
    // Buscar profissionais da especialidade
    this.usersService.getUsers({ role: 'PROFESSIONAL', specialtyId: this.selectedSpecialty?.id }, 1, 100).subscribe({
      next: (response) => {
        const professionals = response.data;
        
        if (professionals.length === 0) {
          // Se não há profissionais, marcar todos os dias como indisponíveis
          for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            this.calendarDays.push({
              date: date,
              slots: 0,
              professionalsCount: 0,
              available: false
            });
          }
          this.cdr.detectChanges();
          return;
        }

        // Para cada dia do mês, verificar bloqueios de todos os profissionais
        const dayChecks: Observable<{ date: Date, availableProfessionals: number }>[] = [];
        
        for (let i = 1; i <= daysInMonth; i++) {
          const date = new Date(year, month, i);
          
          if (date < today) {
            // Dias passados são indisponíveis
            this.calendarDays.push({
              date: date,
              slots: 0,
              professionalsCount: 0,
              available: false
            });
            continue;
          }
          
          // Verificar bloqueios para cada profissional neste dia
          const blockChecks = professionals.map(pro => 
            this.scheduleBlocksService.isDateBlocked(pro.id, date)
          );
          
          dayChecks.push(
            new Observable((observer: Observer<{ date: Date, availableProfessionals: number }>) => {
              forkJoin(blockChecks).subscribe({
                next: (blockedStates) => {
                  const availableCount = blockedStates.filter(blocked => !blocked).length;
                  observer.next({ date, availableProfessionals: availableCount });
                  observer.complete();
                },
                error: () => {
                  // Em caso de erro, assumir que o dia está disponível
                  observer.next({ date, availableProfessionals: professionals.length });
                  observer.complete();
                }
              });
            })
          );
        }
        
        // Processar todos os dias
        if (dayChecks.length > 0) {
          forkJoin(dayChecks).subscribe({
            next: (results) => {
              results.forEach(result => {
                this.calendarDays.push({
                  date: result.date,
                  slots: result.availableProfessionals > 0 ? Math.floor(Math.random() * 5) + 1 : 0,
                  professionalsCount: result.availableProfessionals,
                  available: result.availableProfessionals > 0
                });
              });
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Erro ao verificar bloqueios:', err);
              this.cdr.detectChanges();
            }
          });
        } else {
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Erro ao buscar profissionais:', err);
        // Em caso de erro, gerar calendário básico
        for (let i = 1; i <= daysInMonth; i++) {
          const date = new Date(year, month, i);
          this.calendarDays.push({
            date: date,
            slots: date >= today ? 1 : 0,
            professionalsCount: date >= today ? 1 : 0,
            available: date >= today
          });
        }
        this.cdr.detectChanges();
      }
    });
  }

  changeMonth(delta: number) {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + delta, 1);
    this.generateCalendar();
  }

  selectDate(day: DayAvailability) {
    if (!day.available) return;
    this.selectedDate = day.date;
    this.loadTimeSlots();
    this.currentStep = 'time';
  }

  // --- Step 3: Time & Professional ---
  loadTimeSlots() {
    if (!this.selectedDate || !this.selectedSpecialty) return;

    this.loading = true;
    
    // Buscar profissionais da especialidade
    this.usersService.getUsers({ 
      role: 'PROFESSIONAL', 
      specialtyId: this.selectedSpecialty.id,
      status: 'Active'
    }, 1, 100).subscribe({
      next: (response) => {
        const professionals = response.data;
        
        if (professionals.length === 0) {
          this.availableSlots = [];
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        // Buscar disponibilidade de cada profissional para a data selecionada
        const availabilityChecks = professionals.map(pro => 
          this.schedulesService.getAvailability(
            pro.id,
            this.selectedDate!,
            this.selectedDate!
          )
        );

        forkJoin(availabilityChecks).subscribe({
          next: (availabilities) => {
            // Mapear horários disponíveis por profissional
            const timeSlotMap = new Map<string, User[]>();

            availabilities.forEach((availability, index) => {
              const professional = professionals[index];
              
              if (availability.slots && availability.slots.length > 0) {
                availability.slots.forEach(slot => {
                  // Apenas adicionar slots disponíveis
                  if (slot.isAvailable) {
                    const time = slot.time;
                    if (!timeSlotMap.has(time)) {
                      timeSlotMap.set(time, []);
                    }
                    timeSlotMap.get(time)!.push(professional);
                  }
                });
              }
            });

            // Converter mapa em array de TimeSlot ordenado
            this.availableSlots = Array.from(timeSlotMap.entries())
              .map(([time, profs]) => ({ time, professionals: profs }))
              .sort((a, b) => a.time.localeCompare(b.time));

            this.loading = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Erro ao buscar disponibilidade:', err);
            this.availableSlots = [];
            this.loading = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        console.error('Erro ao buscar profissionais:', err);
        this.availableSlots = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectSlot(slot: TimeSlot) {
    this.selectedSlot = slot;
    
    // Reservar o slot imediatamente quando o usuário clica nele
    if (this.selectedDate && this.selectedSpecialty) {
      this.reserveSlotImmediately(slot);
    }
    
    if (slot.professionals.length === 1) {
      this.selectedProfessional = slot.professionals[0];
      this.currentStep = 'confirmation';
    } else {
      this.currentStep = 'professional-selection';
    }
  }

  /**
   * Reserva um slot temporariamente assim que o usuário clica nele
   */
  private reserveSlotImmediately(slot: TimeSlot): void {
    if (!slot || !this.selectedDate || !this.selectedSpecialty) {
      return;
    }

    const professional = slot.professionals[0];

    const reservationRequest = {
      professionalId: professional.id,
      specialtyId: this.selectedSpecialty.id,
      date: this.selectedDate.toISOString(),
      time: slot.time
    };

    // Marcar a reserva pendente ANTES de fazer a chamada HTTP
    this.pendingReservation = {
      professionalId: professional.id,
      time: slot.time
    };

    this.slotReservationService.reserveSlot(reservationRequest).subscribe({
      next: (reservation) => {
        console.log('[Reserva] Slot reservado:', reservation);
        this.pendingReservation = null;
        this.slotReservationService.setCurrentReservation(reservation);
        this.timeRemainingSeconds = this.slotReservationService.getTimeRemainingSeconds();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('[Reserva] Erro ao reservar slot:', err);
        this.pendingReservation = null;
        if (err.status === 409) {
          this.modalService.alert({
            title: 'Slot Indisponível',
            message: 'Este horário foi reservado por outro usuário. Por favor, escolha outro horário.',
            variant: 'warning'
          }).subscribe(() => {
            this.selectedSlot = null;
            this.selectedProfessional = null;
            this.currentStep = 'time';
            this.loadTimeSlots();
          });
        }
      }
    });
  }

  selectProfessional(professional: User) {
    this.selectedProfessional = professional;
    this.currentStep = 'confirmation';
  }

  // --- Step 4: Confirmation ---
  confirmScheduling() {
    if (!this.appointment || !this.selectedSpecialty || !this.selectedDate || !this.selectedSlot || !this.selectedProfessional) {
      console.error('Dados incompletos para criar encaminhamento');
      return;
    }

    this.loading = true;
    this.isCreatingAppointment = true;

    const appointmentData: CreateAppointmentDto = {
      patientId: this.appointment.patientId,
      professionalId: this.selectedProfessional.id,
      specialtyId: this.selectedSpecialty.id,
      date: this.selectedDate.toISOString(),
      time: this.selectedSlot.time,
      type: 'Referral',
      observation: this.observation 
        ? `Encaminhamento da consulta de ${this.formatDate(this.appointment.date)} (${this.appointment.specialtyName}). ${this.observation}` 
        : `Encaminhamento da consulta de ${this.formatDate(this.appointment.date)} (${this.appointment.specialtyName})`
    };

    this.appointmentsService.createAppointment(appointmentData).subscribe({
      next: (appointment) => {
        this.loading = false;
        this.scheduledAppointment = appointment;
        this.referralScheduled = true;
        this.cdr.detectChanges();
        
        this.modalService.alert({
          title: 'Sucesso!',
          message: 'Encaminhamento agendado com sucesso.',
          variant: 'success'
        }).subscribe();
      },
      error: (err) => {
        console.error('Erro ao criar encaminhamento:', err);
        this.loading = false;
        this.modalService.alert({
          title: 'Erro',
          message: 'Erro ao agendar encaminhamento. Por favor, tente novamente.',
          variant: 'danger'
        }).subscribe();
      }
    });
  }

  goToStep(step: Step) {
    const stepOrder: Step[] = ['specialty', 'date', 'time', 'professional-selection', 'confirmation'];
    const currentIndex = stepOrder.indexOf(this.currentStep);
    const targetIndex = stepOrder.indexOf(step);

    if (targetIndex !== -1 && targetIndex < currentIndex) {
      this.currentStep = step;
      this.resetSelectionsFrom(step);
    }
  }

  resetSelectionsFrom(step: Step) {
    if (step === 'specialty') {
      this.selectedSpecialty = null;
      this.selectedDate = null;
      this.selectedSlot = null;
      this.selectedProfessional = null;
    } else if (step === 'date') {
      this.selectedDate = null;
      this.selectedSlot = null;
      this.selectedProfessional = null;
    } else if (step === 'time') {
      this.selectedSlot = null;
      this.selectedProfessional = null;
    } else if (step === 'professional-selection') {
      this.selectedProfessional = null;
    }
  }

  goBack() {
    if (this.currentStep === 'confirmation') {
      // If we came from professional selection (because >1 pro), go back there
      // If we came from time slot (because 1 pro), go back to time slot
      if (this.selectedSlot && this.selectedSlot.professionals.length > 1) {
        this.currentStep = 'professional-selection';
      } else {
        this.currentStep = 'time';
        this.selectedProfessional = null;
      }
    } else if (this.currentStep === 'professional-selection') {
      this.currentStep = 'time';
      this.selectedProfessional = null;
      this.selectedSlot = null;
    } else if (this.currentStep === 'time') {
      this.currentStep = 'date';
      this.selectedDate = null;
      this.selectedSlot = null;
    } else if (this.currentStep === 'date') {
      this.currentStep = 'specialty';
      this.selectedSpecialty = null;
    }
  }

  scheduleAnother() {
    this.referralScheduled = false;
    this.scheduledAppointment = null;
    this.resetAll();
  }

  resetAll() {
    this.currentStep = 'specialty';
    this.selectedSpecialty = null;
    this.selectedDate = null;
    this.selectedSlot = null;
    this.selectedProfessional = null;
    this.observation = '';
    this.searchQuery = '';
    this.filteredSpecialties = this.specialties;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  }
}
