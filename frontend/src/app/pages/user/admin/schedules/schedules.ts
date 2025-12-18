import { Component, OnInit, inject, afterNextRender, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { FormsModule } from '@angular/forms';
import { PaginationComponent } from '@app/shared/components/atoms/pagination/pagination';
import { SearchInputComponent } from '@app/shared/components/atoms/search-input/search-input';
import { FilterSelectComponent, FilterOption } from '@app/shared/components/atoms/filter-select/filter-select';
import { TableHeaderComponent } from '@app/shared/components/atoms/table-header/table-header';
import { SchedulesService, Schedule, SchedulesFilter, SchedulesSortOptions, ScheduleStatus } from '@app/core/services/schedules.service';
import { ScheduleCreateModalComponent } from '@pages/user/admin/schedules/schedule-create-modal/schedule-create-modal';
import { ScheduleViewModalComponent } from '@pages/user/admin/schedules/schedule-view-modal/schedule-view-modal';
import { ModalService } from '@app/core/services/modal.service';
import { BadgeComponent } from '@app/shared/components/atoms/badge/badge';
import { ScheduleDaysPipe } from '@app/core/pipes/schedule-days.pipe';

@Component({
  selector: 'app-schedules',
  imports: [CommonModule, IconComponent, FormsModule, PaginationComponent, SearchInputComponent, FilterSelectComponent, TableHeaderComponent, ScheduleCreateModalComponent, ScheduleViewModalComponent, BadgeComponent, ScheduleDaysPipe],
  templateUrl: './schedules.html',
  styleUrl: './schedules.scss'
})
export class SchedulesComponent implements OnInit {
  schedules: Schedule[] = [];
  
  searchTerm = '';
  statusFilter: ScheduleStatus | 'all' = 'all';

  statusOptions: FilterOption[] = [
    { value: 'all', label: 'Todos os status' },
    { value: 'active', label: 'Ativas' },
    { value: 'inactive', label: 'Inativas' }
  ];
  
  sortField: keyof Schedule = 'professionalName';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalItems = 0;

  isCreateModalOpen = false;
  isViewModalOpen = false;
  selectedSchedule: Schedule | null = null;

  isLoading = false;
  private cdr = inject(ChangeDetectorRef);

  constructor(
    private schedulesService: SchedulesService,
    private modalService: ModalService
  ) {
    afterNextRender(() => {
      this.loadSchedules();
    });
  }

  ngOnInit(): void {}

  loadSchedules(): void {
    this.isLoading = true;
    const filter: SchedulesFilter = {
      search: this.searchTerm || undefined,
      status: this.statusFilter
    };

    this.schedulesService.getSchedules(filter, this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        this.schedules = response.data;
        this.totalItems = response.total;
        this.totalPages = response.totalPages;
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Erro ao carregar agendas:', error);
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
        this.modalService.alert({
          title: 'Erro',
          message: 'Não foi possível carregar as agendas. Tente novamente.',
          variant: 'danger'
        });
      }
    });
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.currentPage = 1;
    this.loadSchedules();
  }

  onStatusFilterChange(status: string): void {
    const option = this.statusOptions.find(o => o.value === status);
    if (option) {
      this.statusFilter = status as ScheduleStatus | 'all';
      this.currentPage = 1;
      this.loadSchedules();
    }
  }

  onSort(field: any): void {
    const typedField = field as keyof Schedule;
    if (this.sortField === typedField) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = typedField;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1;
    this.loadSchedules();
  }

  onPageChange(page: any): void {
    if (typeof page === 'number') {
      this.currentPage = page;
      this.loadSchedules();
    }
  }

  openCreateModal(): void {
    this.selectedSchedule = null;
    this.isCreateModalOpen = true;
  }

  onCreateModalClose(): void {
    this.isCreateModalOpen = false;
    this.selectedSchedule = null;
  }

  onScheduleCreated(schedule: Schedule): void {
    this.isCreateModalOpen = false;
    this.currentPage = 1;
    setTimeout(() => {
      this.loadSchedules();
    });
    this.modalService.alert({
      title: 'Sucesso',
      message: `Agenda para ${schedule.professionalName} criada com sucesso!`,
      variant: 'success'
    });
  }

  openViewModal(schedule: Schedule): void {
    this.selectedSchedule = schedule;
    this.isViewModalOpen = true;
  }

  onViewModalClose(): void {
    this.isViewModalOpen = false;
    this.selectedSchedule = null;
  }

  openEditModal(schedule: Schedule): void {
    this.selectedSchedule = schedule;
    // Reutiliza o modal de criação, mas em modo edição
    this.isCreateModalOpen = true;
  }

  onScheduleUpdated(schedule: Schedule): void {
    this.isCreateModalOpen = false;
    setTimeout(() => {
      this.loadSchedules();
    });
    this.modalService.alert({
      title: 'Sucesso',
      message: `Agenda para ${schedule.professionalName} atualizada com sucesso!`,
      variant: 'success'
    });
  }

  toggleScheduleStatus(schedule: Schedule): void {
    const newStatus = schedule.status === 'Active' ? 'Desativar' : 'Ativar';
    
    this.modalService.confirm({
      title: `${newStatus} Agenda`,
      message: `Tem certeza que deseja ${newStatus.toLowerCase()} a agenda de ${schedule.professionalName}?`,
      confirmText: newStatus,
      cancelText: 'Cancelar'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.isLoading = true;
        this.schedulesService.toggleScheduleStatus(schedule.id).subscribe({
          next: () => {
            setTimeout(() => {
              this.loadSchedules();
            });
            this.modalService.alert({
              title: 'Sucesso',
              message: `Agenda ${newStatus.toLowerCase()} com sucesso!`,
              variant: 'success'
            });
          },
          error: (error) => {
            console.error('Erro ao alterar status:', error);
            setTimeout(() => {
              this.isLoading = false;
              this.cdr.detectChanges();
            });
            this.modalService.alert({
              title: 'Erro',
              message: 'Não foi possível alterar o status da agenda.',
              variant: 'danger'
            });
          }
        });
      }
    });
  }

  deleteSchedule(schedule: Schedule): void {
    this.modalService.confirm({
      title: 'Excluir Agenda',
      message: `Tem certeza que deseja excluir a agenda de ${schedule.professionalName}? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'danger'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.isLoading = true;
        this.schedulesService.deleteSchedule(schedule.id).subscribe({
          next: () => {
            setTimeout(() => {
              this.loadSchedules();
            });
            this.modalService.alert({
              title: 'Sucesso',
              message: 'Agenda excluída com sucesso!',
              variant: 'success'
            });
          },
          error: (error) => {
            console.error('Erro ao excluir:', error);
            setTimeout(() => {
              this.isLoading = false;
              this.cdr.detectChanges();
            });
            this.modalService.alert({
              title: 'Erro',
              message: 'Não foi possível excluir a agenda.',
              variant: 'danger'
            });
          }
        });
      }
    });
  }

  getTimeRange(schedule: Schedule): string {
    const firstWorkingDay = schedule.daysConfig.find(d => d.isWorking);
    if (firstWorkingDay && firstWorkingDay.customized && firstWorkingDay.timeRange) {
      return firstWorkingDay.timeRange.startTime + ' - ' + firstWorkingDay.timeRange.endTime;
    }
    return schedule.globalConfig.timeRange.startTime + ' - ' + schedule.globalConfig.timeRange.endTime;
  }

  getBreakTime(schedule: Schedule): string {
    const firstWorkingDay = schedule.daysConfig.find(d => d.isWorking);
    if (firstWorkingDay && firstWorkingDay.customized && firstWorkingDay.breakTime) {
      if (firstWorkingDay.breakTime.startTime && firstWorkingDay.breakTime.endTime) {
        return firstWorkingDay.breakTime.startTime + ' - ' + firstWorkingDay.breakTime.endTime;
      }
    }
    if (schedule.globalConfig.breakTime && schedule.globalConfig.breakTime.startTime && schedule.globalConfig.breakTime.endTime) {
      return schedule.globalConfig.breakTime.startTime + ' - ' + schedule.globalConfig.breakTime.endTime;
    }
    return 'Nenhuma';
  }

  getInterval(schedule: Schedule): string {
    const firstWorkingDay = schedule.daysConfig.find(d => d.isWorking);
    if (firstWorkingDay && firstWorkingDay.customized && firstWorkingDay.intervalBetweenConsultations !== undefined) {
      return firstWorkingDay.intervalBetweenConsultations > 0 
        ? `${firstWorkingDay.intervalBetweenConsultations}min` 
        : 'Nenhum';
    }
    return schedule.globalConfig.intervalBetweenConsultations > 0 
      ? `${schedule.globalConfig.intervalBetweenConsultations}min` 
      : 'Nenhum';
  }

  getDuration(schedule: Schedule): string {
    const firstWorkingDay = schedule.daysConfig.find(d => d.isWorking);
    if (firstWorkingDay && firstWorkingDay.customized && firstWorkingDay.consultationDuration !== undefined) {
      return `${firstWorkingDay.consultationDuration}min`;
    }
    return `${schedule.globalConfig.consultationDuration}min`;
  }

  getValidity(schedule: Schedule): string {
    const startDate = new Date(schedule.validityStartDate).toLocaleDateString('pt-BR');
    const endDate = schedule.validityEndDate 
      ? new Date(schedule.validityEndDate).toLocaleDateString('pt-BR')
      : 'Indefinida';
    return `${startDate} - ${endDate}`;
  }

  hasCustomizedDays(schedule: Schedule): boolean {
    return schedule.daysConfig.some(day => day.customized === true);
  }

  hasCustomizedTimeRange(schedule: Schedule): boolean {
    return schedule.daysConfig.some(day => {
      if (!day.customized || !day.isWorking) return false;
      if (!day.timeRange) return false;
      
      const globalStart = schedule.globalConfig.timeRange.startTime;
      const globalEnd = schedule.globalConfig.timeRange.endTime;
      
      return day.timeRange.startTime !== globalStart || day.timeRange.endTime !== globalEnd;
    });
  }

  hasCustomizedBreak(schedule: Schedule): boolean {
    return schedule.daysConfig.some(day => {
      if (!day.customized || !day.isWorking) return false;
      
      const hasGlobalBreak = schedule.globalConfig.breakTime !== undefined && schedule.globalConfig.breakTime !== null;
      const hasDayBreak = day.breakTime !== undefined && day.breakTime !== null;
      
      if (hasGlobalBreak && hasDayBreak) {
        return day.breakTime!.startTime !== schedule.globalConfig.breakTime!.startTime || 
               day.breakTime!.endTime !== schedule.globalConfig.breakTime!.endTime;
      }
      
      return hasGlobalBreak !== hasDayBreak;
    });
  }
}
