import { Component, EventEmitter, Input, Output, inject, ChangeDetectorRef, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AvatarComponent } from '@app/shared/components/atoms/avatar/avatar';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { ButtonComponent } from '@app/shared/components/atoms/button/button';
import { ImageCropperComponent, CropperResult } from '@app/shared/components/molecules/image-cropper/image-cropper';
import { ModalService } from '@app/core/services/modal.service';
import { AvatarService } from '@app/core/services/avatar.service';
import { AuthService } from '@app/core/services/auth.service';
import { DeviceDetectorService } from '@app/core/services/device-detector.service';

@Component({
  selector: 'app-avatar-upload',
  imports: [CommonModule, AvatarComponent, IconComponent, ButtonComponent, ImageCropperComponent],
  templateUrl: './avatar-upload.html',
  styleUrl: './avatar-upload.scss'
})
export class AvatarUploadComponent implements OnInit {
  @Input() name: string = '';
  @Input() currentAvatar?: string;
  @Input() userId?: string;
  @Output() avatarChange = new EventEmitter<string>();

  showCropper = false;
  showMobileOptions = false;
  selectedImageUrl = '';
  isUploading = false;
  isMobile = false;
  
  private modalService = inject(ModalService);
  private avatarService = inject(AvatarService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private deviceDetector = inject(DeviceDetectorService);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    this.checkIfMobile();
  }

  private checkIfMobile(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile = this.deviceDetector.isMobile();
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        this.modalService.alert({
          title: 'Arquivo Inválido',
          message: 'Por favor, selecione uma imagem válida',
          variant: 'warning'
        }).subscribe();
        return;
      }

      // Validar tamanho (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.modalService.alert({
          title: 'Arquivo Muito Grande',
          message: 'A imagem deve ter no máximo 5MB',
          variant: 'warning'
        }).subscribe();
        return;
      }

      // Criar URL temporária para preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.selectedImageUrl = e.target?.result as string;
        this.showCropper = true;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }

    // Limpar input para permitir selecionar o mesmo arquivo novamente
    input.value = '';
  }

  onCropComplete(result: CropperResult): void {
    this.showCropper = false;
    this.selectedImageUrl = '';
    this.isUploading = true;

    // Converter URL para File (suporta blob URL e data URL)
    this.urlToFile(result.imageUrl, 'avatar.png', 'image/png').then((file) => {
      // Obter userId do componente ou do auth service
      const userId = this.userId || this.authService.currentUser()?.id;
      if (!userId) {
        this.modalService.alert({
          title: 'Erro',
          message: 'Usuário não identificado',
          variant: 'danger'
        }).subscribe();
        this.isUploading = false;
        return;
      }

      // Fazer upload para o servidor
      this.avatarService.uploadAvatar(userId, file).subscribe({
        next: (user) => {
          this.isUploading = false;
          const avatarUrl = this.avatarService.getAvatarUrl(user.avatar || '');
          this.avatarChange.emit(avatarUrl);
          
          // Atualizar user no auth service
          this.authService.updateCurrentUser(user);
          
          this.modalService.alert({
            title: 'Sucesso',
            message: 'Foto de perfil atualizada com sucesso',
            variant: 'success'
          }).subscribe();
        },
        error: (error) => {
          this.isUploading = false;
          console.error('Error uploading avatar:', error);
          this.modalService.alert({
            title: 'Erro',
            message: 'Erro ao fazer upload da foto. Tente novamente.',
            variant: 'danger'
          }).subscribe();
        }
      });
    }).catch((error) => {
      this.isUploading = false;
      console.error('Error converting image:', error);
      this.modalService.alert({
        title: 'Erro',
        message: 'Erro ao processar a imagem. Tente novamente.',
        variant: 'danger'
      }).subscribe();
    });
  }

  onCropCancel(): void {
    this.showCropper = false;
    this.selectedImageUrl = '';
    
    // Revogar URL temporária se existir
    if (this.selectedImageUrl) {
      URL.revokeObjectURL(this.selectedImageUrl);
    }
  }

  triggerFileInput(): void {
    if (this.isMobile) {
      this.showMobileOptions = true;
      this.cdr.detectChanges();
    } else {
      const input = document.getElementById('avatar-file-input') as HTMLInputElement;
      input?.click();
    }
  }

  closeMobileOptions(): void {
    this.showMobileOptions = false;
  }

  openCamera(): void {
    this.showMobileOptions = false;
    const input = document.getElementById('avatar-camera-input') as HTMLInputElement;
    input?.click();
  }

  openGallery(): void {
    this.showMobileOptions = false;
    const input = document.getElementById('avatar-gallery-input') as HTMLInputElement;
    input?.click();
  }

  openFiles(): void {
    this.showMobileOptions = false;
    const input = document.getElementById('avatar-file-input') as HTMLInputElement;
    input?.click();
  }

  private async urlToFile(url: string, filename: string, mimeType: string): Promise<File> {
    // Se for blob URL, fazer fetch
    if (url.startsWith('blob:')) {
      const response = await fetch(url);
      const blob = await response.blob();
      return new File([blob], filename, { type: mimeType });
    }

    // Se for data URL, converter base64
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      const base64String = parts[1];
      const byteCharacters = atob(base64String);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      return new File([blob], filename, { type: mimeType });
    }

    throw new Error('URL format not supported');
  }
}
