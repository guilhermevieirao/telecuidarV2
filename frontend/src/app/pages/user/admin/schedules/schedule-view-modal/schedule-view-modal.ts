import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Schedule, DayOfWeek } from '@app/core/services/schedules.service';

@Component({
  selector: 'app-schedule-view-modal',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './schedule-view-modal.html',
  styleUrl: './schedule-view-modal.scss'
})
export class ScheduleViewModalComponent {
  @Input() isOpen = false;
  @Input() schedule: Schedule | null = null;
  @Output() close = new EventEmitter<void>();

  dayLabels: Record<DayOfWeek, string> = {
    'Monday': 'Segunda-feira',
    'Tuesday': 'Terça-feira',
    'Wednesday': 'Quarta-feira',
    'Thursday': 'Quinta-feira',
    'Friday': 'Sexta-feira',
    'Saturday': 'Sábado',
    'Sunday': 'Domingo'
  };

  onClose(): void {
    this.close.emit();
  }

  getDayLabel(day: DayOfWeek): string {
    return this.dayLabels[day];
  }

  getWorkingDays(): string {
    if (!this.schedule) return '';
    const workingDays = this.schedule.daysConfig
      .filter(d => d.isWorking)
      .map(d => this.getDayLabel(d.day as DayOfWeek));
    return workingDays.join(', ');
  }

  getTimeRange(): string {
    if (!this.schedule) return '';
    const firstWorkingDay = this.schedule.daysConfig.find(d => d.isWorking);
    if (firstWorkingDay && firstWorkingDay.customized && firstWorkingDay.timeRange) {
      return `${firstWorkingDay.timeRange.startTime} - ${firstWorkingDay.timeRange.endTime}`;
    }
    return `${this.schedule.globalConfig.timeRange.startTime} - ${this.schedule.globalConfig.timeRange.endTime}`;
  }

  getConsultationDuration(): number {
    if (!this.schedule) return 0;
    const firstWorkingDay = this.schedule.daysConfig.find(d => d.isWorking);
    if (firstWorkingDay && firstWorkingDay.customized && firstWorkingDay.consultationDuration) {
      return firstWorkingDay.consultationDuration;
    }
    return this.schedule.globalConfig.consultationDuration;
  }

  isScheduleActive(): boolean {
    return this.schedule?.status === 'Active';
  }

  getValidity(): string {
    if (!this.schedule) return '';
    const startDate = new Date(this.schedule.validityStartDate).toLocaleDateString('pt-BR');
    const endDate = this.schedule.validityEndDate 
      ? new Date(this.schedule.validityEndDate).toLocaleDateString('pt-BR')
      : 'Indefinida';
    return `${startDate} - ${endDate}`;
  }

  hasCustomizedDays(): boolean {
    if (!this.schedule) return false;
    return this.schedule.daysConfig.some(d => d.customized && d.isWorking);
  }

  getCustomizedDays(): any[] {
    if (!this.schedule) return [];
    return this.schedule.daysConfig.filter(d => d.customized && d.isWorking);
  }
}
