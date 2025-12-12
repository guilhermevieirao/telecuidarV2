import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface Trend {
  direction: 'up' | 'down';
  value: string;
}

export interface PlatformStats {
  totalUsers: number;
  usersTrend?: Trend;
  appointmentsScheduled: number;
  appointmentsTrend?: Trend;
  occupancyRate: number;
  occupancyTrend?: Trend;
  averageRating: number;
  ratingTrend?: Trend;
  activeProfessionals: number;
  activePatients: number;
  todayAppointments: number;
  averageConsultationTime: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
    borderWidth?: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  // TODO: Substituir por chamadas reais ao backend
  getPlatformStats(): Observable<PlatformStats> {
    // Dados mockados para demonstração
    const mockStats: PlatformStats = {
      totalUsers: 1247,
      usersTrend: { direction: 'up', value: '+12%' },
      appointmentsScheduled: 156,
      appointmentsTrend: { direction: 'up', value: '+8%' },
      occupancyRate: 78,
      occupancyTrend: { direction: 'down', value: '-3%' },
      averageRating: 4.8,
      ratingTrend: { direction: 'up', value: '+0.2' },
      activeProfessionals: 48,
      activePatients: 324,
      todayAppointments: 23,
      averageConsultationTime: 35
    };

    // Simula delay de rede
    return of(mockStats).pipe(delay(500));
  }

  getAppointmentsByStatus(): Observable<ChartData> {
    const data: ChartData = {
      labels: ['Agendado', 'Realizado', 'Cancelado', 'Pendente'],
      datasets: [{
        label: 'Status de Agendamentos',
        data: [45, 80, 15, 20],
        backgroundColor: [
          '#3b82f6', // blue-500
          '#10b981', // green-500
          '#ef4444', // red-500
          '#f59e0b'  // amber-500
        ],
        borderWidth: 1
      }]
    };
    return of(data).pipe(delay(600));
  }

  getUsersByRole(): Observable<ChartData> {
    const data: ChartData = {
      labels: ['Pacientes', 'Profissionais', 'Administradores'],
      datasets: [{
        label: 'Usuários por Perfil',
        data: [850, 120, 15],
        backgroundColor: [
          '#8b5cf6', // violet-500
          '#06b6d4', // cyan-500
          '#64748b'  // slate-500
        ],
        borderWidth: 1
      }]
    };
    return of(data).pipe(delay(700));
  }

  getMonthlyAppointments(): Observable<ChartData> {
    const data: ChartData = {
      labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
      datasets: [{
        label: 'Consultas Realizadas',
        data: [65, 59, 80, 81, 56, 95],
        borderColor: ['#3b82f6'],
        backgroundColor: ['rgba(59, 130, 246, 0.2)'],
        borderWidth: 2
      }]
    };
    return of(data).pipe(delay(800));
  }
}
