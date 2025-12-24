import { Component, OnInit, OnDestroy, inject, afterNextRender, ChangeDetectorRef, ChangeDetectionStrategy, PLATFORM_ID, Inject } from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { FormsModule } from '@angular/forms';
import { PaginationComponent } from '@app/shared/components/atoms/pagination/pagination';
import { SearchInputComponent } from '@app/shared/components/atoms/search-input/search-input';
import { FilterSelectComponent, FilterOption } from '@app/shared/components/atoms/filter-select/filter-select';
import { TableHeaderComponent } from '@app/shared/components/atoms/table-header/table-header';
import { SpecialtiesService, Specialty, SpecialtiesFilter, SpecialtiesSortOptions, SpecialtyStatus } from '@app/core/services/specialties.service';
import { SpecialtyStatusPipe } from '@app/core/pipes/specialty-status.pipe';
import { SpecialtyCreateModalComponent } from '@pages/user/admin/specialties/specialty-create-modal/specialty-create-modal';
import { SpecialtyEditModalComponent } from '@pages/user/admin/specialties/specialty-edit-modal/specialty-edit-modal';
import { AssignSpecialtyModalComponent } from '@pages/user/admin/specialties/assign-specialty-modal/assign-specialty-modal';
import { ModalService } from '@app/core/services/modal.service';
import { UsersService } from '@app/core/services/users.service';
import { RealTimeService, EntityNotification } from '@app/core/services/real-time.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-specialties',
  imports: [IconComponent, FormsModule, DatePipe, SpecialtyStatusPipe, PaginationComponent, SearchInputComponent, FilterSelectComponent, TableHeaderComponent, SpecialtyCreateModalComponent, SpecialtyEditModalComponent, AssignSpecialtyModalComponent],
  templateUrl: './specialties.html',
  styleUrl: './specialties.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpecialtiesComponent implements OnInit, OnDestroy {
  specialties: Specialty[] = [];
  filteredSpecialties: Specialty[] = [];
  
  searchTerm = '';
  statusFilter: SpecialtyStatus | 'all' = 'all';

  statusOptions: FilterOption[] = [
    { value: 'all', label: 'Todos os status' },
    { value: 'active', label: 'Ativas' },
    { value: 'inactive', label: 'Inativas' }
  ];
  
  sortField: keyof Specialty = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalItems = 0;

  isCreateModalOpen = false;
  isEditModalOpen = false;
  isAssignModalOpen = false;
  selectedSpecialty: Specialty | null = null;

  isLoading = false;

  private cdr = inject(ChangeDetectorRef);
  private realTimeService = inject(RealTimeService);
  private realTimeSubscriptions: Subscription[] = [];
  private isBrowser: boolean;

  constructor(
    private specialtiesService: SpecialtiesService,
    private usersService: UsersService,
    private modalService: ModalService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    afterNextRender(() => {
      this.loadSpecialties();
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
    const specialtyEventsSub = this.realTimeService.getEntityEvents$('Specialty').subscribe(
      (notification: EntityNotification) => {
        this.handleSpecialtyEvent(notification);
      }
    );
    this.realTimeSubscriptions.push(specialtyEventsSub);
  }

  private handleSpecialtyEvent(notification: EntityNotification): void {
    switch (notification.action) {
      case 'Created':
        this.loadSpecialties();
        break;
      case 'Updated':
        const updatedIndex = this.specialties.findIndex(s => s.id === notification.entityId);
        if (updatedIndex >= 0 && notification.data) {
          this.specialties[updatedIndex] = { ...this.specialties[updatedIndex], ...notification.data };
          this.cdr.markForCheck();
        } else {
          this.loadSpecialties();
        }
        break;
      case 'Deleted':
        const deletedIndex = this.specialties.findIndex(s => s.id === notification.entityId);
        if (deletedIndex >= 0) {
          this.specialties.splice(deletedIndex, 1);
          this.totalItems--;
          this.cdr.markForCheck();
        }
        break;
    }
  }

  onSearch(value: string): void {
    this.currentPage = 1;
    this.loadSpecialties();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.loadSpecialties();
  }

  loadSpecialties(): void {
    this.isLoading = true;
    
    const filter: SpecialtiesFilter = {
      search: this.searchTerm,
      status: this.statusFilter
    };

    const sort: SpecialtiesSortOptions = {
      field: this.sortField,
      direction: this.sortDirection
    };

    this.specialtiesService.getSpecialties(filter, sort, this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        this.specialties = response.data;
        this.totalItems = response.total;
        this.totalPages = response.totalPages;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
        error: () => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadSpecialties();
  }

  onSort(field: string): void {
    const typedField = field as keyof Specialty;
    if (this.sortField === typedField) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = typedField;
      this.sortDirection = 'asc';
    }
    this.loadSpecialties();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadSpecialties();
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.loadSpecialties();
  }

  getSortIcon(field: keyof Specialty): 'chevron-up' | 'chevron-down' | 'chevrons-up-down' {
    if (this.sortField !== field) return 'chevrons-up-down';
    return this.sortDirection === 'asc' ? 'chevron-up' : 'chevron-down';
  }

  createSpecialty(): void {
    this.isCreateModalOpen = true;
  }

  editSpecialty(specialty: Specialty): void {
    this.selectedSpecialty = specialty;
    this.isEditModalOpen = true;
  }

  deleteSpecialty(specialty: Specialty): void {
    this.modalService.confirm({
      title: 'Excluir Especialidade',
      message: `Tem certeza que deseja excluir a especialidade "${specialty.name}"?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'danger'
    }).subscribe((result) => {
      if (result.confirmed) {
        this.specialtiesService.deleteSpecialty(specialty.id).subscribe({
          next: () => {
            this.modalService.alert({
              title: 'Sucesso',
              message: 'Especialidade excluída com sucesso!',
              variant: 'success'
            });
            // Agendar para o próximo ciclo de detecção para evitar ExpressionChangedAfterItHasBeenCheckedError
            setTimeout(() => {
              this.loadSpecialties();
            });
          },
          error: () => {
            this.modalService.alert({
              title: 'Erro',
              message: 'Erro ao excluir especialidade. Tente novamente.',
              variant: 'danger'
            });
          }
        });
      }
    });
  }

  toggleStatus(specialty: Specialty): void {
    const newStatus = specialty.status === 'Active' ? 'inativa' : 'ativa';
    this.modalService.confirm({
      title: `${specialty.status === 'Active' ? 'Desativar' : 'Ativar'} Especialidade`,
      message: `Tem certeza que deseja ${specialty.status === 'Active' ? 'desativar' : 'ativar'} a especialidade "${specialty.name}"?`,
      confirmText: specialty.status === 'Active' ? 'Desativar' : 'Ativar',
      cancelText: 'Cancelar',
      variant: specialty.status === 'Active' ? 'warning' : 'success'
    }).subscribe((result) => {
      if (result.confirmed) {
        this.specialtiesService.toggleSpecialtyStatus(specialty.id, specialty.status).subscribe({
          next: () => {
            this.modalService.alert({
              title: 'Sucesso',
              message: `Especialidade ${newStatus} com sucesso!`,
              variant: 'success'
            });
            // Agendar para o próximo ciclo de detecção para evitar ExpressionChangedAfterItHasBeenCheckedError
            setTimeout(() => {
              this.loadSpecialties();
            });
          },
          error: () => {
            this.modalService.alert({
              title: 'Erro',
              message: 'Erro ao alterar status. Tente novamente.',
              variant: 'danger'
            });
          }
        });
      }
    });
  }

  onCreateModalClose(): void {
    this.isCreateModalOpen = false;
  }

  onEditModalClose(): void {
    this.isEditModalOpen = false;
    this.selectedSpecialty = null;
  }

  assignSpecialty(specialty: Specialty): void {
    this.selectedSpecialty = specialty;
    this.isAssignModalOpen = true;
  }

  onAssignModalClose(): void {
    this.isAssignModalOpen = false;
    this.selectedSpecialty = null;
  }

  onSpecialtyAssigned(data: { userId: string; specialtyId: string }): void {
    this.usersService.updateUser(data.userId, { 
      professionalProfile: { specialtyId: data.specialtyId } 
    }).subscribe({
      next: () => {
        this.modalService.alert({
          title: 'Sucesso',
          message: 'Especialidade atribuída ao profissional com sucesso!',
          variant: 'success'
        });
        this.isAssignModalOpen = false;
        this.selectedSpecialty = null;
      },
      error: () => {
        this.modalService.alert({
          title: 'Erro',
          message: 'Erro ao atribuir especialidade. Tente novamente.',
          variant: 'danger'
        });
      }
    });
  }

  onSpecialtyCreated(specialtyData: { name: string; description: string; status: SpecialtyStatus }): void {
    this.specialtiesService.createSpecialty(specialtyData).subscribe({
      next: () => {
        this.modalService.alert({
          title: 'Sucesso',
          message: 'Especialidade criada com sucesso!',
          variant: 'success'
        });
        this.isCreateModalOpen = false;
        // Agendar para o próximo ciclo de detecção para evitar ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
          this.loadSpecialties();
        });
      },
      error: () => {
        this.modalService.alert({
          title: 'Erro',
          message: 'Erro ao criar especialidade. Tente novamente.',
          variant: 'danger'
        });
      }
    });
  }

  onSpecialtyUpdated(updates: Partial<Specialty>): void {
    if (this.selectedSpecialty) {
      this.specialtiesService.updateSpecialty(this.selectedSpecialty.id, updates).subscribe({
        next: () => {
          this.modalService.alert({
            title: 'Sucesso',
            message: 'Especialidade atualizada com sucesso!',
            variant: 'success'
          });
          this.isEditModalOpen = false;
          this.selectedSpecialty = null;
          // Agendar para o próximo ciclo de detecção para evitar ExpressionChangedAfterItHasBeenCheckedError
          setTimeout(() => {
            this.loadSpecialties();
          });
        },
        error: () => {
          this.modalService.alert({
            title: 'Erro',
            message: 'Erro ao atualizar especialidade. Tente novamente.',
            variant: 'danger'
          });
        }
      });
    }
  }
}
