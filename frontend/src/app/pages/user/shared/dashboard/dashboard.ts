import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { AvatarComponent } from '@app/shared/components/atoms/avatar/avatar';
import { BadgeComponent } from '@app/shared/components/atoms/badge/badge';
import { StatCardComponent } from '@app/shared/components/atoms/stat-card/stat-card';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { StatsService, PlatformStats } from '@app/core/services/stats.service';
import Chart from 'chart.js/auto';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'professional' | 'patient';
  memberSince: string;
  lastAccess: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    AvatarComponent,
    BadgeComponent,
    StatCardComponent,
    IconComponent
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit {
  user: User | null = null;
  stats: PlatformStats | null = null;
  
  @ViewChild('appointmentsChart') appointmentsChartRef!: ElementRef;
  @ViewChild('usersChart') usersChartRef!: ElementRef;
  @ViewChild('monthlyChart') monthlyChartRef!: ElementRef;

  appointmentsChart: any;
  usersChart: any;
  monthlyChart: any;

  constructor(private statsService: StatsService) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadStats();
  }

  ngAfterViewInit(): void {
    if (this.user?.role === 'admin') {
      this.loadCharts();
    }
  }

  private loadUserData(): void {
    // TODO: Integrar com serviço de autenticação real
    this.user = {
      id: '1',
      name: 'Admin User',
      email: 'admin@telecuidar.com.br',
      role: 'admin',
      memberSince: 'Janeiro 2024',
      lastAccess: 'Hoje às 14:30'
    };
  }

  private loadStats(): void {
    this.statsService.getPlatformStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (error) => {
        console.error('Erro ao carregar estatísticas:', error);
        // TODO: Mostrar mensagem de erro para o usuário
      }
    });
  }

  private loadCharts(): void {
    this.statsService.getAppointmentsByStatus().subscribe(data => {
      if (this.appointmentsChartRef) {
        this.appointmentsChart = new Chart(this.appointmentsChartRef.nativeElement, {
          type: 'doughnut',
          data: data,
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'bottom' }
            }
          }
        });
      }
    });

    this.statsService.getUsersByRole().subscribe(data => {
      if (this.usersChartRef) {
        this.usersChart = new Chart(this.usersChartRef.nativeElement, {
          type: 'bar',
          data: data,
          options: {
            responsive: true,
            scales: {
              y: { beginAtZero: true }
            },
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    });

    this.statsService.getMonthlyAppointments().subscribe(data => {
      if (this.monthlyChartRef) {
        this.monthlyChart = new Chart(this.monthlyChartRef.nativeElement, {
          type: 'line',
          data: data,
          options: {
            responsive: true,
            scales: {
              y: { beginAtZero: true }
            },
            plugins: {
              legend: { position: 'top' }
            }
          }
        });
      }
    });
  }
}
