import { Component, afterNextRender, inject, ChangeDetectorRef, LOCALE_ID, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { AvatarComponent } from '@shared/components/atoms/avatar/avatar';
import { SearchInputComponent } from '@shared/components/atoms/search-input/search-input';
import { SpecialtiesService, Specialty } from '@core/services/specialties.service';
import { SchedulesService } from '@core/services/schedules.service';
import { UsersService, User } from '@core/services/users.service';
import { ScheduleBlocksService } from '@core/services/schedule-blocks.service';
import { AppointmentsService } from '@core/services/appointments.service';
import { AuthService } from '@core/services/auth.service';
import { ModalService } from '@core/services/modal.service';
import { SlotReservationService } from '@core/services/slot-reservation.service';
import { SchedulingSignalRService, SlotUpdateNotification, DayUpdateNotification, SpecialtyAvailabilityNotification, SlotProfessionalsUpdateNotification } from '@core/services/scheduling-signalr.service';
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
  selector: 'app-scheduling',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonComponent,
    IconComponent,
    AvatarComponent,
    SearchInputComponent
  ],
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' }
  ],
  templateUrl: './scheduling.html',
  styleUrls: ['./scheduling.scss']
})
export class SchedulingComponent implements OnDestroy {
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
  timeRemainingSeconds: number = 0; // Tempo restante da reserva

  // SignalR subscriptions
  private signalRSubscriptions: Subscription[] = [];
  private currentSpecialtyGroup: string | null = null;
  private isCreatingAppointment: boolean = false; // Flag para ignorar notificações durante criação
  private pendingReservation: { professionalId: string; time: string } | null = null; // Slot sendo reservado

  private specialtiesService = inject(SpecialtiesService);
  private schedulesService = inject(SchedulesService);
  private usersService = inject(UsersService);
  private scheduleBlocksService = inject(ScheduleBlocksService);
  private appointmentsService = inject(AppointmentsService);
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  private slotReservationService = inject(SlotReservationService);
  private schedulingSignalR = inject(SchedulingSignalRService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    afterNextRender(() => {
      this.loadSpecialties();
      this.initializeSignalR();
      
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

  ngOnDestroy(): void {
    // Liberar reserva ao sair do componente
    this.releaseCurrentReservation();

    // Limpar pendingReservation
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
      // Usar fetch com keepalive para garantir que a requisição seja enviada mesmo ao fechar a aba
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
  }

  private handleSlotUpdate(notification: SlotUpdateNotification): void {
    // Check if this update is relevant to current view
    if (!this.selectedSpecialty || notification.specialtyId !== this.selectedSpecialty.id) {
      return;
    }

    // Only ignore notifications during the final appointment creation (HTTP POST)
    // Should NOT ignore during slot selection
    if (this.isCreatingAppointment && this.currentStep === 'confirmation') {
      console.log('[SignalR] Ignorando notificação - finalizando agendamento');
      return;
    }

    // Check if this is our own reservation (pending or confirmed) - if so, ignore the notification
    const currentReservation = this.slotReservationService.getCurrentReservation();
    const isPendingReservation = this.pendingReservation &&
        this.pendingReservation.professionalId === notification.professionalId &&
        this.pendingReservation.time === notification.time;
    const isCurrentReservation = currentReservation && 
        currentReservation.professionalId === notification.professionalId &&
        currentReservation.time === notification.time;
    
    if ((isPendingReservation || isCurrentReservation) && !notification.isAvailable) {
      console.log('[SignalR] Ignorando notificação - é nossa própria reserva (pendente ou confirmada)');
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
    // Check if this update is relevant to current view
    if (!this.selectedSpecialty || notification.specialtyId !== this.selectedSpecialty.id) {
      return;
    }

    console.log('[SignalR] Dia atualizado:', notification);

    // Update the calendar day availability using slotsDelta
    const updateDate = new Date(notification.date);
    const dayIndex = this.calendarDays.findIndex(d => 
      d.date.toDateString() === updateDate.toDateString()
    );
    
    if (dayIndex !== -1) {
      // Aplicar o delta ao número de slots
      const newSlots = Math.max(0, this.calendarDays[dayIndex].slots + notification.slotsDelta);
      this.calendarDays[dayIndex].slots = newSlots;
      this.calendarDays[dayIndex].available = newSlots > 0;
      
      console.log(`[SignalR] Dia ${updateDate.toLocaleDateString()}: slots ${this.calendarDays[dayIndex].slots - notification.slotsDelta} -> ${newSlots}`);
      
      this.cdr.detectChanges();
    }
  }

  private handleSpecialtyAvailabilityUpdate(notification: SpecialtyAvailabilityNotification): void {
    console.log('[SignalR] Disponibilidade de especialidade atualizada:', notification);

    // Encontrar a especialidade na lista
    const specialtyIndex = this.specialties.findIndex(s => s.id === notification.specialtyId);
    
    if (specialtyIndex !== -1) {
      if (!notification.hasAvailability) {
        // Especialidade ficou sem vagas - remover da lista
        console.log(`[SignalR] Especialidade ${this.specialties[specialtyIndex].name} ficou sem vagas - removendo da lista`);
        this.specialties = this.specialties.filter(s => s.id !== notification.specialtyId);
        this.filteredSpecialties = this.filteredSpecialties.filter(s => s.id !== notification.specialtyId);
        
        // Se a especialidade selecionada ficou sem vagas, avisar o usuário
        if (this.selectedSpecialty?.id === notification.specialtyId) {
          this.modalService.alert({
            title: 'Especialidade indisponível',
            message: 'Esta especialidade não possui mais vagas disponíveis. Por favor, escolha outra especialidade.',
            variant: 'warning'
          }).subscribe(() => {
            this.selectedSpecialty = null;
            this.currentStep = 'specialty';
          });
        }
      }
      this.cdr.detectChanges();
    } else if (notification.hasAvailability) {
      // Especialidade voltou a ter vagas - recarregar lista
      console.log(`[SignalR] Especialidade ${notification.specialtyId} voltou a ter vagas - recarregando lista`);
      this.loadSpecialties();
    }
  }

  private handleSlotProfessionalsUpdate(notification: SlotProfessionalsUpdateNotification): void {
    // Check if this update is relevant to current view
    if (!this.selectedSpecialty || notification.specialtyId !== this.selectedSpecialty.id) {
      return;
    }

    // Ignorar se é nossa própria reserva
    const currentReservation = this.slotReservationService.getCurrentReservation();
    const isPendingReservation = this.pendingReservation &&
        this.pendingReservation.professionalId === notification.professionalId &&
        this.pendingReservation.time === notification.time;
    const isCurrentReservation = currentReservation && 
        currentReservation.professionalId === notification.professionalId &&
        currentReservation.time === notification.time;
    
    if ((isPendingReservation || isCurrentReservation) && !notification.isAvailable) {
      console.log('[SignalR] Ignorando atualização de profissionais - é nossa própria reserva');
      return;
    }

    console.log('[SignalR] Profissionais do slot atualizados:', notification);

    // Check if the update is for the currently selected date
    if (this.selectedDate) {
      const updateDate = new Date(notification.date);
      if (updateDate.toDateString() === this.selectedDate.toDateString()) {
        // Encontrar o slot
        const slotIndex = this.availableSlots.findIndex(s => s.time === notification.time);
        
        if (slotIndex !== -1) {
          const slot = this.availableSlots[slotIndex];
          
          if (!notification.isAvailable) {
            // Remover o profissional do slot
            slot.professionals = slot.professionals.filter(p => p.id !== notification.professionalId);
            
            // Se não há mais profissionais, remover o slot
            if (slot.professionals.length === 0) {
              this.availableSlots.splice(slotIndex, 1);
            }
            
            console.log(`[SignalR] Slot ${notification.time}: profissional ${notification.professionalId} removido`);
          } else {
            // Profissional voltou a estar disponível - recarregar slots
            console.log(`[SignalR] Slot ${notification.time}: profissional ${notification.professionalId} disponível - recarregando`);
            this.loadTimeSlots();
          }
          
          this.cdr.detectChanges();
        } else if (notification.isAvailable) {
          // Slot não existia mas agora tem profissional disponível - recarregar
          console.log(`[SignalR] Novo slot disponível ${notification.time} - recarregando`);
          this.loadTimeSlots();
        }
      }
    }

    // Se estamos na etapa de seleção de profissional, atualizar a lista
    if (this.currentStep === 'professional-selection' && this.selectedSlot?.time === notification.time) {
      if (!notification.isAvailable) {
        // Remover profissional da lista
        this.selectedSlot.professionals = this.selectedSlot.professionals.filter(
          p => p.id !== notification.professionalId
        );
        
        // Se o profissional selecionado ficou indisponível
        if (this.selectedProfessional?.id === notification.professionalId) {
          this.modalService.alert({
            title: 'Profissional indisponível',
            message: 'Este profissional acabou de ficar indisponível. Por favor, escolha outro profissional.',
            variant: 'warning'
          }).subscribe(() => {
            this.selectedProfessional = null;
            if (this.selectedSlot && this.selectedSlot.professionals.length === 0) {
              this.selectedSlot = null;
              this.currentStep = 'time';
              this.loadTimeSlots();
            }
          });
        }
        
        // Se não há mais profissionais no slot, voltar
        if (this.selectedSlot.professionals.length === 0) {
          this.selectedSlot = null;
          this.currentStep = 'time';
          this.loadTimeSlots();
        }
        
        this.cdr.detectChanges();
      } else {
        // Profissional voltou - recarregar
        this.loadTimeSlots();
      }
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

        // Para cada dia do mês, verificar disponibilidade real de todos os profissionais
        const dayChecks: Observable<{ date: Date, availableProfessionals: number, totalSlots: number }>[] = [];
        
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
          
          // Buscar disponibilidade real de cada profissional para este dia
          const availabilityChecks = professionals.map(pro => 
            this.schedulesService.getAvailability(pro.id, date, date)
          );
          
          dayChecks.push(
            new Observable((observer: Observer<{ date: Date, availableProfessionals: number, totalSlots: number }>) => {
              forkJoin(availabilityChecks).subscribe({
                next: (availabilities) => {
                  let totalAvailableSlots = 0;
                  let availableProfessionalsCount = 0;
                  
                  // Contar slots disponíveis de todos os profissionais
                  availabilities.forEach(availability => {
                    if (availability.slots && availability.slots.length > 0) {
                      const availableSlots = availability.slots.filter(slot => slot.isAvailable);
                      if (availableSlots.length > 0) {
                        totalAvailableSlots += availableSlots.length;
                        availableProfessionalsCount++;
                      }
                    }
                  });
                  
                  observer.next({ 
                    date, 
                    availableProfessionals: availableProfessionalsCount,
                    totalSlots: totalAvailableSlots 
                  });
                  observer.complete();
                },
                error: () => {
                  // Em caso de erro, assumir que não há disponibilidade
                  observer.next({ date, availableProfessionals: 0, totalSlots: 0 });
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
                  slots: result.totalSlots,
                  professionalsCount: result.availableProfessionals,
                  available: result.totalSlots > 0
                });
              });
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Erro ao verificar disponibilidade:', err);
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
              
              // A resposta da API tem a estrutura: { professionalId, professionalName, slots: [] }
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

  selectProfessional(professional: User) {
    this.selectedProfessional = professional;
    // A reserva já foi feita em selectSlot, apenas avançamos para confirmação
    this.currentStep = 'confirmation';
  }

  /**
   * Reserva um slot temporariamente assim que o usuário clica nele
   */
  private reserveSlotImmediately(slot: TimeSlot) {
    if (!slot || !this.selectedDate || !this.selectedSpecialty) {
      return;
    }

    // Usar o primeiro profissional disponível para a reserva
    // A escolha específica será feita depois
    const professional = slot.professionals[0];

    const reservationRequest = {
      professionalId: professional.id,
      specialtyId: this.selectedSpecialty.id,
      date: this.selectedDate.toISOString(),
      time: slot.time
    };

    console.log('[Reserva] Tentando reservar com dados:', reservationRequest);
    console.log('[Reserva] Token no localStorage:', localStorage.getItem('access_token')?.substring(0, 30) + '...');
    console.log('[Reserva] Token no sessionStorage:', sessionStorage.getItem('access_token')?.substring(0, 30) + '...');

    // Marcar a reserva pendente ANTES de fazer a chamada HTTP
    // Isso evita que o SignalR mostre o modal antes da resposta chegar
    this.pendingReservation = {
      professionalId: professional.id,
      time: slot.time
    };

    this.slotReservationService.reserveSlot(reservationRequest).subscribe({
      next: (reservation) => {
        console.log('[Reserva] Slot reservado imediatamente:', reservation);
        this.pendingReservation = null; // Limpar pendência
        this.slotReservationService.setCurrentReservation(reservation);
        this.timeRemainingSeconds = this.slotReservationService.getTimeRemainingSeconds();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[Reserva] Erro ao reservar slot:', err);
        console.error('[Reserva] Status:', err.status, '| Message:', err.message);
        this.pendingReservation = null; // Limpar pendência em caso de erro
        if (err.status === 409) {
          this.modalService.alert({
            title: 'Slot Indisponível',
            message: 'Este horário foi reservado por outro paciente. Por favor, escolha outro horário.',
            variant: 'warning'
          }).subscribe(() => {
            // Voltar ao seletor de horários e recarregar
            this.selectedSlot = null;
            this.selectedProfessional = null;
            this.currentStep = 'time';
            this.loadTimeSlots();
          });
        }
      }
    });
  }

  /**
   * Chamado quando a reserva expira
   */
  private handleReservationExpired() {
    console.log('[Reserva] Reserva expirou!');
    this.slotReservationService.clearCurrentReservation();
    
    // Se ainda estamos no passo de confirmação, voltar
    if (this.currentStep === 'confirmation') {
      this.modalService.alert({
        title: 'Reserva Expirada',
        message: 'Sua reserva expirou. Por favor, selecione um novo horário.',
        variant: 'warning'
      }).subscribe(() => {
        this.selectedSlot = null;
        this.selectedProfessional = null;
        this.currentStep = 'time';
      });
    }
  }

  // --- Step 4: Confirmation ---
  confirmScheduling() {
    if (!this.selectedSpecialty || !this.selectedDate || !this.selectedSlot || !this.selectedProfessional) {
      console.error('Dados incompletos para criar agendamento');
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      console.error('Usuário não autenticado');
      this.router.navigate(['/entrar']);
      return;
    }

    this.loading = true;
    this.isCreatingAppointment = true; // Marcar que estamos criando agendamento

    const appointmentData = {
      patientId: currentUser.id,
      professionalId: this.selectedProfessional.id,
      specialtyId: this.selectedSpecialty.id,
      date: this.selectedDate.toISOString(),
      time: this.selectedSlot.time,
      type: 'Common' as const,
      observation: this.observation || undefined
    };

    this.appointmentsService.createAppointment(appointmentData).subscribe({
      next: (appointment) => {
        this.loading = false;
        this.isCreatingAppointment = false;
        this.router.navigate(['/agendamento-sucesso'], { 
          state: { 
            appointment: {
              id: appointment.id,
              specialty: this.selectedSpecialty,
              date: this.selectedDate,
              time: this.selectedSlot?.time,
              professional: this.selectedProfessional,
              observation: this.observation
            }
          }
        });
      },
      error: (err) => {
        console.error('Erro ao criar agendamento:', err);
        this.loading = false;
        this.isCreatingAppointment = false;
        this.modalService.alert({
          title: 'Erro',
          message: 'Erro ao criar agendamento. Por favor, tente novamente.',
          variant: 'danger'
        }).subscribe();
      }
    });
  }

  goToStep(step: Step) {
    const stepOrder: Step[] = ['specialty', 'date', 'time', 'professional-selection', 'confirmation'];
    const currentIndex = stepOrder.indexOf(this.currentStep);
    const targetIndex = stepOrder.indexOf(step);

    // Can only navigate backwards or to the immediate next step if data is selected
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
        // If we came from professional selection (because >1 pro), go back there.
        // If we came from time slot (because 1 pro), go back to time slot.
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
        // Liberar reserva ao voltar de seleção de profissional
        this.releaseReservation();
    } else if (this.currentStep === 'time') {
        this.currentStep = 'date';
        this.selectedDate = null;
        this.selectedSlot = null;
        // Liberar reserva ao voltar de seleção de horário
        this.releaseReservation();
    } else if (this.currentStep === 'date') {
        this.currentStep = 'specialty';
        this.selectedSpecialty = null;
    }
  }

  /**
   * Libera a reserva atual
   */
  private releaseReservation() {
    const reservation = this.slotReservationService.getCurrentReservation();
    if (reservation) {
      console.log('[Reserva] Liberando reserva:', reservation);
      this.slotReservationService.releaseReservation(reservation.id).subscribe({
        next: () => {
          console.log('[Reserva] Reserva liberada com sucesso');
          this.slotReservationService.clearCurrentReservation();
          this.timeRemainingSeconds = 0;
          this.loadTimeSlots(); // Recarregar horários disponíveis
        },
        error: (err) => {
          console.error('[Reserva] Erro ao liberar reserva:', err);
        }
      });
    }
  }
}
