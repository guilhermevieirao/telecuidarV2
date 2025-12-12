import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { BadgeComponent, BadgeVariant } from '@shared/components/atoms/badge/badge';
import { ScheduleBlockRequestModalComponent } from './request-modal/schedule-block-request-modal';

@Component({
  selector: 'app-schedule-blocks',
  standalone: true,
  imports: [CommonModule, ButtonComponent, IconComponent, BadgeComponent, ScheduleBlockRequestModalComponent],
  templateUrl: './schedule-blocks.html',
  styleUrls: ['./schedule-blocks.scss']
})
export class ScheduleBlocksComponent {
  blocks = [
    {
      id: 1,
      type: 'single',
      date: '2025-12-20',
      reason: 'Consulta Médica',
      status: 'pendente',
      createdAt: '2025-12-10'
    },
    {
      id: 2,
      type: 'range',
      startDate: '2025-12-24',
      endDate: '2025-12-26',
      reason: 'Natal',
      status: 'aprovada',
      createdAt: '2025-12-01'
    },
    {
      id: 3,
      type: 'single',
      date: '2025-11-15',
      reason: 'Feriado',
      status: 'vencido',
      createdAt: '2025-11-01'
    }
  ];

  isRequestModalOpen = false;

  openRequestModal() {
    this.isRequestModalOpen = true;
  }

  closeRequestModal() {
    this.isRequestModalOpen = false;
  }

  handleRequest(data: any) {
    console.log('Solicitação enviada:', data);
    // Aqui integraria com o backend para salvar
    this.blocks.unshift({
      id: this.blocks.length + 1,
      type: data.type,
      date: data.date,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      status: 'pendente',
      createdAt: new Date().toISOString()
    });
    this.closeRequestModal();
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'pendente': return 'warning';
      case 'aprovada': return 'success';
      case 'negada': return 'error';
      case 'vencido': return 'neutral';
      default: return 'neutral';
    }
  }
}
