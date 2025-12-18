import { Component, Input, Output, EventEmitter, OnInit, inject, afterNextRender, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { SchedulesService, Schedule, DayOfWeek, ScheduleGlobalConfig, DayConfig } from '@app/core/services/schedules.service';
import { UsersService, User } from '@app/core/services/users.service';
import { ModalService } from '@app/core/services/modal.service';

@Component({
  selector: 'app-schedule-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IconComponent, ButtonComponent],
  templateUrl: './schedule-create-modal.html',
  styleUrl: './schedule-create-modal.scss'
})
export class ScheduleCreateModalComponent implements OnInit {
  @Input() isOpen = false;
  @Input() editingSchedule: Schedule | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Schedule>();

  form!: FormGroup;
  professionals: User[] = [];
  days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  dayLabels: Record<DayOfWeek, string> = {
    'Monday': 'Segunda-feira',
    'Tuesday': 'Terça-feira',
    'Wednesday': 'Quarta-feira',
    'Thursday': 'Quinta-feira',
    'Friday': 'Sexta-feira',
    'Saturday': 'Sábado',
    'Sunday': 'Domingo'
  };

  private _isLoading = false;
  private _isSaving = false;
  currentStep: 'PROFESSIONAL' | 'global' | 'daily' | 'validity' = 'PROFESSIONAL';
  expandedDays: Set<DayOfWeek> = new Set();
  customDays: Set<DayOfWeek> = new Set();
  hasBreakTime = false;
  hasEndDate = false;

  private cdr = inject(ChangeDetectorRef);

  get isLoading(): boolean {
    return this._isLoading;
  }

  set isLoading(value: boolean) {
    this._isLoading = value;
    this.updateFormDisabledState();
  }

  get isSaving(): boolean {
    return this._isSaving;
  }

  set isSaving(value: boolean) {
    this._isSaving = value;
    this.updateFormDisabledState();
  }

  constructor(
    private fb: FormBuilder,
    private schedulesService: SchedulesService,
    private usersService: UsersService,
    private modalService: ModalService
  ) {
    this.initForm();
    afterNextRender(() => {
      this.loadProfessionals();
    });
  }

  ngOnInit(): void {
  }

  ngOnChanges(): void {
    if (this.isOpen) {
      if (this.editingSchedule) {
        this.populateForm();
        this.currentStep = 'PROFESSIONAL';
      } else {
        this.resetForm();
      }
    }
  }

  initForm(): void {
    this.form = this.fb.group({
      // Professional selection
      professionalId: ['', Validators.required],

      // Global configuration
      globalStartTime: ['08:00', Validators.required],
      globalEndTime: ['17:00', Validators.required],
      globalHasBreak: [false],
      globalBreakStartTime: ['12:00'],
      globalBreakEndTime: ['13:00'],
      globalConsultationDuration: [30, [Validators.required, Validators.min(1)]],
      globalIntervalBetweenConsultations: [5, [Validators.required, Validators.min(0)]],

      // Daily configurations (will be added dynamically)
      // Validity
      validityStartDate: [this.getTodayDate(), Validators.required],
      hasEndDate: [false],
      validityEndDate: [''],
      isActive: [true]
    });

    // Add day-specific controls
    this.days.forEach(day => {
      this.form.addControl(`${day}_isWorking`, new FormControl(true));
      this.form.addControl(`${day}_startTime`, new FormControl('08:00'));
      this.form.addControl(`${day}_endTime`, new FormControl('17:00'));
      this.form.addControl(`${day}_hasBreak`, new FormControl(false));
      this.form.addControl(`${day}_breakStartTime`, new FormControl('12:00'));
      this.form.addControl(`${day}_breakEndTime`, new FormControl('13:00'));
      this.form.addControl(`${day}_consultationDuration`, new FormControl(30));
      this.form.addControl(`${day}_intervalBetweenConsultations`, new FormControl(5));
      this.form.addControl(`${day}_isCustomized`, new FormControl(false));
    });
  }

  populateForm(): void {
    if (!this.editingSchedule) return;

    this.form.patchValue({
      professionalId: this.editingSchedule.professionalId,
      globalStartTime: this.editingSchedule.globalConfig.timeRange.startTime,
      globalEndTime: this.editingSchedule.globalConfig.timeRange.endTime,
      globalConsultationDuration: this.editingSchedule.globalConfig.consultationDuration,
      globalIntervalBetweenConsultations: this.editingSchedule.globalConfig.intervalBetweenConsultations,
      validityStartDate: this.editingSchedule.validityStartDate,
      validityEndDate: this.editingSchedule.validityEndDate || '',
      isActive: this.editingSchedule.status === 'Active'
    });

    if (this.editingSchedule.globalConfig.breakTime) {
      this.form.patchValue({
        globalBreakStartTime: this.editingSchedule.globalConfig.breakTime.startTime,
        globalBreakEndTime: this.editingSchedule.globalConfig.breakTime.endTime
      });
    }

    // Populate day-specific configurations
    this.editingSchedule.daysConfig.forEach(dayConfig => {
      this.form.patchValue({
        [`${dayConfig.day}_isWorking`]: dayConfig.isWorking,
        [`${dayConfig.day}_startTime`]: dayConfig.timeRange?.startTime || '08:00',
        [`${dayConfig.day}_endTime`]: dayConfig.timeRange?.endTime || '17:00',
        [`${dayConfig.day}_breakStartTime`]: dayConfig.breakTime?.startTime || '12:00',
        [`${dayConfig.day}_breakEndTime`]: dayConfig.breakTime?.endTime || '13:00',
        [`${dayConfig.day}_consultationDuration`]: dayConfig.consultationDuration || 30,
        [`${dayConfig.day}_intervalBetweenConsultations`]: dayConfig.intervalBetweenConsultations || 5,
        [`${dayConfig.day}_isCustomized`]: dayConfig.customized || false
      });

      if (dayConfig.customized) {
        this.customDays.add(dayConfig.day);
      }
    });
  }

  loadProfessionals(): void {
    this.isLoading = true;
    this.usersService.getUsers({}).subscribe({
      next: (response) => {
        this.professionals = response.data.filter(u => u.role === 'PROFESSIONAL');
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erro ao carregar profissionais:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
        this.modalService.alert({
          title: 'Erro',
          message: 'Não foi possível carregar os profissionais.',
          variant: 'danger'
        });
      }
    });
  }

  onClose(): void {
    this.resetForm();
    this.close.emit();
  }

  resetForm(): void {
    // Resetar para valores iniciais
    this.form.reset({
      professionalId: '',
      globalStartTime: '08:00',
      globalEndTime: '17:00',
      globalHasBreak: false,
      globalBreakStartTime: '12:00',
      globalBreakEndTime: '13:00',
      globalConsultationDuration: 30,
      globalIntervalBetweenConsultations: 5,
      validityStartDate: this.getTodayDate(),
      hasEndDate: false,
      validityEndDate: '',
      isActive: true
    });

    // Resetar controles dos dias
    this.days.forEach(day => {
      this.form.patchValue({
        [`${day}_isWorking`]: true,
        [`${day}_startTime`]: '08:00',
        [`${day}_endTime`]: '17:00',
        [`${day}_hasBreak`]: false,
        [`${day}_breakStartTime`]: '12:00',
        [`${day}_breakEndTime`]: '13:00',
        [`${day}_consultationDuration`]: 30,
        [`${day}_intervalBetweenConsultations`]: 5,
        [`${day}_isCustomized`]: false
      });
    });

    // Resetar estado do componente
    this.currentStep = 'PROFESSIONAL';
    this.expandedDays.clear();
    this.customDays.clear();
    this.hasBreakTime = false;
    this.hasEndDate = false;
    this.editingSchedule = null;
  }

  nextStep(): void {
    switch (this.currentStep) {
      case 'PROFESSIONAL':
        if (this.form.get('professionalId')?.valid) {
          this.currentStep = 'global';
        }
        break;
      case 'global':
        this.currentStep = 'daily';
        break;
      case 'daily':
        this.currentStep = 'validity';
        break;
    }
  }

  previousStep(): void {
    switch (this.currentStep) {
      case 'global':
        this.currentStep = 'PROFESSIONAL';
        break;
      case 'daily':
        this.currentStep = 'global';
        break;
      case 'validity':
        this.currentStep = 'daily';
        break;
    }
  }

  toggleDayExpanded(day: DayOfWeek): void {
    if (this.expandedDays.has(day)) {
      this.expandedDays.delete(day);
    } else {
      this.expandedDays.add(day);
    }
  }

  toggleDayCustomized(day: DayOfWeek): void {
    const isCustomized = this.form.get(`${day}_isCustomized`)?.value;
    
    if (!isCustomized) {
      // Habilitando customização
      this.customDays.add(day);
    } else {
      // Desabilitando customização - copiar valores globais
      this.customDays.delete(day);
      const globalStartTime = this.form.get('globalStartTime')?.value;
      const globalEndTime = this.form.get('globalEndTime')?.value;
      const globalConsultationDuration = this.form.get('globalConsultationDuration')?.value;
      const globalIntervalBetweenConsultations = this.form.get('globalIntervalBetweenConsultations')?.value;
      const globalHasBreak = this.form.get('globalHasBreak')?.value;
      const globalBreakStartTime = this.form.get('globalBreakStartTime')?.value;
      const globalBreakEndTime = this.form.get('globalBreakEndTime')?.value;

      this.form.patchValue({
        [`${day}_startTime`]: globalStartTime,
        [`${day}_endTime`]: globalEndTime,
        [`${day}_consultationDuration`]: globalConsultationDuration,
        [`${day}_intervalBetweenConsultations`]: globalIntervalBetweenConsultations,
        [`${day}_hasBreak`]: globalHasBreak,
        [`${day}_breakStartTime`]: globalBreakStartTime,
        [`${day}_breakEndTime`]: globalBreakEndTime
      });
    }
  }

  toggleBreakTime(): void {
    this.hasBreakTime = this.form.get('globalHasBreak')?.value || false;
    if (!this.hasBreakTime) {
      this.form.patchValue({
        globalBreakStartTime: '',
        globalBreakEndTime: ''
      });
    }
  }

  toggleEndDate(): void {
    this.hasEndDate = this.form.get('hasEndDate')?.value || false;
    if (!this.hasEndDate) {
      this.form.patchValue({
        validityEndDate: ''
      });
    }
  }

  submitForm(): void {
    if (this.form.invalid) {
      this.modalService.alert({
        title: 'Erro',
        message: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'danger'
      });
      return;
    }

    this.isSaving = true;

    const formValue = this.form.value;
    const professionalId = formValue.professionalId;
    const professional = this.professionals.find(p => p.id === professionalId);

    if (!professional) {
      this.modalService.alert({
        title: 'Erro',
        message: 'Profissional não encontrado.',
        variant: 'danger'
      });
      this.isSaving = false;
      return;
    }

    const globalConfig: ScheduleGlobalConfig = {
      timeRange: {
        startTime: formValue.globalStartTime,
        endTime: formValue.globalEndTime
      },
      breakTime: formValue.globalHasBreak && formValue.globalBreakStartTime && formValue.globalBreakEndTime ? {
        startTime: formValue.globalBreakStartTime,
        endTime: formValue.globalBreakEndTime
      } : undefined,
      consultationDuration: formValue.globalConsultationDuration,
      intervalBetweenConsultations: formValue.globalIntervalBetweenConsultations
    };

    const daysConfig: DayConfig[] = this.days.map(day => {
      const isWorking = formValue[`${day}_isWorking`];
      const isCustomized = formValue[`${day}_isCustomized`];

      const dayConfig: DayConfig = {
        day,
        isWorking,
        customized: isCustomized
      };

      if (isWorking) {
        dayConfig.timeRange = {
          startTime: formValue[`${day}_startTime`],
          endTime: formValue[`${day}_endTime`]
        };

        if (formValue[`${day}_hasBreak`] && formValue[`${day}_breakStartTime`] && formValue[`${day}_breakEndTime`]) {
          dayConfig.breakTime = {
            startTime: formValue[`${day}_breakStartTime`],
            endTime: formValue[`${day}_breakEndTime`]
          };
        }

        dayConfig.consultationDuration = formValue[`${day}_consultationDuration`];
        dayConfig.intervalBetweenConsultations = formValue[`${day}_intervalBetweenConsultations`];
      }

      return dayConfig;
    });

    const scheduleData = {
      professionalId,
      professionalName: professional.name,
      professionalEmail: professional.email,
      daysConfig,
      globalConfig,
      validityStartDate: formValue.validityStartDate,
      validityEndDate: formValue.validityEndDate || undefined,
      status: formValue.isActive ? 'Active' as const : 'Inactive' as const
    };

    if (this.editingSchedule) {
      this.schedulesService.updateSchedule(this.editingSchedule.id, scheduleData).subscribe({
        next: (schedule) => {
          this.isSaving = false;
          setTimeout(() => {
            this.save.emit(schedule);
          });
        },
        error: (error) => {
          console.error('Erro ao atualizar agenda:', error);
          this.isSaving = false;
          this.modalService.alert({
            title: 'Erro',
            message: 'Não foi possível atualizar a agenda.',
            variant: 'danger'
          });
        }
      });
    } else {
      this.schedulesService.createSchedule(scheduleData).subscribe({
        next: (schedule) => {
          this.isSaving = false;
          setTimeout(() => {
            this.save.emit(schedule);
          });
        },
        error: (error) => {
          console.error('Erro ao criar agenda:', error);
          this.isSaving = false;
          this.modalService.alert({
            title: 'Erro',
            message: 'Não foi possível criar a agenda.',
            variant: 'danger'
          });
        }
      });
    }
  }

  getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  getDayLabel(day: DayOfWeek): string {
    return this.dayLabels[day];
  }

  updateFormDisabledState(): void {
    if (!this.form) return;

    const shouldDisable = this.isLoading || this.isSaving;

    if (shouldDisable) {
      // Desabilita todos os controles do formulário
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.disable({ emitEvent: false });
      });
    } else {
      // Habilita todos os controles do formulário
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.enable({ emitEvent: false });
      });
    }
  }
}
