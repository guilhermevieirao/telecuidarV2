import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

const API_BASE_URL = environment.apiUrl;

export type InviteStatus = 'Pending' | 'Accepted' | 'Expired' | 'Cancelled';
export type UserRole = 'PATIENT' | 'PROFESSIONAL' | 'ADMIN';

export interface Invite {
  id: string;
  email: string;
  role: UserRole;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  createdByUserId: string;
  createdByUserName?: string;
  createdBy?: string; // Alias para createdByUserName
  acceptedAt?: string;
  token: string;
  prefilledName?: string;
  prefilledLastName?: string;
  prefilledCpf?: string;
  prefilledPhone?: string;
}

export interface CreateInviteDto {
  email: string;
  role: UserRole;
  expiresAt?: string;
  name?: string;
  lastName?: string;
  cpf?: string;
  phone?: string;
}

export interface InvitesFilter {
  search?: string;
  role?: string;
  status?: string;
}

export interface InvitesSortOptions {
  field: keyof Invite;
  direction: 'asc' | 'desc';
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
export class InvitesService {
  private apiUrl = `${API_BASE_URL}/invites`;

  constructor(private http: HttpClient) {}

  getInvites(
    filter?: InvitesFilter,
    sort?: InvitesSortOptions,
    page: number = 1,
    pageSize: number = 10
  ): Observable<PaginatedResponse<Invite>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (sort) {
      params = params
        .set('sortBy', sort.field)
        .set('sortDirection', sort.direction);
    }

    if (filter?.search) {
      params = params.set('search', filter.search);
    }
    if (filter?.role) {
      params = params.set('role', filter.role);
    }
    if (filter?.status) {
      params = params.set('status', filter.status);
    }

    return this.http.get<PaginatedResponse<Invite>>(this.apiUrl, { params });
  }

  getInviteById(id: string): Observable<Invite> {
    return this.http.get<Invite>(`${this.apiUrl}/${id}`);
  }

  getInviteByToken(token: string): Observable<Invite> {
    return this.http.get<Invite>(`${this.apiUrl}/token/${token}`);
  }

  createInvite(invite: CreateInviteDto): Observable<Invite> {
    return this.http.post<Invite>(this.apiUrl, invite);
  }

  sendInviteByEmail(invite: CreateInviteDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/send-email`, invite);
  }

  resendInvite(id: string): Observable<Invite> {
    return this.http.post<Invite>(`${this.apiUrl}/${id}/resend`, {});
  }

  cancelInvite(id: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/cancel`, {});
  }

  deleteInvite(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  acceptInvite(token: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/accept`, { token });
  }
}
