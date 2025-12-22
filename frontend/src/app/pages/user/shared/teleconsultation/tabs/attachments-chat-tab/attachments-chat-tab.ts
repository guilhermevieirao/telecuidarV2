import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { MediaPreviewModalComponent } from '@shared/components/molecules/media-preview-modal/media-preview-modal';
import { QrCodeModalComponent } from '@pages/user/patient/pre-consultation/qrcode-modal/qrcode-modal';
import { AttachmentsChatService, AttachmentMessage } from '@core/services/attachments-chat.service';
import { TemporaryUploadService } from '@core/services/temporary-upload.service';
import { ModalService } from '@core/services/modal.service';
import { DeviceDetectorService } from '@core/services/device-detector.service';
import { Subject, takeUntil } from 'rxjs';

interface PendingFile {
  file: File;
  title: string;
  previewUrl: string;
  loading?: boolean;
}

@Component({
  selector: 'app-attachments-chat-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonComponent, MediaPreviewModalComponent, QrCodeModalComponent],
  templateUrl: './attachments-chat-tab.html',
  styleUrls: ['./attachments-chat-tab.scss']
})
export class AttachmentsChatTabComponent implements OnInit, OnDestroy {
  @Input() appointmentId: string | null = null;
  @Input() userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PATIENT';
  @Input() readonly = false;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('chatContainer') chatContainer!: ElementRef<HTMLDivElement>;

  messages: AttachmentMessage[] = [];
  isMobile = false;
  isDragOver = false;
  
  // Multiple files pending (for batch add)
  pendingFiles: PendingFile[] = [];
  isAddingAttachment = false;
  isUploading = false;
  
  // Single file fallback
  selectedFile: File | null = null;
  selectedFilePreview: string | null = null;
  attachmentTitle = '';

  // Editing existing message
  editingMessageId: string | null = null;

  // Mobile Upload
  isQrCodeModalOpen = false;
  mobileUploadUrl = '';
  mobileUploadToken = '';
  private pollingInterval: any;

  // Preview State
  previewModalOpen = false;
  previewUrl = '';
  previewTitle = '';
  previewType: 'image' | 'file' = 'image';
  previewMessage: AttachmentMessage | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private chatService: AttachmentsChatService,
    private temporaryUploadService: TemporaryUploadService,
    private modalService: ModalService,
    private cdr: ChangeDetectorRef,
    private deviceDetector: DeviceDetectorService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.checkPlatform();
    
    if (this.appointmentId) {
      this.chatService.getMessages(this.appointmentId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(msgs => {
          this.messages = msgs;
          this.scrollToBottom();
        });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPolling();
  }

  checkPlatform() {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile = this.deviceDetector.isMobile();
    }
  }

  scrollToBottom() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if (this.chatContainer) {
          this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
        }
      }, 100);
    }
  }

  // ====== DRAG AND DROP ======
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleMultipleFiles(files);
    }
  }

  // ====== FILE SELECTION ======
  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleMultipleFiles(input.files);
    }
    // Reset input
    input.value = '';
  }

  handleMultipleFiles(files: FileList) {
    // Add files immediately with loading state
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pendingIndex = this.pendingFiles.length;
      
      // Add immediately with loading placeholder
      this.pendingFiles.push({
        file,
        title: file.name.replace(/\.[^/.]+$/, ''),
        previewUrl: '',
        loading: true
      });
      
      // Load preview in background
      this.createPreviewUrl(file).then(previewUrl => {
        if (this.pendingFiles[pendingIndex]) {
          this.pendingFiles[pendingIndex].previewUrl = previewUrl;
          this.pendingFiles[pendingIndex].loading = false;
          this.cdr.detectChanges();
        }
      });
    }
    this.isAddingAttachment = true;
  }

  private createPreviewUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e: any) => resolve(e.target.result);
        reader.readAsDataURL(file);
      } else {
        resolve('');
      }
    });
  }

  removePendingFile(index: number) {
    this.pendingFiles.splice(index, 1);
    if (this.pendingFiles.length === 0) {
      this.isAddingAttachment = false;
    }
  }

  startAddingAttachment() {
    this.isAddingAttachment = true;
  }

  cancelAddingAttachment() {
    this.isAddingAttachment = false;
    this.pendingFiles = [];
    this.selectedFile = null;
    this.selectedFilePreview = null;
    this.attachmentTitle = '';
  }

  // ====== SEND ATTACHMENTS ======
  async sendAttachments() {
    if (!this.appointmentId || this.pendingFiles.length === 0) return;
    
    this.isUploading = true;

    try {
      for (const pending of this.pendingFiles) {
        const base64 = await this.fileToBase64(pending.file);
        
        const newMessage: AttachmentMessage = {
          id: crypto.randomUUID(),
          senderRole: this.userrole === 'PROFESSIONAL' ? 'PROFESSIONAL' : 'PATIENT',
          senderName: this.userrole === 'PROFESSIONAL' ? 'Profissional' : 'Você',
          timestamp: new Date().toISOString(),
          title: pending.title || pending.file.name,
          fileName: pending.file.name,
          fileType: pending.file.type,
          fileSize: pending.file.size,
          fileUrl: base64 as string
        };

        // Aguardar resposta antes de enviar próximo
        await new Promise<void>((resolve, reject) => {
          this.chatService.addMessage(this.appointmentId!, newMessage).subscribe({
            next: () => resolve(),
            error: (err) => reject(err)
          });
        });
      }
      
      this.cancelAddingAttachment();
    } catch (error) {
      console.error('Error sending attachments:', error);
      this.modalService.alert({
        title: 'Erro',
        message: 'Erro ao enviar anexos.',
        variant: 'danger'
      }).subscribe();
    } finally {
      this.isUploading = false;
    }
  }

  private fileToBase64(file: File): Promise<string | ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  // ====== MOBILE UPLOAD ======
  openMobileUpload() {
    if (!this.mobileUploadToken) {
      this.mobileUploadToken = Math.random().toString(36).substring(7);
      this.mobileUploadUrl = `${window.location.origin}/mobile-upload?token=${this.mobileUploadToken}`;
      this.startPolling();
    }
    this.isQrCodeModalOpen = true;
  }

  regenerateQrCode() {
    this.stopPolling();
    this.mobileUploadToken = Math.random().toString(36).substring(7);
    this.mobileUploadUrl = `${window.location.origin}/mobile-upload?token=${this.mobileUploadToken}`;
    this.startPolling();
  }

  closeQrCodeModal() {
    this.isQrCodeModalOpen = false;
    // Keep polling active even with modal closed
  }

  startPolling() {
    this.pollingInterval = setInterval(() => {
      this.checkMobileUpload();
    }, 2000);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  checkMobileUpload() {
    if (!this.mobileUploadToken || !this.appointmentId) return;

    this.temporaryUploadService.checkUpload(this.mobileUploadToken).subscribe({
      next: (exists) => {
        if (exists) {
          this.fetchAllPendingUploads();
        }
      }
    });
  }

  private fetchAllPendingUploads() {
    const receivedFiles: string[] = [];
    
    const fetchNext = () => {
      this.temporaryUploadService.getUpload(this.mobileUploadToken).subscribe({
        next: (payload) => {
          if (payload && this.appointmentId) {
            // Add directly to chat as a message
            const newMessage: AttachmentMessage = {
              id: crypto.randomUUID(),
              senderRole: this.userrole === 'PROFESSIONAL' ? 'PROFESSIONAL' : 'PATIENT',
              senderName: this.userrole === 'PROFESSIONAL' ? 'Profissional' : 'Paciente',
              timestamp: new Date().toISOString(),
              title: payload.title,
              fileName: payload.title,
              fileType: payload.type === 'image' ? 'image/jpeg' : 'application/octet-stream',
              fileSize: 0,
              fileUrl: payload.fileUrl
            };
            
            // Aguardar resposta antes de buscar próximo
            this.chatService.addMessage(this.appointmentId!, newMessage).subscribe({
              next: () => {
                receivedFiles.push(payload.title);
                
                // Check if there are more uploads
                this.temporaryUploadService.checkUpload(this.mobileUploadToken).subscribe({
                  next: (moreExists) => {
                    if (moreExists) {
                      fetchNext();
                    } else {
                      this.showUploadNotification(receivedFiles);
                    }
                  }
                });
              },
              error: () => {
                // Mesmo com erro, continuar para próximo
                this.temporaryUploadService.checkUpload(this.mobileUploadToken).subscribe({
                  next: (moreExists) => {
                    if (moreExists) {
                      fetchNext();
                    } else if (receivedFiles.length > 0) {
                      this.showUploadNotification(receivedFiles);
                    }
                  }
                });
              }
            });
          } else {
            if (receivedFiles.length > 0) {
              this.showUploadNotification(receivedFiles);
            }
          }
        },
        error: () => {
          if (receivedFiles.length > 0) {
            this.showUploadNotification(receivedFiles);
          }
        }
      });
    };
    
    fetchNext();
  }

  private showUploadNotification(files: string[]) {
    const count = files.length;
    let message: string;
    
    if (count === 1) {
      message = `Arquivo "${files[0]}" enviado! Você pode enviar mais arquivos.`;
    } else {
      message = `${count} arquivos enviados! Você pode enviar mais arquivos.`;
    }
    
    this.modalService.alert({
      title: 'Upload Recebido',
      message: message,
      variant: 'success'
    });
  }

  // ====== MOBILE DIRECT FILE SELECTION ======
  onFileSelectedDirectly(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.handleMultipleFiles(files);
      // Auto-send for streamlined mobile UX
      setTimeout(() => {
        this.sendAttachments();
      }, 500);
    }
    event.target.value = '';
  }

  // ====== EDIT MESSAGE TITLE ======
  editMessage(message: AttachmentMessage) {
    this.editingMessageId = message.id;
  }

  saveMessageEdit(message: AttachmentMessage) {
    this.editingMessageId = null;
  }

  cancelMessageEdit() {
    this.editingMessageId = null;
  }

  // ====== PREVIEW & DOWNLOAD ======
  openPreview(message: AttachmentMessage) {
    this.previewUrl = message.fileUrl;
    this.previewTitle = message.title;
    this.previewType = this.isImage(message.fileType) ? 'image' : 'file';
    this.previewMessage = message;
    this.previewModalOpen = true;
  }

  closePreview() {
    this.previewModalOpen = false;
    this.previewMessage = null;
  }

  downloadPreview() {
    if (this.previewMessage) {
      this.downloadFile(this.previewMessage);
    }
  }

  downloadFile(message: AttachmentMessage) {
    const link = document.createElement('a');
    link.href = message.fileUrl;
    link.download = message.fileName;
    link.click();
  }

  // ====== UTILS ======
  formatBytes(bytes: number, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  isImage(mimeType: string): boolean {
    return mimeType?.startsWith('image/') || false;
  }
}
