import { Component, afterNextRender, inject, ChangeDetectorRef, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { BadgeComponent } from '@app/shared/components/atoms/badge/badge';
import { PaginationComponent } from '@app/shared/components/atoms/pagination/pagination';
import { SearchInputComponent } from '@app/shared/components/atoms/search-input/search-input';
import { FilterSelectComponent, FilterOption } from '@app/shared/components/atoms/filter-select/filter-select';
import { TableHeaderComponent } from '@app/shared/components/atoms/table-header/table-header';
import { AuditLogsService, AuditLog, AuditLogsFilter, AuditLogsSortOptions, AuditActionType } from '@app/core/services/audit-logs.service';
import { UserRolePipe } from '@app/core/pipes/user-role.pipe';
import { AuditLogDetailModalComponent } from './audit-log-detail-modal/audit-log-detail-modal';
import { RealTimeService, EntityNotification } from '@app/core/services/real-time.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-audit-logs',
  imports: [FormsModule, IconComponent, BadgeComponent, DatePipe, UserRolePipe, PaginationComponent, SearchInputComponent, FilterSelectComponent, TableHeaderComponent, AuditLogDetailModalComponent],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.scss'
})
export class AuditLogsComponent implements OnInit, OnDestroy {
  logs: AuditLog[] = [];
  isLoading = false;
  selectedLog: AuditLog | null = null;

  // Filtros
  searchTerm = '';
  selectedAction: AuditActionType | 'all' = 'all';
  selectedEntityType: string | 'all' = 'all';
  startDate = '';
  endDate = '';

  // Paginação
  currentPage = 1;
  pageSize = 10;
  totalPages = 0;
  totalItems = 0;

  // Ordenação
  sortField: keyof AuditLog = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Dropdowns
  isActionDropdownOpen = false;
  isEntityTypeDropdownOpen = false;

  // Opções
  actionOptions: FilterOption[] = [
    { value: 'all', label: 'Todas as Ações' },
    { value: 'create', label: 'Criar' },
    { value: 'update', label: 'Atualizar' },
    { value: 'delete', label: 'Excluir' },
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' },
    { value: 'view', label: 'Visualizar' },
    { value: 'export', label: 'Exportar' }
  ];

  entityTypeOptions: FilterOption[] = [
    { value: 'all', label: 'Todos os Tipos' },
    { value: 'User', label: 'Usuário' },
    { value: 'Specialty', label: 'Especialidade' },
    { value: 'Appointment', label: 'Consulta' },
    { value: 'Schedule', label: 'Agenda' },
    { value: 'Notification', label: 'Notificação' },
    { value: 'Attachment', label: 'Anexo' },
    { value: 'Invite', label: 'Convite' }
  ];

  private auditLogsService = inject(AuditLogsService);
  private cdr = inject(ChangeDetectorRef);
  private realTimeService = inject(RealTimeService);
  private realTimeSubscriptions: Subscription[] = [];
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    afterNextRender(() => {
      this.loadLogs();
    });
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.setupRealTimeSubscriptions();
    }
  }

  ngOnDestroy(): void {
    this.realTimeSubscriptions.forEach(sub => sub.unsubscribe());
  }

  private setupRealTimeSubscriptions(): void {
    // Escutar novos logs de auditoria
    const auditLogEventsSub = this.realTimeService.getEntityEvents$('AuditLog').subscribe(
      (notification: EntityNotification) => {
        if (notification.action === 'Created') {
          this.loadLogs();
        }
      }
    );
    this.realTimeSubscriptions.push(auditLogEventsSub);
  }

  onSearch(value?: string): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading = true;

    const filter: AuditLogsFilter = {
      search: this.searchTerm || undefined,
      action: this.selectedAction,
      entityType: this.selectedEntityType,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined
    };

    const sort: AuditLogsSortOptions = {
      field: this.sortField,
      direction: this.sortDirection
    };

    this.auditLogsService.getAuditLogs(filter, sort, this.currentPage, this.pageSize)
      .subscribe({
        next: (response) => {
          this.logs = response.data;
          this.totalPages = response.totalPages;
          this.totalItems = response.total;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoading = false;
        }
      });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  onSort(field: string): void {
    const typedField = field as keyof AuditLog;
    if (this.sortField === typedField) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = typedField;
      this.sortDirection = 'asc';
    }
    this.loadLogs();
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadLogs();
    }
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadLogs();
  }

  onExportPDF(): void {
    this.isLoading = true;

    const filter: AuditLogsFilter = {
      search: this.searchTerm || undefined,
      action: this.selectedAction,
      entityType: this.selectedEntityType,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined
    };

    this.auditLogsService.exportToPDF(filter).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit-logs-${new Date().toISOString()}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedAction = 'all';
    this.selectedEntityType = 'all';
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;
    this.loadLogs();
  }

  getSortIcon(field: keyof AuditLog): 'chevrons-up-down' | 'chevron-up' | 'chevron-down' {
    if (this.sortField !== field) return 'chevrons-up-down';
    return this.sortDirection === 'asc' ? 'chevron-up' : 'chevron-down';
  }

  getActionBadgeVariant(action: string): 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral' {
    const variants: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
      'create': 'success',
      'update': 'info',
      'delete': 'error',
      'login': 'primary',
      'logout': 'neutral',
      'view': 'info',
      'export': 'warning'
    };
    return variants[action] || 'neutral';
  }

  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      'create': 'Criar',
      'update': 'Atualizar',
      'delete': 'Excluir',
      'login': 'Login',
      'logout': 'Logout',
      'view': 'Visualizar',
      'export': 'Exportar'
    };
    return labels[action] || action;
  }

  getLogDescription(log: AuditLog): string {
    const actionLabel = this.getActionLabel(log.action);
    return `${actionLabel} ${log.entityType}`;
  }

  viewDetails(log: AuditLog): void {
    this.selectedLog = log;
  }

  closeModal(): void {
    this.selectedLog = null;
  }
}