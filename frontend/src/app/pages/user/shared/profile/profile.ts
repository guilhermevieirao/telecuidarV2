import { Component, OnInit, effect, ChangeDetectorRef } from '@angular/core';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { AvatarComponent } from '@app/shared/components/atoms/avatar/avatar';
import { ProfileEditModalComponent } from '@pages/user/shared/profile/profile-edit-modal/profile-edit-modal';
import { ChangePasswordModalComponent } from '@pages/user/shared/profile/change-password-modal/change-password-modal';
import { User, UsersService, UpdateUserDto } from '@app/core/services/users.service';
import { DatePipe } from '@angular/common';
import { BadgeComponent } from '@app/shared/components/atoms/badge/badge';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { ModalService } from '@app/core/services/modal.service';
import { AuthService } from '@app/core/services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [IconComponent, AvatarComponent, ProfileEditModalComponent, ChangePasswordModalComponent, DatePipe, BadgeComponent, ButtonComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class ProfileComponent implements OnInit {
  user: User | null = null;
  emailVerified: boolean = false;
  isSendingVerification = false;
  isEditModalOpen = false;
  isChangePasswordModalOpen = false;
  isUpdatingProfile = false;

  constructor(
    private modalService: ModalService,
    private authService: AuthService,
    private usersService: UsersService,
    private cdr: ChangeDetectorRef
  ) {
    // Sem effect() - atualização manual apenas quando necessário
  }

  ngOnInit(): void {
    // Busca dados do usuário logado
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.user = currentUser;
      this.emailVerified = !!currentUser.emailVerified;
    }
  }

  openEditModal(): void {
    this.isEditModalOpen = true;
  }

  onEditModalClose(): void {
    this.isEditModalOpen = false;
  }

  onProfileUpdated(updatedUser: Partial<User>): void {
    if (!this.user) return;

    this.isUpdatingProfile = true;

    const updateDto: UpdateUserDto = {
      name: updatedUser.name,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      avatar: updatedUser.avatar
    };

    this.usersService.updateUser(this.user.id, updateDto).subscribe({
      next: (updatedUserResponse) => {
        // Atualiza o usuário local
        this.user = updatedUserResponse;
        this.emailVerified = !!updatedUserResponse.emailVerified;
        
        // Atualiza o currentUser no AuthService e localStorage
        this.authService.updateCurrentUser(updatedUserResponse);
        
        this.isUpdatingProfile = false;
        this.onEditModalClose();
        
        // Força detecção de mudanças após fechar o modal
        this.cdr.detectChanges();
        
        // Aguarda um ciclo antes de mostrar alerta de sucesso
        setTimeout(() => {
          this.modalService.alert({
            title: 'Sucesso',
            message: 'Perfil atualizado com sucesso!',
            variant: 'success'
          });
        }, 0);
      },
      error: (error) => {
        console.error('Erro ao atualizar perfil:', error);
        setTimeout(() => {
          this.isUpdatingProfile = false;
          
          this.modalService.alert({
            title: 'Erro',
            message: 'Não foi possível atualizar o perfil. Tente novamente.',
            variant: 'danger'
          });
        });
      }
    });
  }

  getEmailVerificationLabel(): string {
    return this.emailVerified ? 'Verificado' : 'Não verificado';
  }

  getEmailVerificationVariant(): 'success' | 'warning' {
    return this.emailVerified ? 'success' : 'warning';
  }

  resendVerificationEmail(): void {
    if (!this.user) return;
    this.isSendingVerification = true;
    this.modalService.confirm({
      title: 'Reenviar verificação',
      message: `Deseja reenviar o e-mail de verificação para ${this.user.email}?`,
      confirmText: 'Reenviar',
      cancelText: 'Cancelar',
      variant: 'info'
    }).subscribe(result => {
      if (result.confirmed) {
        this.authService.resendVerificationEmail(this.user!.email).subscribe({
          next: () => {
            this.isSendingVerification = false;
            this.modalService.alert({
              title: 'Verificação enviada',
              message: 'E-mail de verificação enviado com sucesso!',
              variant: 'success'
            });
          },
          error: (error) => {
            this.isSendingVerification = false;
            console.error('Erro ao reenviar verificação:', error);
            this.modalService.alert({
              title: 'Erro',
              message: error.error?.message || 'Não foi possível reenviar o e-mail. Tente novamente.',
              variant: 'danger'
            });
          }
        });
      } else {
        this.isSendingVerification = false;
      }
    });
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      patient: 'Paciente',
      professional: 'Profissional',
      admin: 'Administrador'
    };
    return labels[role] || role;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Ativo',
      inactive: 'Inativo'
    };
    return labels[status] || status;
  }

  onChangePassword(): void {
    this.isEditModalOpen = false;
    this.isChangePasswordModalOpen = true;
  }

  onChangePasswordModalClose(): void {
    this.isChangePasswordModalOpen = false;
  }

  onPasswordChanged(data: { currentPassword: string; newPassword: string }): void {
    if (!this.user) return;

    this.authService.changePassword(data.currentPassword, data.newPassword, data.newPassword).subscribe({
      next: (response) => {
        // Fechar modal primeiro
        this.isChangePasswordModalOpen = false;
        this.cdr.detectChanges();
        
        // Mostrar alerta de sucesso após fechar o modal
        setTimeout(() => {
          this.modalService.alert({
            title: 'Sucesso',
            message: response.message || 'Senha alterada com sucesso!',
            variant: 'success'
          });
        }, 100);
      },
      error: (error) => {
        console.error('Erro ao trocar senha:', error);
        
        this.modalService.alert({
          title: 'Erro',
          message: error.error?.message || 'Não foi possível trocar a senha. Verifique se a senha atual está correta.',
          variant: 'danger'
        });
      }
    });
  }
}
