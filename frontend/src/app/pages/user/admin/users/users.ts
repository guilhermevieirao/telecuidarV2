import { Component, OnInit, OnDestroy, inject, afterNextRender, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { AvatarComponent } from '@app/shared/components/atoms/avatar/avatar';
import { BadgeComponent } from '@app/shared/components/atoms/badge/badge';
import { PaginationComponent } from '@app/shared/components/atoms/pagination/pagination';
import { SearchInputComponent } from '@app/shared/components/atoms/search-input/search-input';
import { FilterSelectComponent, FilterOption } from '@app/shared/components/atoms/filter-select/filter-select';
import { TableHeaderComponent } from '@app/shared/components/atoms/table-header/table-header';
import { UserRolePipe } from '@app/core/pipes/user-role.pipe';
import { UserStatusPipe } from '@app/core/pipes/user-status.pipe';
import { UserEditModalComponent } from '@pages/user/admin/users/user-edit-modal/user-edit-modal';
import { UserCreateModalComponent, CreateUserData, CreateUserAction } from '@pages/user/admin/users/user-create-modal/user-create-modal';
import { 
  UsersService, 
  User, 
  UserRole, 
  UserStatus,
  UsersSortOptions 
} from '@app/core/services/users.service';
import { ModalService } from '@app/core/services/modal.service';
import { RealTimeService, EntityNotification } from '@app/core/services/real-time.service';
import { BadgeVariant } from '@app/shared/components/atoms/badge/badge';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-users',
  imports: [
    FormsModule,
    IconComponent,
    AvatarComponent,
    BadgeComponent,
    PaginationComponent,
    SearchInputComponent,
    FilterSelectComponent,
    TableHeaderComponent,
    UserRolePipe,
    UserStatusPipe,
    UserEditModalComponent,
    UserCreateModalComponent
  ],
  templateUrl: './users.html',
  styleUrl: './users.scss'
})
export class UsersComponent implements OnInit, OnDestroy {
  private usersService = inject(UsersService);
  private modalService = inject(ModalService);
  private realTimeService = inject(RealTimeService);
  private realTimeSubscriptions: Subscription[] = [];
  private isBrowser: boolean;
  
  users: User[] = [];
  loading = false;
  
  // Modal de edição
  isEditModalOpen = false;
  userToEdit: User | null = null;
  
  // Modal de criação
  isCreateModalOpen = false;
  
  // Filtros
  searchTerm = '';
  roleFilter: UserRole | 'all' = 'all';
  statusFilter: UserStatus | 'all' = 'all';

  roleOptions: FilterOption[] = [
    { value: 'all', label: 'Todos os perfis' },
    { value: 'PATIENT', label: 'Pacientes' },
    { value: 'PROFESSIONAL', label: 'Profissionais' },
    { value: 'ADMIN', label: 'Administradores' }
  ];

  statusOptions: FilterOption[] = [
    { value: 'all', label: 'Todos os status' },
    { value: 'active', label: 'Ativos' },
    { value: 'inactive', label: 'Inativos' }
  ];
  
  // Ordenação
  sortField: keyof User = 'id';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Paginação
  currentPage = 1;
  pageSize = 10;
  totalUsers = 0;
  totalPages = 0;

  private searchTimeout?: number;
  private cdr = inject(ChangeDetectorRef);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    afterNextRender(() => {
      this.loadUsers();
    });
  }

  ngOnInit(): void {
    // Subscribe para atualizações em tempo real de usuários
    if (this.isBrowser) {
      this.setupRealTimeSubscriptions();
    }
  }

  private setupRealTimeSubscriptions(): void {
    // Escutar eventos de criação, atualização e exclusão de usuários
    const userEventsSub = this.realTimeService.getEntityEvents$('User').subscribe(
      (notification: EntityNotification) => {
        this.handleUserEvent(notification);
      }
    );
    this.realTimeSubscriptions.push(userEventsSub);
  }

  private handleUserEvent(notification: EntityNotification): void {
    switch (notification.action) {
      case 'Created':
        // Recarregar lista para incluir novo usuário
        this.loadUsers();
        break;
      case 'Updated':
        // Atualizar usuário na lista local se existir
        const updatedIndex = this.users.findIndex(u => u.id === notification.entityId);
        if (updatedIndex >= 0 && notification.data) {
          this.users[updatedIndex] = { ...this.users[updatedIndex], ...notification.data };
          this.cdr.markForCheck();
        } else {
          // Se não encontrar, recarregar lista
          this.loadUsers();
        }
        break;
      case 'Deleted':
        // Remover usuário da lista local
        const deletedIndex = this.users.findIndex(u => u.id === notification.entityId);
        if (deletedIndex >= 0) {
          this.users.splice(deletedIndex, 1);
          this.totalUsers--;
          this.cdr.markForCheck();
        }
        break;
    }
  }

  ngOnDestroy(): void {
    this.realTimeSubscriptions.forEach(sub => sub.unsubscribe());
  }

  loadUsers(): void {
    this.loading = true;
    
    const filter = {
      search: this.searchTerm || undefined,
      role: this.roleFilter,
      status: this.statusFilter
    };

    this.usersService.getUsers(filter, this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        this.users = response.data;
        this.totalUsers = response.total;
        this.totalPages = response.totalPages;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error: Error) => {
        console.error('Erro ao carregar usuários:', error);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSearch(value: string): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  onSearchChange(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = window.setTimeout(() => {
      this.currentPage = 1;
      this.loadUsers();
    }, 500);
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  sort(field: string): void {
    const typedField = field as keyof User;
    if (this.sortField === typedField) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = typedField;
      this.sortDirection = 'asc';
    }
    this.loadUsers();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadUsers();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadUsers();
  }

  getRoleBadgeVariant(role: UserRole): BadgeVariant {
    const variantMap: Record<UserRole, BadgeVariant> = {
      PATIENT: 'info',
      PROFESSIONAL: 'primary',
      ADMIN: 'warning'
    };
    return variantMap[role];
  }

  createUser(): void {
    this.isCreateModalOpen = true;
  }

  onCreateModalClose(): void {
    this.isCreateModalOpen = false;
  }

  onCreateModalSubmit(event: { data: CreateUserData; action: CreateUserAction }): void {
    const { data, action } = event;

    switch (action) {
      case 'create':
        this.handleCreateUser(data);
        break;
      case 'generate-link':
        this.handleGenerateLink(data);
        break;
      case 'send-email':
        this.handleSendEmail(data);
        break;
    }
  }

  private handleCreateUser(data: CreateUserData): void {
    if (!data.name || !data.lastName || !data.email || !data.cpf || !data.password) {
      this.modalService.alert({
        title: 'Erro',
        message: 'Preencha todos os campos obrigatórios.',
        confirmText: 'OK',
        variant: 'danger'
      }).subscribe();
      return;
    }

    const createDto = {
      name: data.name,
      lastName: data.lastName,
      email: data.email,
      cpf: data.cpf,
      phone: data.phone || '',
      password: data.password,
      role: data.role,
      status: 'Active' as UserStatus
    };

    this.loading = true;
    this.usersService.createUser(createDto).subscribe({
      next: (user) => {
        this.loading = false;
        this.isCreateModalOpen = false;
        this.cdr.markForCheck();
        
        // Aguarda o modal de criação fechar antes de recarregar e mostrar sucesso
        setTimeout(() => {
          this.loadUsers();
          setTimeout(() => {
            this.modalService.alert({
              title: 'Sucesso',
              message: `Usuário ${user.name} ${user.lastName} criado com sucesso!`,
              confirmText: 'OK',
              variant: 'success'
            }).subscribe();
          }, 100);
        }, 300);
      },
      error: (error) => {
        this.loading = false;
        const errorMessage = error.error?.message || 'Erro ao criar usuário. Verifique os dados e tente novamente.';
        this.modalService.alert({
          title: 'Erro',
          message: errorMessage,
          confirmText: 'OK',
          variant: 'danger'
        }).subscribe();
      }
    });
  }

  private handleGenerateLink(data: CreateUserData): void {
    // Gerar link genérico sem email
    const inviteData = {
      email: data.email || '',
      role: data.role,
      specialtyId: data.specialtyId
    };

    this.loading = true;
    this.usersService.generateInviteLink(inviteData).subscribe({
      next: (response: any) => {
        this.loading = false;
        
        const link = response.link;
        
        // Fechar modal de criação primeiro
        this.isCreateModalOpen = false;
        
        // Copiar link para área de transferência
        navigator.clipboard.writeText(link).then(() => {
          setTimeout(() => {
            this.cdr.markForCheck();
            this.modalService.alert({
              title: 'Link Gerado',
              message: `Link de cadastro copiado para a área de transferência:\n\n${link}\n\nO link expira em 7 dias.`,
              confirmText: 'OK',
              variant: 'success'
            }).subscribe();
          }, 300);
        });
      },
      error: (error) => {
        this.loading = false;
        
        // Fechar modal de criação primeiro
        this.isCreateModalOpen = false;
        
        setTimeout(() => {
          this.cdr.markForCheck();
          const errorMessage = error.error?.message || 'Erro ao gerar link de convite.';
          this.modalService.alert({
            title: 'Erro',
            message: errorMessage,
            confirmText: 'OK',
            variant: 'danger'
          }).subscribe();
        }, 300);
      }
    });
  }

  private handleSendEmail(data: CreateUserData): void {
    // TODO: Implementar envio de email no backend
    console.log('Enviar email para:', data.email);
    this.isCreateModalOpen = false;
    this.modalService.alert({
      title: 'Email Enviado',
      message: `Link de cadastro enviado para ${data.email}`,
      confirmText: 'OK',
      variant: 'success'
    }).subscribe();
  }

  editUser(id: string): void {
    const user = this.users.find(u => u.id === id);
    if (user) {
      this.userToEdit = user;
      this.isEditModalOpen = true;
    }
  }

  onEditModalClose(): void {
    this.isEditModalOpen = false;
    this.userToEdit = null;
  }

  onEditModalSave(updatedUser: User): void {
    // Criar DTO com apenas os campos editáveis
    const updateDto = {
      name: updatedUser.name,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      avatar: updatedUser.avatar,
      status: updatedUser.status,
      role: updatedUser.role,
      professionalProfile: updatedUser.professionalProfile
    };

    this.usersService.updateUser(updatedUser.id, updateDto).subscribe({
      next: () => {
        this.isEditModalOpen = false;
        this.userToEdit = null;
        this.cdr.markForCheck();
        
        // Recarrega dados e mostra mensagem após modal fechar
        setTimeout(() => {
          this.loadUsers();
          setTimeout(() => {
            this.modalService.alert({
              title: 'Sucesso',
              message: 'Usuário atualizado com sucesso.',
              confirmText: 'OK',
              variant: 'success'
            }).subscribe();
          }, 100);
        }, 300);
      },
      error: (error: Error) => {
        console.error('Erro ao atualizar usuário:', error);
        this.modalService.alert({
          title: 'Erro',
          message: 'Ocorreu um erro ao atualizar o usuário. Tente novamente.',
          confirmText: 'OK',
          variant: 'danger'
        }).subscribe();
      }
    });
  }

  deleteUser(id: string): void {
    this.modalService.confirm({
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'danger'
    }).subscribe({
      next: (result) => {
        if (result.confirmed) {
          this.usersService.deleteUser(id).subscribe({
            next: () => {
              // Aguarda o modal de confirmação fechar antes de recarregar
              setTimeout(() => {
                this.loadUsers();
                setTimeout(() => {
                  this.modalService.alert({
                    title: 'Sucesso',
                    message: 'Usuário excluído com sucesso.',
                    confirmText: 'OK',
                    variant: 'success'
                  }).subscribe();
                }, 100);
              }, 300);
            },
            error: (error: Error) => {
              console.error('Erro ao excluir usuário:', error);
              this.modalService.alert({
                title: 'Erro',
                message: 'Ocorreu um erro ao excluir o usuário. Tente novamente.',
                confirmText: 'OK',
                variant: 'danger'
              }).subscribe();
            }
          });
        }
      }
    });
  }
}
