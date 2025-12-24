import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

const API_BASE_URL = environment.apiUrl;

export type UserRole = 'PATIENT' | 'PROFESSIONAL' | 'ADMIN';
export type UserStatus = 'Active' | 'Inactive';

// ============================================
// Interfaces de Perfis Específicos
// ============================================

export interface PatientProfile {
  id?: string;
  cns?: string;
  socialName?: string;
  gender?: string;
  birthDate?: string;
  motherName?: string;
  fatherName?: string;
  nationality?: string;
  zipCode?: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface ProfessionalProfile {
  id?: string;
  crm?: string;
  cbo?: string;
  specialtyId?: string;
  specialtyName?: string;
  gender?: string;
  birthDate?: string;
  nationality?: string;
  zipCode?: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface CreateUpdatePatientProfile {
  cns?: string;
  socialName?: string;
  gender?: string;
  birthDate?: string;
  motherName?: string;
  fatherName?: string;
  nationality?: string;
  zipCode?: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface CreateUpdateProfessionalProfile {
  crm?: string;
  cbo?: string;
  specialtyId?: string;
  gender?: string;
  birthDate?: string;
  nationality?: string;
  zipCode?: string;
  address?: string;
  city?: string;
  state?: string;
}

// ============================================
// Interface de Usuário com Perfis
// ============================================

export interface User {
  id: string;
  name: string;
  lastName: string;
  email: string;
  role: UserRole;
  cpf: string;
  phone?: string;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
  avatar?: string;
  emailVerified?: boolean;
  
  // Perfis específicos por tipo de usuário
  patientProfile?: PatientProfile;
  professionalProfile?: ProfessionalProfile;
}

export interface CreateUserDto {
  name: string;
  lastName: string;
  email: string;
  cpf: string;
  phone?: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  
  // Perfis específicos por tipo de usuário
  patientProfile?: CreateUpdatePatientProfile;
  professionalProfile?: CreateUpdateProfessionalProfile;
}

export interface UpdateUserDto {
  name?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  status?: UserStatus;
  role?: UserRole;
  
  // Perfis específicos por tipo de usuário
  patientProfile?: CreateUpdatePatientProfile;
  professionalProfile?: CreateUpdateProfessionalProfile;
}

export interface UsersFilter {
  search?: string;
  role?: string;
  status?: string;
  specialtyId?: string;
}

export type UsersSortOptions = 'name' | 'email' | 'createdAt' | 'role' | 'status';

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
export class UsersService {
  private apiUrl = `${API_BASE_URL}/users`;

  constructor(private http: HttpClient) {}

  getUsers(
    filter?: UsersFilter,
    page: number = 1,
    pageSize: number = 10
  ): Observable<PaginatedResponse<User>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (filter?.search) {
      params = params.set('search', filter.search);
    }
    if (filter?.role) {
      params = params.set('role', filter.role);
    }
    if (filter?.status) {
      params = params.set('status', filter.status);
    }
    if (filter?.specialtyId) {
      params = params.set('specialtyId', filter.specialtyId);
    }

    return this.http.get<PaginatedResponse<User>>(this.apiUrl, { params });
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  createUser(user: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.apiUrl, user);
  }

  updateUser(id: string, user: UpdateUserDto): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, user);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getUserStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats`);
  }

  generateInviteLink(data: { email: string; role: UserRole; specialtyId?: string }): Observable<any> {
    return this.http.post(`${API_BASE_URL}/invites/generate-link`, data);
  }

  sendInviteByEmail(data: { email: string; role: UserRole; specialtyId?: string }): Observable<any> {
    return this.http.post(`${API_BASE_URL}/invites/send-email`, data);
  }

  // ============================================
  // Métodos de Perfil de Paciente
  // ============================================

  getPatientProfile(userId: string): Observable<PatientProfile> {
    return this.http.get<PatientProfile>(`${this.apiUrl}/${userId}/patient-profile`);
  }

  updatePatientProfile(userId: string, profile: CreateUpdatePatientProfile): Observable<PatientProfile> {
    return this.http.put<PatientProfile>(`${this.apiUrl}/${userId}/patient-profile`, profile);
  }

  // ============================================
  // Métodos de Perfil de Profissional
  // ============================================

  getProfessionalProfile(userId: string): Observable<ProfessionalProfile> {
    return this.http.get<ProfessionalProfile>(`${this.apiUrl}/${userId}/professional-profile`);
  }

  updateProfessionalProfile(userId: string, profile: CreateUpdateProfessionalProfile): Observable<ProfessionalProfile> {
    return this.http.put<ProfessionalProfile>(`${this.apiUrl}/${userId}/professional-profile`, profile);
  }
}
