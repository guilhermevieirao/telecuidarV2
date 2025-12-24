import { Component, Input, afterNextRender, inject, ChangeDetectorRef, LOCALE_ID, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { SchedulesService } from '@core/services/schedules.service';
import { ScheduleBlocksService } from '@core/services/schedule-blocks.service';
import { AppointmentsService, Appointment, CreateAppointmentDto } from '@core/services/appointments.service';
import { ModalService } from '@core/services/modal.service';
import { SchedulingSignalRService, SlotUpdateNotification, DayUpdateNotification } from '@core/services/scheduling-signalr.service';
import { forkJoin, Observable, Observer, Subscription } from 'rxjs';
import localePt from '@angular/common/locales/pt';

registerLocaleData(localePt);

type Step = 'date' | 'time' | 'confirmation';

interface DayAvailability {
  date: Date;
  slots: number;
  available: boolean;
}

interface TimeSlot {
  time: string;
  isAvailable: boolean;
}

@Component({
  selector: 'app-return-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonComponent,
    IconComponent
  ],
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' }
  ],
  templateUrl: './return-tab.html',
  styleUrls: ['./return-tab.scss']
})
export class ReturnTabComponent implements OnDestroy, OnChanges {
  @Input() appointmentId: string | null = null;
  @Input() appointment: Appointment | null = null;
  @Input() userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PROFESSIONAL';

  currentStep: Step = 'date';
  
  steps: { id: Step, label: string }[] = [
    { id: 'date', label: 'Data' },
    { id: 'time', label: 'HorÃ¡rio' },
    { id: 'confirmation', label: 'ConfirmaÃ§Ã£o' }
  ];

  weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'SÃ¡b'];

  // Step 1: Date Selection
  currentMonth: Date = new Date();
  calendarDays: DayAvailability[] = [];
  selectedDate: Date | null = null;

  // Step 2: Time Selection
  availableSlots: TimeSlot[] = [];
  selectedSlot: TimeSlot | null = null;
  
  // Step 3: Confirmation
  observation: string = '';
  loading: boolean = false;
  
  // Success state
  returnScheduled: boolean = false;
  scheduledAppointment: Appointment | null = null;

  // SignalR subscriptions
  private signalRSubscriptions: Subscription[] = [];
  private currentProfessionalGroup: string | null = null;

  private schedulesService = inject(SchedulesService);
  private scheduleBlocksService = inject(ScheduleBlocksService);
  private appointmentsService = inject(AppointmentsService);
  private modalService = inject(ModalService);
  private schedulingSignalR = inject(SchedulingSignalRService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    afterNextRender(() => {
      this.initializeSignalR();
      this.generateCalendar();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When appointment changes, update the SignalR group
    if (changes['appointment'] && this.appointment) {
      this.updateSignalRGroup();
    }
  }

  ngOnDestroy(): void {
    // Clean up SignalR subscriptions and connection
    this.signalRSubscriptions.forEach(sub => sub.unsubscribe());
    if (this.currentProfessionalGroup) {
      this.schedulingSignalR.leaveProfessionalGroup(this.currentProfessionalGroup);
    }
    this.schedulingSignalR.disconnect();
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

    // Join professional group if appointment is available
    this.updateSignalRGroup();
  }

  private updateSignalRGroup(): void {
    if (this.appointment) {
      // Leave previous group if any
      if (this.currentProfessionalGroup && this.currentProfessionalGroup !== this.appointment.professionalId) {
        this.schedulingSignalR.leaveProfessionalGroup(this.currentProfessionalGroup);
      }
      
      // Join new professional group
      this.currentProfessionalGroup = this.appointment.professionalId;
      this.schedulingSignalR.joinProfessionalGroup(this.appointment.professionalId);
    }
  }

  private handleSlotUpdate(notification: SlotUpdateNotification): void {
    // Check if this update is relevant to current professional
    if (!this.appointment || notification.professionalId !== this.appointment.professionalId) {
      return;
    }

    // Check if the update is for the currently selected date
    if (this.selectedDate) {
      const updateDate = new Date(notification.date);
      if (updateDate.toDateString() === this.selectedDate.toDateString()) {
        // Update the slot availability in real-time
        const slotIndex = this.availableSlots.findIndex(s => s.time === notification.time);
        
        if (!notification.isAvailable) {
          // Slot was taken - remove it from available slots
          if (slotIndex !== -1) {
            this.availableSlots.splice(slotIndex, 1);
            
            // If this was the selected slot, deselect it
            if (this.selectedSlot?.time === notification.time) {
              this.selectedSlot = null;
              this.modalService.alert({
                title: 'Horário indisponível',
                message: 'Este horário acabou de ser reservado. Por favor, escolha outro horário.',
                variant: 'warning'
              }).subscribe(() => {
                if (this.currentStep === 'confirmation') {
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
    // Check if this update is relevant to current professional
    if (!this.appointment || notification.professionalId !== this.appointment.professionalId) {
      return;
    }

    // Update the calendar day availability
    const updateDate = new Date(notification.date);
    const dayIndex = this.calendarDays.findIndex(d => 
      d.date.toDateString() === updateDate.toDateString()
    );
    
    if (dayIndex !== -1) {
      this.calendarDays[dayIndex].available = notification.hasAvailability;
      this.calendarDays[dayIndex].slots = notification.hasAvailability ? 
        Math.max(1, this.calendarDays[dayIndex].slots) : 0;
      this.cdr.detectChanges();
    }
  }

  getStepIndex(stepId: Step): number {
    return this.steps.findIndex(s => s.id === stepId);
  }

  // --- Step 1: Date ---
  generateCalendar() {
    if (!this.appointment) return;

    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    this.calendarDays = [];
    
    // Verificar disponibilidade apenas do profissional da consulta atual
    const professionalId = this.appointment.professionalId;

    const dayChecks: Observable<{ date: Date, isAvailable: boolean, slotsCount: number }>[] = [];
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      
      if (date <= today) {
        this.calendarDays.push({
          date: date,
          slots: 0,
          available: false
        });
        continue;
      }
      
      // Verificar se o dia estÃ¡ bloqueado para o profissional
      dayChecks.push(
        new Observable((observer: Observer<{ date: Date, isAvailable: boolean, slotsCount: number }>) => {
          this.scheduleBlocksService.isDateBlocked(professionalId, date).subscribe({
            next: (isBlocked) => {
              if (isBlocked) {
                observer.next({ date, isAvailable: false, slotsCount: 0 });
                observer.complete();
              } else {
                // Buscar disponibilidade do profissional para este dia
                this.schedulesService.getAvailability(professionalId, date, date).subscribe({
                  next: (availability) => {
                    const availableSlots = availability.slots?.filter(s => s.isAvailable) || [];
                    observer.next({ 
                      date, 
                      isAvailable: availableSlots.length > 0, 
                      slotsCount: availableSlots.length 
                    });
                    observer.complete();
                  },
                  error: () => {
                    observer.next({ date, isAvailable: false, slotsCount: 0 });
                    observer.complete();
                  }
                });
              }
            },
            error: () => {
              observer.next({ date, isAvailable: true, slotsCount: 1 });
              observer.complete();
            }
          });
        })
      );
    }
    
    if (dayChecks.length > 0) {
      forkJoin(dayChecks).subscribe({
        next: (results) => {
          results.forEach(result => {
            this.calendarDays.push({
              date: result.date,
              slots: result.slotsCount,
              available: result.isAvailable
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

  // --- Step 2: Time Selection ---
  loadTimeSlots() {
    if (!this.selectedDate || !this.appointment) return;

    this.loading = true;
    
    // Buscar disponibilidade apenas do profissional da consulta atual
    const professionalId = this.appointment.professionalId;
    
    this.schedulesService.getAvailability(
      professionalId,
      this.selectedDate,
      this.selectedDate
    ).subscribe({
      next: (availability) => {
        this.availableSlots = (availability.slots || [])
          .filter(slot => slot.isAvailable)
          .map(slot => ({
            time: slot.time,
            isAvailable: slot.isAvailable
          }))
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
  }

  selectSlot(slot: TimeSlot) {
    this.selectedSlot = slot;
    this.currentStep = 'confirmation';
  }

  // --- Step 3: Confirmation ---
  confirmScheduling() {
    if (!this.appointment || !this.selectedDate || !this.selectedSlot) {
      console.error('Dados incompletos para criar agendamento');
      return;
    }

    this.loading = true;

    const appointmentData: CreateAppointmentDto = {
      patientId: this.appointment.patientId,
      professionalId: this.appointment.professionalId, // Mesmo profissional
      specialtyId: this.appointment.specialtyId, // Mesma especialidade
      date: this.selectedDate.toISOString(),
      time: this.selectedSlot.time,
      type: 'Return',
      observation: this.observation 
        ? `Retorno da consulta de ${this.formatDate(this.appointment.date)}. ${this.observation}` 
        : `Retorno da consulta de ${this.formatDate(this.appointment.date)}`
    };

    this.appointmentsService.createAppointment(appointmentData).subscribe({
      next: (appointment) => {
        this.loading = false;
        this.scheduledAppointment = appointment;
        this.returnScheduled = true;
        this.cdr.detectChanges();
        
        this.modalService.alert({
          title: 'Sucesso!',
          message: 'Retorno agendado com sucesso.',
          variant: 'success'
        }).subscribe();
      },
      error: (err) => {
        console.error('Erro ao criar agendamento de retorno:', err);
        this.loading = false;
        this.modalService.alert({
          title: 'Erro',
          message: 'Erro ao agendar retorno. Por favor, tente novamente.',
          variant: 'danger'
        }).subscribe();
      }
    });
  }

  goToStep(step: Step) {
    const stepOrder: Step[] = ['date', 'time', 'confirmation'];
    const currentIndex = stepOrder.indexOf(this.currentStep);
    const targetIndex = stepOrder.indexOf(step);

    if (targetIndex !== -1 && targetIndex < currentIndex) {
      this.currentStep = step;
      this.resetSelectionsFrom(step);
    }
  }

  resetSelectionsFrom(step: Step) {
    if (step === 'date') {
      this.selectedDate = null;
      this.selectedSlot = null;
    } else if (step === 'time') {
      this.selectedSlot = null;
    }
  }

  goBack() {
    if (this.currentStep === 'confirmation') {
      this.currentStep = 'time';
    } else if (this.currentStep === 'time') {
      this.currentStep = 'date';
      this.selectedDate = null;
      this.selectedSlot = null;
    }
  }

  scheduleAnother() {
    this.returnScheduled = false;
    this.scheduledAppointment = null;
    this.currentStep = 'date';
    this.selectedDate = null;
    this.selectedSlot = null;
    this.observation = '';
    this.generateCalendar();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  }
}

