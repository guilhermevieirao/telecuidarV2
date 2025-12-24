import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { SchedulesService, Schedule } from '@app/core/services/schedules.service';
import { AuthService } from '@app/core/services/auth.service';
import { ScheduleDaysPipe } from '@app/core/pipes/schedule-days.pipe';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { RealTimeService, EntityNotification } from '@app/core/services/real-time.service';
import { filter, take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-my-schedule',
  standalone: true,
  imports: [CommonModule, DatePipe, ScheduleDaysPipe, IconComponent],
  templateUrl: './my-schedule.html',
  styleUrl: './my-schedule.scss'
})
export class MyScheduleComponent implements OnInit, OnDestroy {
  schedules: Schedule[] = [];
  isLoading = true;

  private schedulesService = inject(SchedulesService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private realTimeService = inject(RealTimeService);
  private realTimeSubscriptions: Subscription[] = [];
  private isBrowser: boolean;
  private currentUserId?: string;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // Aguardar até que o usuário esteja autenticado
    this.authService.authState$
      .pipe(
        filter(state => state.isAuthenticated && state.user !== null),
        take(1)
      )
      .subscribe(() => {
        const user = this.authService.getCurrentUser();
        if (!user?.id) {
          console.error('[MySchedule] Usuário não autenticado');
          this.isLoading = false;
          return;
        }

        this.currentUserId = user.id.toString();
        console.log('[MySchedule] Carregando agenda para usuário:', user.id);
        
        this.loadSchedules();
        
        if (this.isBrowser) {
          this.setupRealTimeSubscriptions();
        }
      });
  }

  ngOnDestroy(): void {
    this.realTimeSubscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadSchedules(): void {
    if (!this.currentUserId) return;
    
    this.schedulesService.getScheduleByProfessional(this.currentUserId).subscribe({
      next: (schedules) => {
        this.schedules = Array.isArray(schedules) ? schedules : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[MySchedule] Error loading schedule', err);
        this.schedules = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private setupRealTimeSubscriptions(): void {
    const scheduleEventsSub = this.realTimeService.getEntityEvents$('Schedule').subscribe(
      (notification: EntityNotification) => {
        this.handleScheduleEvent(notification);
      }
    );
    this.realTimeSubscriptions.push(scheduleEventsSub);
  }

  private handleScheduleEvent(notification: EntityNotification): void {
    // Verificar se a atualização é para o usuário atual
    if (notification.data?.professionalId?.toString() === this.currentUserId || 
        this.schedules.some(s => s.id?.toString() === notification.entityId?.toString())) {
      switch (notification.action) {
        case 'Created':
        case 'Updated':
        case 'Deleted':
          this.loadSchedules();
          break;
      }
    }
  }

  getWorkingDays(schedule: Schedule): string {
    const workingDays = schedule.daysConfig
      .filter(d => d.isWorking)
      .map(d => this.getDayLabel(d.day));
    return workingDays.join(', ');
  }

  getTimeRange(schedule: Schedule): string {
    const firstWorkingDay = schedule.daysConfig.find(d => d.isWorking);
    if (firstWorkingDay && firstWorkingDay.customized && firstWorkingDay.timeRange) {
      return `${firstWorkingDay.timeRange.startTime} - ${firstWorkingDay.timeRange.endTime}`;
    }
    return `${schedule.globalConfig.timeRange.startTime} - ${schedule.globalConfig.timeRange.endTime}`;
  }

  getConsultationDuration(schedule: Schedule): number {
    const firstWorkingDay = schedule.daysConfig.find(d => d.isWorking);
    if (firstWorkingDay && firstWorkingDay.customized && firstWorkingDay.consultationDuration) {
      return firstWorkingDay.consultationDuration;
    }
    return schedule.globalConfig.consultationDuration;
  }

  getWorkingDaysWithDetails(schedule: Schedule): any[] {
    return schedule.daysConfig
      .filter(d => d.isWorking)
      .map(d => ({
        day: this.getDayLabel(d.day),
        isCustomized: d.customized || false,
        timeRange: d.customized && d.timeRange ? d.timeRange : schedule.globalConfig.timeRange,
        breakTime: d.customized && d.breakTime ? d.breakTime : schedule.globalConfig.breakTime,
        consultationDuration: d.customized && d.consultationDuration ? d.consultationDuration : schedule.globalConfig.consultationDuration,
        intervalBetweenConsultations: d.customized && d.intervalBetweenConsultations ? d.intervalBetweenConsultations : schedule.globalConfig.intervalBetweenConsultations
      }));
  }

  hasCustomizedDays(schedule: Schedule): boolean {
    return schedule.daysConfig.some(d => d.isWorking && d.customized);
  }

  isScheduleActive(schedule: Schedule): boolean {
    return schedule.status === 'Active';
  }

  getDayLabel(day: string): string {
    const dayLabels: Record<string, string> = {
      'Monday': 'Segunda-feira',
      'Tuesday': 'Terça-feira',
      'Wednesday': 'Quarta-feira',
      'Thursday': 'Quinta-feira',
      'Friday': 'Sexta-feira',
      'Saturday': 'Sábado',
      'Sunday': 'Domingo'
    };
    return dayLabels[day] || day;
  }
}
