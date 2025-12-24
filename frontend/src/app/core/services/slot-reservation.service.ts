import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '@env/environment';

const API_BASE_URL = environment.apiUrl;

export interface ReserveSlotRequest {
  professionalId: string;
  specialtyId: string;
  date: string;
  time: string;
}

export interface TemporarySlotReservation {
  id: string;
  professionalId: string;
  specialtyId: string;
  date: string;
  time: string;
  userId: string;
  expiresAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class SlotReservationService {
  private apiUrl = `${API_BASE_URL}/slot-reservations`;
  private currentReservation: TemporarySlotReservation | null = null;
  private reservationExpired$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  /**
   * Reserva um slot temporariamente
   */
  reserveSlot(request: ReserveSlotRequest): Observable<TemporarySlotReservation> {
    console.log('[SlotReservationService] Chamando POST em:', this.apiUrl, 'com dados:', request);
    return this.http.post<TemporarySlotReservation>(this.apiUrl, request);
  }

  /**
   * Libera uma reserva
   */
  releaseReservation(reservationId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${reservationId}`);
  }

  /**
   * Libera todas as reservas do usuário
   */
  releaseAllReservations(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/user/current`);
  }

  /**
   * Define a reserva atual e inicia o timer de expiração
   */
  setCurrentReservation(reservation: TemporarySlotReservation): void {
    this.currentReservation = reservation;
    this.startExpirationTimer(reservation);
  }

  /**
   * Obtém a reserva atual
   */
  getCurrentReservation(): TemporarySlotReservation | null {
    return this.currentReservation;
  }

  /**
   * Limpa a reserva atual
   */
  clearCurrentReservation(): void {
    this.currentReservation = null;
  }

  /**
   * Retorna a URL base da API de reservas
   */
  getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Observable que emite quando a reserva expira
   */
  getReservationExpired$(): Observable<void> {
    return this.reservationExpired$.asObservable();
  }

  /**
   * Inicia um timer para liberar a reserva quando expirar
   */
  private startExpirationTimer(reservation: TemporarySlotReservation): void {
    const expiresAt = new Date(reservation.expiresAt).getTime();
    const now = new Date().getTime();
    const timeUntilExpiry = expiresAt - now;

    if (timeUntilExpiry > 0) {
      setTimeout(() => {
        this.reservationExpired$.next();
        this.currentReservation = null;
      }, timeUntilExpiry);
    }
  }

  /**
   * Retorna tempo restante em segundos
   */
  getTimeRemainingSeconds(): number {
    if (!this.currentReservation) return 0;

    const expiresAt = new Date(this.currentReservation.expiresAt).getTime();
    const now = new Date().getTime();
    const remaining = expiresAt - now;

    return Math.max(0, Math.ceil(remaining / 1000));
  }
}
