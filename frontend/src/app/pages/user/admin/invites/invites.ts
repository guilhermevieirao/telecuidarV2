import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { BadgeComponent } from '@app/shared/components/atoms/badge/badge';
import { PaginationComponent } from '@app/shared/components/atoms/pagination/pagination';
import { SearchInputComponent } from '@app/shared/components/atoms/search-input/search-input';
import { FilterSelectComponent, FilterOption } from '@app/shared/components/atoms/filter-select/filter-select';
import { TableHeaderComponent } from '@app/shared/components/atoms/table-header/table-header';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { InvitesService, Invite, InvitesFilter, InvitesSortOptions, InviteStatus, UserRole } from '@app/core/services/invites.service';
import { ModalService } from '@app/core/services/modal.service';
import { BadgeVariant } from '@app/shared/components/atoms/badge/badge';
import { InviteCreateModalComponent } from './invite-create-modal/invite-create-modal';

@Component({
  selector: 'app-invites',
  imports: [
    FormsModule,
    DatePipe,
    IconComponent,
    BadgeComponent,
    PaginationComponent,
    SearchInputComponent,
    FilterSelectComponent,
    TableHeaderComponent,
    ButtonComponent,
    InviteCreateModalComponent
  ],
  templateUrl: './invites.html',
  styleUrl: './invites.scss'
})
export class InvitesComponent {
  invites: Invite[] = [];
  isLoading = false;
  isCreateModalOpen = false;

  // Filtros
  searchTerm = '';
  roleFilter: UserRole | 'all' = 'all';
  statusFilter: InviteStatus | 'all' = 'all';

  roleOptions: FilterOption[] = [
    { value: 'all', label: 'Todos os perfis' },
    { value: 'PATIENT', label: 'Pacientes' },
    { value: 'PROFESSIONAL', label: 'Profissionais' },
    { value: 'ADMIN', label: 'Administradores' }
  ];

  statusOptions: FilterOption[] = [
    { value: 'all', label: 'Todos os status' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'accepted', label: 'Aceitos' },
    { value: 'expired', label: 'Expirados' },
    { value: 'cancelled', label: 'Cancelados' }
  ];

  // Ordenação
  sortField: keyof Invite = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Paginação
  currentPage = 1;
  pageSize = 10;
  totalInvites = 0;
  totalPages = 0;

  private invitesService = inject(InvitesService);
  private modalService = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    afterNextRender(() => {
      this.loadInvites();
    });
  }

  loadInvites(): void {
    this.isLoading = true;

    const filter: InvitesFilter = {
      search: this.searchTerm || undefined,
      role: this.roleFilter,
      status: this.statusFilter
    };

    const sort: InvitesSortOptions = {
      field: this.sortField,
      direction: this.sortDirection
    };

    this.invitesService.getInvites(filter, sort, this.currentPage, this.pageSize)
      .subscribe({
        next: (response) => {
          this.invites = response.data;
          this.totalInvites = response.total;
          this.totalPages = response.totalPages;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Erro ao carregar convites:', error);
          this.isLoading = false;
          this.cdr.detectChanges();
          // Endpoint não implementado no backend ainda
          if (error.status === 404) {
            this.invites = [];
            this.totalInvites = 0;
            this.totalPages = 0;
          }
        }
      });
  }

  onSearch(value: string): void {
    this.currentPage = 1;
    this.loadInvites();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.loadInvites();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadInvites();
  }

  sort(field: string): void {
    const typedField = field as keyof Invite;
    if (this.sortField === typedField) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = typedField;
      this.sortDirection = 'asc';
    }
    this.loadInvites();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadInvites();
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.loadInvites();
  }

  getRoleBadgeVariant(role: UserRole): BadgeVariant {
    const variants: Record<UserRole, BadgeVariant> = {
      PATIENT: 'info',
      PROFESSIONAL: 'primary',
      ADMIN: 'warning'
    };
    return variants[role];
  }

  getStatusBadgeVariant(status: InviteStatus): BadgeVariant {
    const variants: Record<InviteStatus, BadgeVariant> = {
      Pending: 'warning',
      Accepted: 'success',
      Expired: 'error',
      Cancelled: 'neutral'
    };
    return variants[status];
  }

  getStatusLabel(status: InviteStatus): string {
    const labels: Record<InviteStatus, string> = {
      Pending: 'Pendente',
      Accepted: 'Aceito',
      Expired: 'Expirado',
      Cancelled: 'Cancelado'
    };
    return labels[status];
  }

  getRoleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      PATIENT: 'Paciente',
      PROFESSIONAL: 'Profissional',
      ADMIN: 'Administrador'
    };
    return labels[role];
  }

  isExpired(invite: Invite): boolean {
    return new Date(invite.expiresAt) < new Date();
  }

  getInviteByToken(invite: Invite): void {
    this.invitesService.getInviteByToken(invite.token).subscribe({
      next: (inviteDetails) => {
        const link = `${window.location.origin}/registrar?token=${invite.token}`;
        navigator.clipboard.writeText(link).then(() => {
          this.modalService.alert({
            title: 'Link Copiado',
            message: 'O link do convite foi copiado para a área de transferência!',
            variant: 'success'
          });
        });
      }
    });
  }

  resendInvite(invite: Invite): void {
    this.modalService.confirm({
      title: 'Reenviar Convite',
      message: `Deseja reenviar o convite para ${invite.email}?`,
      confirmText: 'Reenviar',
      cancelText: 'Cancelar'
    }).subscribe((result) => {
      if (result.confirmed) {
        this.invitesService.resendInvite(invite.id).subscribe({
          next: () => {
            setTimeout(() => {
              this.cdr.markForCheck();
              this.modalService.alert({
                title: 'Sucesso',
                message: 'Convite reenviado com sucesso!',
                variant: 'success'
              });
            }, 300);
          },
          error: () => {
            setTimeout(() => {
              this.cdr.markForCheck();
              this.modalService.alert({
                title: 'Erro',
                message: 'Erro ao reenviar convite. Tente novamente.',
                variant: 'danger'
              });
            }, 300);
          }
        });
      }
    });
  }

  cancelInvite(invite: Invite): void {
    this.modalService.confirm({
      title: 'Cancelar Convite',
      message: `Tem certeza que deseja cancelar o convite para ${invite.email}?`,
      confirmText: 'Cancelar Convite',
      cancelText: 'Voltar',
      variant: 'warning'
    }).subscribe((result) => {
      if (result.confirmed) {
        this.invitesService.cancelInvite(invite.id).subscribe({
          next: () => {
            this.loadInvites();
            setTimeout(() => {
              this.cdr.markForCheck();
              this.modalService.alert({
                title: 'Sucesso',
                message: 'Convite cancelado com sucesso!',
                variant: 'success'
              });
            }, 300);
          },
          error: () => {
            setTimeout(() => {
              this.cdr.markForCheck();
              this.modalService.alert({
                title: 'Erro',
                message: 'Erro ao cancelar convite. Tente novamente.',
                variant: 'danger'
              });
            }, 300);
          }
        });
      }
    });
  }

  openCreateModal(): void {
    this.isCreateModalOpen = true;
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
  }

  handleCreateInvite(data: { email: string; role: UserRole }): void {
    this.isLoading = true;
    this.invitesService.createInvite({ email: data.email, role: data.role }).subscribe({
      next: (newInvite) => {
        this.loadInvites();
        this.closeCreateModal();
        setTimeout(() => {
          this.cdr.markForCheck();
          this.modalService.alert({
            title: 'Sucesso',
            message: 'Convite criado com sucesso!',
            variant: 'success'
          });
        }, 300);
      },
      error: () => {
        this.isLoading = false;
        setTimeout(() => {
          this.cdr.markForCheck();
          this.modalService.alert({
            title: 'Erro',
            message: 'Erro ao criar convite. Tente novamente.',
            variant: 'danger'
          });
        }, 300);
      }
    });
  }
}
