import { Component, afterNextRender, inject, ChangeDetectorRef, OnDestroy, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { BadgeComponent } from '@app/shared/components/atoms/badge/badge';
import { PaginationComponent } from '@app/shared/components/atoms/pagination/pagination';
import { SearchInputComponent } from '@app/shared/components/atoms/search-input/search-input';
import { FilterSelectComponent, FilterOption } from '@app/shared/components/atoms/filter-select/filter-select';
import { TableHeaderComponent } from '@app/shared/components/atoms/table-header/table-header';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { InvitesService, Invite, InvitesFilter, InvitesSortOptions, InviteStatus, UserRole } from '@app/core/services/invites.service';
import { ModalService } from '@app/core/services/modal.service';
import { RealTimeService, EntityNotification } from '@app/core/services/real-time.service';
import { BadgeVariant } from '@app/shared/components/atoms/badge/badge';
import { InviteCreateModalComponent } from './invite-create-modal/invite-create-modal';
import { Subscription } from 'rxjs';

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
    InviteCreateModalComponent
  ],
  templateUrl: './invites.html',
  styleUrl: './invites.scss'
})
export class InvitesComponent implements OnInit, OnDestroy {
  invites: Invite[] = [];
  isLoading = false;
  isCreateModalOpen = false;
  private realTimeSubscriptions: Subscription[] = [];
  private isBrowser: boolean;

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
  private realTimeService = inject(RealTimeService);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    afterNextRender(() => {
      this.loadInvites();
    });
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.setupRealTimeSubscriptions();
    }
  }

  private setupRealTimeSubscriptions(): void {
    const inviteEventsSub = this.realTimeService.getEntityEvents$('Invite').subscribe(
      (notification: EntityNotification) => {
        this.handleInviteEvent(notification);
      }
    );
    this.realTimeSubscriptions.push(inviteEventsSub);
  }

  private handleInviteEvent(notification: EntityNotification): void {
    switch (notification.action) {
      case 'Created':
        this.loadInvites();
        break;
      case 'Updated':
        const updatedIndex = this.invites.findIndex(i => i.id === notification.entityId);
        if (updatedIndex >= 0 && notification.data) {
          this.invites[updatedIndex] = { ...this.invites[updatedIndex], ...notification.data };
          this.cdr.detectChanges();
        } else {
          this.loadInvites();
        }
        break;
      case 'Deleted':
        const deletedIndex = this.invites.findIndex(i => i.id === notification.entityId);
        if (deletedIndex >= 0) {
          this.invites.splice(deletedIndex, 1);
          this.totalInvites--;
          this.cdr.detectChanges();
        }
        break;
    }
  }

  ngOnDestroy(): void {
    this.realTimeSubscriptions.forEach(sub => sub.unsubscribe());
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
    const link = `${window.location.origin}/registrar?token=${invite.token}`;
    navigator.clipboard.writeText(link).then(() => {
      this.modalService.alert({
        title: 'Link Copiado',
        message: 'O link do convite foi copiado para a área de transferência!',
        variant: 'success'
      });
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

  deleteInvite(invite: Invite): void {
    this.modalService.confirm({
      title: 'Excluir Convite',
      message: `Tem certeza que deseja excluir o convite para ${invite.email || 'este usuário'}? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'danger'
    }).subscribe((result) => {
      if (result.confirmed) {
        this.invitesService.deleteInvite(invite.id).subscribe({
          next: () => {
            this.loadInvites();
            setTimeout(() => {
              this.cdr.markForCheck();
              this.modalService.alert({
                title: 'Sucesso',
                message: 'Convite excluído com sucesso!',
                variant: 'success'
              });
            }, 300);
          },
          error: () => {
            setTimeout(() => {
              this.cdr.markForCheck();
              this.modalService.alert({
                title: 'Erro',
                message: 'Erro ao excluir convite. Tente novamente.',
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

  handleCreateInvite(data: { email: string; role: UserRole; action: 'send-email' | 'generate-link' }): void {
    if (data.action === 'generate-link') {
      this.handleGenerateLink(data);
    } else {
      this.handleSendEmail(data);
    }
  }

  private handleGenerateLink(data: { email: string; role: UserRole }): void {
    this.isLoading = true;
    const inviteData = {
      email: data.email || '',
      role: data.role,
      specialtyId: undefined
    };

    this.invitesService.createInvite({ email: inviteData.email, role: inviteData.role }).subscribe({
      next: (newInvite) => {
        this.isLoading = false;
        this.closeCreateModal();
        
        const link = `${window.location.origin}/registrar?token=${newInvite.token}`;
        
        navigator.clipboard.writeText(link).then(() => {
          setTimeout(() => {
            this.cdr.markForCheck();
            this.modalService.alert({
              title: 'Link Gerado',
              message: `Link de cadastro copiado para a área de transferência:\n\n${link}\n\nO link expira em 7 dias.`,
              confirmText: 'OK',
              variant: 'success'
            });
          }, 300);
        });
      },
      error: () => {
        this.isLoading = false;
        this.closeCreateModal();
        setTimeout(() => {
          this.cdr.markForCheck();
          this.modalService.alert({
            title: 'Erro',
            message: 'Erro ao gerar link de convite.',
            variant: 'danger'
          });
        }, 300);
      }
    });
  }

  private handleSendEmail(data: { email: string; role: UserRole }): void {
    this.isLoading = true;
    this.invitesService.createInvite({ email: data.email, role: data.role }).subscribe({
      next: (newInvite) => {
        this.loadInvites();
        this.closeCreateModal();
        setTimeout(() => {
          this.cdr.markForCheck();
          this.modalService.alert({
            title: 'Sucesso',
            message: `Convite enviado para ${data.email}!`,
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
            message: 'Erro ao enviar convite. Tente novamente.',
            variant: 'danger'
          });
        }, 300);
      }
    });
  }
}
