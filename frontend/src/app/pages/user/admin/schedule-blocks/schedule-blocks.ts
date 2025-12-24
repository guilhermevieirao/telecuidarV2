import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TableHeaderComponent } from '@shared/components/atoms/table-header/table-header';
import { BadgeComponent } from '@shared/components/atoms/badge/badge';

import { PaginationComponent } from '@shared/components/atoms/pagination/pagination';
import { SearchInputComponent } from '@shared/components/atoms/search-input/search-input';
import { FilterSelectComponent, FilterOption } from '@shared/components/atoms/filter-select/filter-select';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { ModalService } from '@core/services/modal.service';
import { WaitTimePipe } from '@core/pipes/wait-time.pipe';
import { ScheduleBlocksService, ScheduleBlock, ScheduleBlockStatus } from '@core/services/schedule-blocks.service';
import { AuthService } from '@core/services/auth.service';
import { RealTimeService, EntityNotification } from '@core/services/real-time.service';
import { filter, take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-schedule-blocks',
  standalone: true,
  imports: [CommonModule, TableHeaderComponent, BadgeComponent, PaginationComponent, SearchInputComponent, FilterSelectComponent, IconComponent, WaitTimePipe],
  templateUrl: './schedule-blocks.html',
  styleUrl: './schedule-blocks.scss'
})
export class ScheduleBlocksComponent implements OnInit, OnDestroy {
  blocks: ScheduleBlock[] = [];

  searchTerm = '';
  statusFilter = 'all';
  statusOptions = [
    { value: 'all', label: 'Todos os status' },
    { value: 'Pending', label: 'Pendentes' },
    { value: 'Approved', label: 'Aprovadas' },
    { value: 'Rejected', label: 'Negadas' },
    { value: 'Expired', label: 'Expirados' }
  ];
  sortField = 'professionalName';
  sortDirection: 'asc' | 'desc' | undefined = 'asc';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalItems = 0;
  isLoading = false;
  
  private realTimeSubscriptions: Subscription[] = [];
  private changesSubscription?: Subscription;
  private isBrowser: boolean;

  private realTimeService = inject(RealTimeService);

  constructor(
    private cdr: ChangeDetectorRef,
    private modal: ModalService,
    private scheduleBlocksService: ScheduleBlocksService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
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
        console.log('[Admin ScheduleBlocks] Usuário autenticado, carregando bloqueios');
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
          this.totalItems--;
          this.cdr.detectChanges();
        }
        break;
    }
  }
  
  private subscribeToChanges(): void {
    // Escutar mudanças notificadas pelo serviço
    this.changesSubscription = this.scheduleBlocksService.blocksChanged$.subscribe(() => {
      console.log('[Admin ScheduleBlocks] Bloqueios mudaram, recarregando...');
      this.loadBlocks(true);
    });
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.currentPage = 1;
    this.loadBlocks();
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter = status;
    this.currentPage = 1;
    this.loadBlocks();
  }

  onSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1;
    this.loadBlocks();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadBlocks();
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.loadBlocks();
  }

  loadBlocks(silent: boolean = false): void {
    if (!silent) {
      this.isLoading = true;
    }
    
    const status = this.statusFilter !== 'all' ? this.statusFilter as ScheduleBlockStatus : undefined;
    
    if (!silent) {
      console.log('[Admin ScheduleBlocks] Carregando bloqueios:', { status, page: this.currentPage, pageSize: this.pageSize });
    }
    
    // Buscar todos os bloqueios (sem filtrar por profissional específico)
    this.scheduleBlocksService.getScheduleBlocks(undefined, status, this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        if (!silent) {
          console.log('[Admin ScheduleBlocks] Bloqueios carregados:', response);
        }
        this.blocks = response.data;
        this.totalItems = response.total;
        this.totalPages = response.totalPages;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('[Admin ScheduleBlocks] Erro ao carregar bloqueios:', error);
        this.blocks = [];
        this.isLoading = false;
        this.totalItems = 0;
        this.totalPages = 0;
        this.cdr.detectChanges();
      }
    });
  }

  getStatusBadge(status: string): { variant: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral', label: string } {
    switch (status) {
      case 'Pending': return { variant: 'warning', label: 'Pendente' };
      case 'Approved': return { variant: 'success', label: 'Aprovada' };
      case 'Rejected': return { variant: 'error', label: 'Negada' };
      case 'Expired': return { variant: 'neutral', label: 'Expirado' };
      default: return { variant: 'neutral', label: status };
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  getWaitTime(createdAt: string): number {
    const now = new Date();
    const created = new Date(createdAt);
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  openDetails(block: ScheduleBlock) {
    const dateInfo = block.type === 'Single'
      ? this.formatDate(block.date!)
      : `${this.formatDate(block.startDate!)} até ${this.formatDate(block.endDate!)}`;

    this.modal.open({
      title: 'Detalhes do Bloqueio',
      htmlMessage:
        `<div style='line-height:1.7'>`
        + `<strong>Profissional:</strong> ${block.professionalName}<br>`
        + `<strong>Data do Bloqueio:</strong> ${dateInfo}<br>`
        + `<strong>Motivo:</strong> ${block.reason}<br>`
        + `<strong>Status:</strong> ${this.getStatusBadge(block.status).label}<br>`
        + `<strong>Data da Solicitação:</strong> ${this.formatDate(block.createdAt)}<br>`
        + `<strong>Tempo de Espera:</strong> ${this.getWaitTime(block.createdAt)} dia(s)<br>`
        + (block.rejectionReason ? `<strong>Justificativa da Negativa:</strong> ${block.rejectionReason}<br>` : '')
        + (block.approvedByName ? `<strong>Aprovado por:</strong> ${block.approvedByName}<br>` : '')
        + (block.approvedAt ? `<strong>Data da Aprovação:</strong> ${this.formatDate(block.approvedAt)}<br>` : '')
        + `</div>`,
      type: 'alert',
      variant: block.status === 'Pending' ? 'warning' : (block.status === 'Approved' ? 'success' : (block.status === 'Rejected' ? 'danger' : undefined)),
      confirmText: 'Fechar',
    }).subscribe();
  }

  approveBlock(block: ScheduleBlock) {
    const user = this.authService.getCurrentUser();
    if (!user?.id) {
      console.error('Usuário não autenticado');
      return;
    }

    this.modal.confirm({
      title: 'Aprovar Bloqueio',
      message: 'Tem certeza que deseja aprovar esta solicitação de bloqueio?',
      variant: 'success',
      confirmText: 'Aprovar',
      cancelText: 'Cancelar',
    }).subscribe(result => {
      if (result.confirmed) {
        this.scheduleBlocksService.approveScheduleBlock(block.id, { approvedBy: user.id }).subscribe({
          next: (updatedBlock) => {
            // Atualizar o bloco na lista
            const index = this.blocks.findIndex(b => b.id === block.id);
            if (index !== -1) {
              this.blocks[index] = updatedBlock;
            }
            // Recarregar imediatamente para garantir sincronização com outros usuários
            setTimeout(() => this.loadBlocks(true), 500);
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Erro ao aprovar bloqueio:', error);
            this.modal.alert({
              title: 'Erro ao Aprovar',
              message: error.error?.message || 'Erro ao aprovar bloqueio',
              variant: 'danger'
            }).subscribe();
          }
        });
      }
    });
  }

  denyBlock(block: ScheduleBlock) {
    const user = this.authService.getCurrentUser();
    if (!user?.id) {
      console.error('Usuário não autenticado');
      return;
    }

    this.modal.prompt({
      title: 'Negar Bloqueio',
      message: 'Tem certeza que deseja negar esta solicitação de bloqueio? Por favor, forneça uma justificativa.',
      variant: 'danger',
      confirmText: 'Negar Bloqueio',
      cancelText: 'Cancelar',
      prompt: {
        label: 'Justificativa',
        placeholder: 'Ex: Conflito de agenda, etc.',
        required: true
      }
    }).subscribe(result => {
      if (result.confirmed && result.promptValue) {
        this.scheduleBlocksService.rejectScheduleBlock(block.id, {
          rejectedBy: user.id,
          rejectionReason: result.promptValue
        }).subscribe({
          next: (updatedBlock) => {
            // Atualizar o bloco na lista
            const index = this.blocks.findIndex(b => b.id === block.id);
            if (index !== -1) {
              this.blocks[index] = updatedBlock;
            }
            // Recarregar imediatamente para garantir sincronização com outros usuários
            setTimeout(() => this.loadBlocks(true), 500);
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Erro ao rejeitar bloqueio:', error);
            this.modal.alert({
              title: 'Erro ao Rejeitar',
              message: error.error?.message || 'Erro ao rejeitar bloqueio',
              variant: 'danger'
            }).subscribe();
          }
        });
      }
    });
  }
}
