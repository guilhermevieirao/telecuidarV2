import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

export type ScheduleStatus = 'active' | 'inactive';
export type DayOfWeek = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo';

export interface TimeRange {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export interface BreakTime {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export interface DayConfig {
  day: DayOfWeek;
  isWorking: boolean;
  timeRange?: TimeRange;
  breakTime?: BreakTime;
  consultationDuration?: number; // in minutes
  intervalBetweenConsultations?: number; // in minutes, 0 = no interval
  customized?: boolean; // true if different from global config
}

export interface ScheduleGlobalConfig {
  timeRange: TimeRange;
  breakTime?: BreakTime;
  consultationDuration: number; // in minutes
  intervalBetweenConsultations: number; // in minutes
}

export interface Schedule {
  id: string;
  professionalId: string;
  professionalName: string;
  professionalEmail: string;
  daysConfig: DayConfig[];
  globalConfig: ScheduleGlobalConfig;
  validityStartDate: string; // YYYY-MM-DD
  validityEndDate?: string; // YYYY-MM-DD or null for indefinite
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulesFilter {
  search?: string;
  status?: ScheduleStatus | 'all';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SchedulesSortOptions {
  field: keyof Schedule;
  direction: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class SchedulesService {
  private mockSchedules: Schedule[] = [
    {
      id: '1',
      professionalId: 'prof-1',
      professionalName: 'Dr. João Silva',
      professionalEmail: 'joao.silva@example.com',
      daysConfig: [
        { day: 'segunda', isWorking: true, timeRange: { startTime: '08:00', endTime: '12:00' }, breakTime: { startTime: '10:00', endTime: '10:15' }, consultationDuration: 30, intervalBetweenConsultations: 5 },
        { day: 'terca', isWorking: true, timeRange: { startTime: '08:00', endTime: '17:00' }, breakTime: { startTime: '12:00', endTime: '13:00' }, consultationDuration: 30, intervalBetweenConsultations: 5 },
        { day: 'quarta', isWorking: true, timeRange: { startTime: '08:00', endTime: '17:00' }, breakTime: { startTime: '12:00', endTime: '13:00' }, consultationDuration: 30, intervalBetweenConsultations: 5 },
        { day: 'quinta', isWorking: true, timeRange: { startTime: '08:00', endTime: '17:00' }, breakTime: { startTime: '12:00', endTime: '13:00' }, consultationDuration: 30, intervalBetweenConsultations: 5 },
        { day: 'sexta', isWorking: true, timeRange: { startTime: '08:00', endTime: '17:00' }, breakTime: { startTime: '12:00', endTime: '13:00' }, consultationDuration: 30, intervalBetweenConsultations: 5 },
        { day: 'sabado', isWorking: false },
        { day: 'domingo', isWorking: false }
      ],
      globalConfig: {
        timeRange: { startTime: '08:00', endTime: '17:00' },
        breakTime: { startTime: '12:00', endTime: '13:00' },
        consultationDuration: 30,
        intervalBetweenConsultations: 5
      },
      validityStartDate: '2024-01-01',
      validityEndDate: '2025-12-31',
      status: 'active',
      createdAt: '2024-01-01T10:00:00',
      updatedAt: '2024-01-01T10:00:00'
    },
    {
      id: '2',
      professionalId: 'prof-2',
      professionalName: 'Dra. Maria Santos',
      professionalEmail: 'maria.santos@example.com',
      daysConfig: [
        { day: 'segunda', isWorking: true, timeRange: { startTime: '09:00', endTime: '13:00' }, breakTime: { startTime: '11:00', endTime: '11:15' }, consultationDuration: 45, intervalBetweenConsultations: 10 },
        { day: 'terca', isWorking: true, timeRange: { startTime: '14:00', endTime: '18:00' }, breakTime: undefined, consultationDuration: 45, intervalBetweenConsultations: 10 },
        { day: 'quarta', isWorking: true, timeRange: { startTime: '09:00', endTime: '13:00' }, breakTime: { startTime: '11:00', endTime: '11:15' }, consultationDuration: 45, intervalBetweenConsultations: 10 },
        { day: 'quinta', isWorking: false },
        { day: 'sexta', isWorking: true, timeRange: { startTime: '14:00', endTime: '18:00' }, breakTime: undefined, consultationDuration: 45, intervalBetweenConsultations: 10 },
        { day: 'sabado', isWorking: true, timeRange: { startTime: '09:00', endTime: '12:00' }, breakTime: undefined, consultationDuration: 45, intervalBetweenConsultations: 10 },
        { day: 'domingo', isWorking: false }
      ],
      globalConfig: {
        timeRange: { startTime: '09:00', endTime: '18:00' },
        breakTime: { startTime: '12:00', endTime: '13:00' },
        consultationDuration: 45,
        intervalBetweenConsultations: 10
      },
      validityStartDate: '2024-06-01',
      validityEndDate: undefined,
      status: 'active',
      createdAt: '2024-06-01T14:30:00',
      updatedAt: '2024-06-01T14:30:00'
    },
    {
      id: '3',
      professionalId: 'prof-3',
      professionalName: 'Dr. Carlos Oliveira',
      professionalEmail: 'carlos.oliveira@example.com',
      daysConfig: [
        { day: 'segunda', isWorking: true, timeRange: { startTime: '08:00', endTime: '17:00' }, breakTime: { startTime: '12:00', endTime: '13:00' }, consultationDuration: 60, intervalBetweenConsultations: 0 },
        { day: 'terca', isWorking: true, timeRange: { startTime: '08:00', endTime: '17:00' }, breakTime: { startTime: '12:00', endTime: '13:00' }, consultationDuration: 60, intervalBetweenConsultations: 0 },
        { day: 'quarta', isWorking: false },
        { day: 'quinta', isWorking: true, timeRange: { startTime: '08:00', endTime: '17:00' }, breakTime: { startTime: '12:00', endTime: '13:00' }, consultationDuration: 60, intervalBetweenConsultations: 0 },
        { day: 'sexta', isWorking: true, timeRange: { startTime: '08:00', endTime: '17:00' }, breakTime: { startTime: '12:00', endTime: '13:00' }, consultationDuration: 60, intervalBetweenConsultations: 0 },
        { day: 'sabado', isWorking: false },
        { day: 'domingo', isWorking: false }
      ],
      globalConfig: {
        timeRange: { startTime: '08:00', endTime: '17:00' },
        breakTime: { startTime: '12:00', endTime: '13:00' },
        consultationDuration: 60,
        intervalBetweenConsultations: 0
      },
      validityStartDate: '2024-03-15',
      validityEndDate: '2024-12-31',
      status: 'inactive',
      createdAt: '2024-03-15T09:00:00',
      updatedAt: '2024-03-15T09:00:00'
    }
  ];

  getSchedules(
    filter: SchedulesFilter = {},
    sort: SchedulesSortOptions = { field: 'professionalName', direction: 'asc' },
    page: number = 1,
    pageSize: number = 10
  ): Observable<PaginatedResponse<Schedule>> {
    return of(this.mockSchedules).pipe(
      delay(500),
      map(schedules => {
        let filtered = [...schedules];

        if (filter.search) {
          const searchLower = filter.search.toLowerCase();
          filtered = filtered.filter(schedule =>
            schedule.professionalName.toLowerCase().includes(searchLower) ||
            schedule.professionalEmail.toLowerCase().includes(searchLower) ||
            schedule.id.includes(searchLower)
          );
        }

        if (filter.status && filter.status !== 'all') {
          filtered = filtered.filter(schedule => schedule.status === filter.status);
        }

        const sorted = filtered.sort((a, b) => {
          const aValue = a[sort.field] as any;
          const bValue = b[sort.field] as any;
          
          if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
          return 0;
        });

        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = sorted.slice(startIndex, endIndex);

        return {
          data: paginatedData,
          total: sorted.length,
          page,
          pageSize,
          totalPages: Math.ceil(sorted.length / pageSize)
        };
      })
    );
  }

  getScheduleByProfessionalId(professionalId: string): Observable<Schedule | undefined> {
    return of(this.mockSchedules.find(schedule => schedule.professionalId === professionalId)).pipe(delay(300));
  }

  getScheduleById(id: string): Observable<Schedule | undefined> {
    return of(this.mockSchedules.find(schedule => schedule.id === id)).pipe(delay(300));
  }

  createSchedule(schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>): Observable<Schedule> {
    const newSchedule: Schedule = {
      ...schedule,
      id: (this.mockSchedules.length + 1).toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.mockSchedules = [newSchedule, ...this.mockSchedules];
    return of(newSchedule).pipe(delay(500));
  }

  updateSchedule(id: string, updates: Partial<Schedule>): Observable<Schedule> {
    const index = this.mockSchedules.findIndex(s => s.id === id);
    if (index !== -1) {
      this.mockSchedules[index] = { 
        ...this.mockSchedules[index], 
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return of(this.mockSchedules[index]).pipe(delay(500));
    }
    throw new Error('Agenda não encontrada');
  }

  deleteSchedule(id: string): Observable<void> {
    this.mockSchedules = this.mockSchedules.filter(s => s.id !== id);
    return of(void 0).pipe(delay(500));
  }

  toggleScheduleStatus(id: string): Observable<Schedule> {
    const schedule = this.mockSchedules.find(s => s.id === id);
    if (schedule) {
      schedule.status = schedule.status === 'active' ? 'inactive' : 'active';
      schedule.updatedAt = new Date().toISOString();
      return of(schedule).pipe(delay(500));
    }
    throw new Error('Agenda não encontrada');
  }
}
