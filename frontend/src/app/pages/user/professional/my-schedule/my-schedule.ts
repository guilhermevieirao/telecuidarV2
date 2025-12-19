import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { SchedulesService, Schedule } from '@app/core/services/schedules.service';
import { AuthService } from '@app/core/services/auth.service';
import { filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-my-schedule',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './my-schedule.html',
  styleUrl: './my-schedule.scss'
})
export class MyScheduleComponent implements OnInit {
  schedules: Schedule[] = [];
  isLoading = true;

  private schedulesService = inject(SchedulesService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

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

        console.log('[MySchedule] Carregando agenda para usuário:', user.id);
        
        this.schedulesService.getScheduleByProfessional(user.id).subscribe({
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
      });
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
