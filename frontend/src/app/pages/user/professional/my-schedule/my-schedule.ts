import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { SchedulesService, Schedule, DayOfWeek } from '@app/core/services/schedules.service';

@Component({
  selector: 'app-my-schedule',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './my-schedule.html',
  styleUrl: './my-schedule.scss'
})
export class MyScheduleComponent implements OnInit {
  schedule: Schedule | null = null;
  isLoading = true;

  dayLabels: Record<DayOfWeek, string> = {
    'segunda': 'Segunda-feira',
    'terca': 'Terça-feira',
    'quarta': 'Quarta-feira',
    'quinta': 'Quinta-feira',
    'sexta': 'Sexta-feira',
    'sabado': 'Sábado',
    'domingo': 'Domingo'
  };

  constructor(private schedulesService: SchedulesService) {}

  ngOnInit(): void {
    // Hardcoded ID for demo purposes, matching the mock data in SchedulesService
    const currentProfessionalId = 'prof-1'; 
    
    this.schedulesService.getScheduleByProfessionalId(currentProfessionalId).subscribe({
      next: (schedule) => {
        this.schedule = schedule || null;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading schedule', err);
        this.isLoading = false;
      }
    });
  }

  getDayLabel(day: DayOfWeek): string {
    return this.dayLabels[day];
  }
}
