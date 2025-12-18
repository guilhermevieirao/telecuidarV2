import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

const API_BASE_URL = 'http://localhost:5239/api';

export type SpecialtyStatus = 'Active' | 'Inactive';

export interface CustomField {
  name: string;
  type: 'text' | 'number' | 'checkbox' | 'radio' | 'date' | 'select' | 'textarea';
  options?: string[];
  required?: boolean;
  description?: string;
  defaultValue?: any;
  order?: number;
}

export interface Specialty {
  id: string;
  name: string;
  description: string;
  status: SpecialtyStatus;
  createdAt: string;
  updatedAt?: string;
  customFields?: CustomField[];
}

export interface CreateSpecialtyDto {
  name: string;
  description: string;
  status: SpecialtyStatus;
  customFields?: CustomField[];
}

export interface UpdateSpecialtyDto {
  name?: string;
  description?: string;
  status?: SpecialtyStatus;
  customFields?: CustomField[];
}

export interface SpecialtiesFilter {
  search?: string;
  status?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SpecialtiesSortOptions {
  field: keyof Specialty;
  direction: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class SpecialtiesService {
  private apiUrl = `${API_BASE_URL}/specialties`;

  constructor(private http: HttpClient) {}

  getSpecialties(
    filter: SpecialtiesFilter = {},
    sort: SpecialtiesSortOptions = { field: 'name', direction: 'asc' },
    page: number = 1,
    pageSize: number = 10
  ): Observable<PaginatedResponse<Specialty>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString())
      .set('sortBy', sort.field)
      .set('sortDirection', sort.direction);

    if (filter.search) {
      params = params.set('search', filter.search);
    }
    if (filter.status) {
      params = params.set('status', filter.status);
    }

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map(response => ({
        ...response,
        data: response.data.map((s: any) => this.mapSpecialtyFromApi(s))
      }))
    );
  }

  getSpecialtyById(id: string): Observable<Specialty> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(s => this.mapSpecialtyFromApi(s))
    );
  }

  createSpecialty(specialty: CreateSpecialtyDto): Observable<Specialty> {
    const payload = {
      name: specialty.name,
      description: specialty.description,
      customFieldsJson: specialty.customFields && specialty.customFields.length > 0 
        ? JSON.stringify(specialty.customFields) 
        : null
    };
    return this.http.post<any>(this.apiUrl, payload).pipe(
      map(s => this.mapSpecialtyFromApi(s))
    );
  }

  updateSpecialty(id: string, updates: UpdateSpecialtyDto): Observable<Specialty> {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.customFields !== undefined) {
      payload.customFieldsJson = updates.customFields && updates.customFields.length > 0
        ? JSON.stringify(updates.customFields)
        : null;
    }
    return this.http.put<any>(`${this.apiUrl}/${id}`, payload).pipe(
      map(s => this.mapSpecialtyFromApi(s))
    );
  }

  deleteSpecialty(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  toggleSpecialtyStatus(id: string, currentStatus: SpecialtyStatus): Observable<Specialty> {
    const newStatus: SpecialtyStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    return this.http.put<any>(`${this.apiUrl}/${id}`, { status: newStatus }).pipe(
      map(s => this.mapSpecialtyFromApi(s))
    );
  }

  private mapSpecialtyFromApi(apiSpecialty: any): Specialty {
    return {
      id: apiSpecialty.id,
      name: apiSpecialty.name,
      description: apiSpecialty.description,
      status: apiSpecialty.status,
      createdAt: apiSpecialty.createdAt,
      updatedAt: apiSpecialty.updatedAt,
      customFields: apiSpecialty.customFieldsJson 
        ? JSON.parse(apiSpecialty.customFieldsJson) 
        : []
    };
  }
}
