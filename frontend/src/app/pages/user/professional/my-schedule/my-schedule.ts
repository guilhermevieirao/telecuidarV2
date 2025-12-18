import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { SchedulesService, Schedule } from '@app/core/services/schedules.service';

@Component({
  selector: 'app-my-schedule',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './my-schedule.html',
  styleUrl: './my-schedule.scss'
})
export class MyScheduleComponent {
  schedules: Schedule[] = [];
  isLoading = true;

  private schedulesService = inject(SchedulesService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    afterNextRender(() => {
      // Hardcoded ID for demo purposes, matching the mock data in SchedulesService
      const currentProfessionalId = 'prof-1'; 
      
      this.schedulesService.getScheduleByProfessional(currentProfessionalId).subscribe({
        next: (schedules) => {
          this.schedules = Array.isArray(schedules) ? schedules : [];
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading schedule', err);
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
