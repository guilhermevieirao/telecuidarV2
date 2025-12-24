import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { BadgeComponent, BadgeVariant } from '@shared/components/atoms/badge/badge';
import { ScheduleBlockRequestModalComponent } from './request-modal/schedule-block-request-modal';
import { ScheduleBlocksService, ScheduleBlock, CreateScheduleBlockDto } from '@app/core/services/schedule-blocks.service';
import { AuthService } from '@app/core/services/auth.service';
import { ModalService } from '@app/core/services/modal.service';
import { RealTimeService, EntityNotification } from '@app/core/services/real-time.service';
import { filter, take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-schedule-blocks',
  standalone: true,
  imports: [CommonModule, ButtonComponent, IconComponent, BadgeComponent, ScheduleBlockRequestModalComponent],
  templateUrl: './schedule-blocks.html',
  styleUrls: ['./schedule-blocks.scss']
})
export class ScheduleBlocksComponent implements OnInit, OnDestroy {
  blocks: ScheduleBlock[] = [];
  isLoading = false;
  isRequestModalOpen = false;

  private scheduleBlocksService = inject(ScheduleBlocksService);
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);
  private realTimeService = inject(RealTimeService);
  
  private realTimeSubscriptions: Subscription[] = [];
  private changesSubscription?: Subscription;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // Aguardar até que o usuário esteja autenticado
    this.authService.authState$
      .pipe(
        filter(state => state.isAuthenticated && state.user !== null),
        take(1)
      )
      .subscribe(() => {
        this.loadBlocks();
        if (this.isBrowser) {
          this.setupRealTimeSubscriptions();
        }
        this.subscribeToChanges();
      });
  }
  
  ngOnDestroy(): void {
    this.realTimeSubscriptions.forEach(sub => sub.unsubscribe());
    if (this.changesSubscription) {
      this.changesSubscription.unsubscribe();
    }
  }
  
  private setupRealTimeSubscriptions(): void {
    const blockEventsSub = this.realTimeService.getEntityEvents$('ScheduleBlock').subscribe(
      (notification: EntityNotification) => {
        this.handleBlockEvent(notification);
      }
    );
    this.realTimeSubscriptions.push(blockEventsSub);
  }

  private handleBlockEvent(notification: EntityNotification): void {
    const user = this.authService.getCurrentUser();
    // Verificar se a atualização é para o usuário atual
    if (notification.data?.professionalId === user?.id || 
        this.blocks.some(b => b.id === notification.entityId)) {
      switch (notification.action) {
        case 'Created':
          this.loadBlocks(true);
          break;
        case 'Updated':
          const updatedIndex = this.blocks.findIndex(b => b.id === notification.entityId);
          if (updatedIndex >= 0 && notification.data) {
            this.blocks[updatedIndex] = { ...this.blocks[updatedIndex], ...notification.data };
            this.cdr.detectChanges();
          } else {
            this.loadBlocks(true);
          }
          break;
        case 'Deleted':
          const deletedIndex = this.blocks.findIndex(b => b.id === notification.entityId);
          if (deletedIndex >= 0) {
            this.blocks.splice(deletedIndex, 1);
            this.cdr.detectChanges();
          }
          break;
      }
    }
  }
  
  private subscribeToChanges(): void {
    // Escutar mudanças notificadas pelo serviço
    this.changesSubscription = this.scheduleBlocksService.blocksChanged$.subscribe(() => {
      console.log('[ScheduleBlocks] Bloqueios mudaram, recarregando...');
      this.loadBlocks(true);
    });
  }

  loadBlocks(silent: boolean = false): void {
    if (!silent) {
      this.isLoading = true;
    }
    
    const user = this.authService.getCurrentUser();
    
    if (!silent) {
      console.log('[ScheduleBlocks] Usuário atual:', user);
    }
    
    if (!user?.id) {
      console.error('[ScheduleBlocks] Usuário não autenticado ao carregar bloqueios');
      this.isLoading = false;
      return;
    }

    const userId = user.id;
    
    if (!silent) {
      console.log('[ScheduleBlocks] Carregando bloqueios para usuário:', userId);
    }

    this.scheduleBlocksService.getScheduleBlocks(userId, undefined, 1, 100).subscribe({
      next: (response) => {
        this.blocks = response.data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erro ao carregar bloqueios:', error);
        if (error.status === 401) {
          console.error('Token de autenticação inválido ou expirado');
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openRequestModal() {
    this.isRequestModalOpen = true;
  }

  closeRequestModal() {
    this.isRequestModalOpen = false;
  }

  handleRequest(data: any) {
    const user = this.authService.getCurrentUser();
    if (!user?.id) {
      console.error('Usuário não autenticado');
      return;
    }

    // Converter datas para formato ISO completo
    const convertToISODate = (dateString: string | null): string | undefined => {
      if (!dateString) return undefined;
      // Adiciona horário midnight UTC para garantir consistência
      return new Date(dateString + 'T00:00:00.000Z').toISOString();
    };

    const dto: CreateScheduleBlockDto = {
      professionalId: user.id,
      type: data.type === 'single' ? 'Single' : 'Range',
      reason: data.reason,
      date: data.type === 'single' ? convertToISODate(data.date) : undefined,
      startDate: data.type === 'range' ? convertToISODate(data.startDate) : undefined,
      endDate: data.type === 'range' ? convertToISODate(data.endDate) : undefined
    };

    console.log('Enviando bloqueio:', dto);

    this.scheduleBlocksService.createScheduleBlock(dto).subscribe({
      next: (block) => {
        // Recarregar blocos para sincronizar com o backend
        this.loadBlocks(true);
        this.closeRequestModal();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erro ao criar bloqueio:', error);
        
        let title = 'Erro ao Criar Bloqueio';
        let message = error.error?.message || 'Erro ao criar bloqueio de agenda';
        
        // Tratamento específico para erro de conflito
        if (error.status === 409) {
          title = 'Conflito de Bloqueio';
          message = 'Já existe um bloqueio de agenda para este período. Por favor, verifique suas solicitações existentes ou escolha outro período.';
        }
        
        this.modalService.alert({
          title: title,
          message: message,
          variant: 'danger'
        }).subscribe();
        this.cdr.detectChanges();
      }
    });
  }

  getStatusVariant(status: string): BadgeVariant {
    const statusMap: Record<string, BadgeVariant> = {
      'Pending': 'warning',
      'Approved': 'success',
      'Rejected': 'error',
      'Expired': 'neutral'
    };
    return statusMap[status] || 'neutral';
  }

  getStatusLabel(status: string): string {
    const labelMap: Record<string, string> = {
      'Pending': 'Pendente',
      'Approved': 'Aprovada',
      'Rejected': 'Negada',
      'Expired': 'Vencido'
    };
    return labelMap[status] || status;
  }

  getTypeLabel(type: string): string {
    return type === 'Single' ? 'Dia Único' : 'Período';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  cancelBlock(block: ScheduleBlock): void {
    this.modalService.confirm({
      title: 'Cancelar Solicitação',
      message: 'Tem certeza que deseja cancelar esta solicitação de bloqueio?',
      variant: 'danger',
      confirmText: 'Sim, Cancelar',
      cancelText: 'Não'
    }).subscribe(result => {
      if (result.confirmed) {
        this.scheduleBlocksService.deleteScheduleBlock(block.id).subscribe({
          next: () => {
            // Remover o bloco da lista
            this.blocks = this.blocks.filter(b => b.id !== block.id);
            // Recarregar imediatamente após cancelar para garantir sincronização
            setTimeout(() => this.loadBlocks(true), 500);
            this.cdr.detectChanges();
            console.log('Bloqueio cancelado com sucesso');
          },
          error: (error) => {
            console.error('Erro ao cancelar bloqueio:', error);
            this.modalService.alert({
              title: 'Erro ao Cancelar',
              message: error.error?.message || 'Erro ao cancelar bloqueio de agenda',
              variant: 'danger'
            }).subscribe();
          }
        });
      }
    });
  }
}
