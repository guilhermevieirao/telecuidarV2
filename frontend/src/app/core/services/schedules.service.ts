import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

const API_BASE_URL = 'http://localhost:5239/api';

export type ScheduleStatus = 'Active' | 'Inactive';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface TimeRange {
  startTime: string;
  endTime: string;
}

export interface BreakTime {
  startTime: string;
  endTime: string;
}

export interface DayConfig {
  day: DayOfWeek;
  isWorking: boolean;
  timeRange?: TimeRange;
  breakTime?: BreakTime;
  consultationDuration?: number;
  intervalBetweenConsultations?: number;
  customized?: boolean;
}

export interface ScheduleGlobalConfig {
  timeRange: TimeRange;
  breakTime?: BreakTime;
  consultationDuration: number;
  intervalBetweenConsultations: number;
}

export interface Schedule {
  id: string;
  professionalId: string;
  professionalName?: string;
  professionalEmail?: string;
  daysConfig: DayConfig[];
  globalConfig: ScheduleGlobalConfig;
  validityStartDate: string;
  validityEndDate?: string;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateScheduleDto {
  professionalId: string;
  daysConfig: DayConfig[];
  globalConfig: ScheduleGlobalConfig;
  validityStartDate: string;
  validityEndDate?: string;
  status: ScheduleStatus;
}

export interface UpdateScheduleDto {
  daysConfig?: DayConfig[];
  globalConfig?: ScheduleGlobalConfig;
  validityStartDate?: string;
  validityEndDate?: string;
  status?: ScheduleStatus;
}

export interface SchedulesFilter {
  search?: string;
  status?: string;
  professionalId?: string;
}

export type SchedulesSortOptions = 'professionalName' | 'createdAt' | 'status';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AvailableSlot {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SchedulesService {
  private apiUrl = `${API_BASE_URL}/schedules`;

  constructor(private http: HttpClient) {}

  getSchedules(
    filter?: SchedulesFilter,
    page: number = 1,
    pageSize: number = 10
  ): Observable<PaginatedResponse<Schedule>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (filter?.search) {
      params = params.set('search', filter.search);
    }
    if (filter?.status) {
      params = params.set('status', filter.status);
    }
    if (filter?.professionalId) {
      params = params.set('professionalId', filter.professionalId);
    }

    return this.http.get<PaginatedResponse<Schedule>>(this.apiUrl, { params });
  }

  getScheduleById(id: string): Observable<Schedule> {
    return this.http.get<Schedule>(`${this.apiUrl}/${id}`);
  }

  getScheduleByProfessional(professionalId: string): Observable<Schedule[]> {
    return this.http.get<Schedule[]>(`${this.apiUrl}/professional/${professionalId}`);
  }

  getAvailableSlots(
    professionalId: string,
    startDate: string,
    endDate: string
  ): Observable<AvailableSlot[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get<AvailableSlot[]>(
      `${this.apiUrl}/professional/${professionalId}/available-slots`,
      { params }
    );
  }

  createSchedule(schedule: CreateScheduleDto): Observable<Schedule> {
    return this.http.post<Schedule>(this.apiUrl, schedule);
  }

  updateSchedule(id: string, updates: UpdateScheduleDto): Observable<Schedule> {
    return this.http.patch<Schedule>(`${this.apiUrl}/${id}`, updates);
  }

  deleteSchedule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  toggleScheduleStatus(id: string): Observable<Schedule> {
    // First, get the current schedule to know its status
    return this.getScheduleById(id).pipe(
      switchMap(schedule => {
        const newStatus = schedule.status === 'Active' ? 'Inactive' : 'Active';
        return this.updateSchedule(id, { status: newStatus });
      })
    );
  }
}
