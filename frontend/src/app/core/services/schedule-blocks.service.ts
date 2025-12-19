import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';

const API_BASE_URL = 'http://localhost:5239/api';

export type ScheduleBlockStatus = 'Pending' | 'Approved' | 'Rejected' | 'Expired';
export type ScheduleBlockType = 'Single' | 'Range';

export interface ScheduleBlock {
  id: string;
  professionalId: string;
  professionalName?: string;
  type: ScheduleBlockType;
  date?: string;
  startDate?: string;
  endDate?: string;
  reason: string;
  status: ScheduleBlockStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateScheduleBlockDto {
  professionalId: string;
  type: ScheduleBlockType;
  date?: string;
  startDate?: string;
  endDate?: string;
  reason: string;
}

export interface UpdateScheduleBlockDto {
  type?: ScheduleBlockType;
  date?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
}

export interface ApproveScheduleBlockDto {
  approvedBy: string;
}

export interface RejectScheduleBlockDto {
  rejectedBy: string;
  rejectionReason: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root'
})
export class ScheduleBlocksService {
  private apiUrl = `${API_BASE_URL}/scheduleblocks`;
  
  // Subject para notificar mudanças nos bloqueios
  private blocksChanged = new Subject<void>();
  public blocksChanged$ = this.blocksChanged.asObservable();

  constructor(private http: HttpClient) {}
  
  // Método para notificar mudanças
  private notifyBlocksChanged(): void {
    this.blocksChanged.next();
  }

  getScheduleBlocks(
    professionalId?: string,
    status?: ScheduleBlockStatus,
    page: number = 1,
    pageSize: number = 10
  ): Observable<PaginatedResponse<ScheduleBlock>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (professionalId) {
      params = params.set('professionalId', professionalId);
    }

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<PaginatedResponse<ScheduleBlock>>(this.apiUrl, { params });
  }

  getScheduleBlockById(id: string): Observable<ScheduleBlock> {
    return this.http.get<ScheduleBlock>(`${this.apiUrl}/${id}`);
  }

  createScheduleBlock(dto: CreateScheduleBlockDto): Observable<ScheduleBlock> {
    // Remove undefined properties to avoid sending them in the request
    const cleanDto = Object.fromEntries(
      Object.entries(dto).filter(([_, value]) => value !== undefined)
    );
    console.log('[ScheduleBlocksService] Sending DTO:', cleanDto);
    return this.http.post<ScheduleBlock>(this.apiUrl, cleanDto).pipe(
      tap(() => this.notifyBlocksChanged())
    );
  }

  updateScheduleBlock(id: string, dto: UpdateScheduleBlockDto): Observable<ScheduleBlock> {
    return this.http.patch<ScheduleBlock>(`${this.apiUrl}/${id}`, dto).pipe(
      tap(() => this.notifyBlocksChanged())
    );
  }

  deleteScheduleBlock(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.notifyBlocksChanged())
    );
  }

  approveScheduleBlock(id: string, dto: ApproveScheduleBlockDto): Observable<ScheduleBlock> {
    return this.http.post<ScheduleBlock>(`${this.apiUrl}/${id}/approve`, dto).pipe(
      tap(() => this.notifyBlocksChanged())
    );
  }

  rejectScheduleBlock(id: string, dto: RejectScheduleBlockDto): Observable<ScheduleBlock> {
    return this.http.post<ScheduleBlock>(`${this.apiUrl}/${id}/reject`, dto).pipe(
      tap(() => this.notifyBlocksChanged())
    );
  }

  checkConflict(
    professionalId: string,
    date?: string,
    startDate?: string,
    endDate?: string,
    excludeBlockId?: string
  ): Observable<{ hasConflict: boolean }> {
    let params = new HttpParams().set('professionalId', professionalId);

    if (date) {
      params = params.set('date', date);
    }
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    if (excludeBlockId) {
      params = params.set('excludeBlockId', excludeBlockId);
    }

    return this.http.get<{ hasConflict: boolean }>(`${this.apiUrl}/check-conflict`, { params });
  }
}
