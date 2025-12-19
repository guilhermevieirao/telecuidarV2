import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { MediaPreviewModalComponent } from '@shared/components/molecules/media-preview-modal/media-preview-modal';
import { AttachmentsChatService, AttachmentMessage } from '@core/services/attachments-chat.service';
import { ModalService } from '@core/services/modal.service';
import { Subject, takeUntil } from 'rxjs';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-attachments-chat-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonComponent, MediaPreviewModalComponent],
  templateUrl: './attachments-chat-tab.html',
  styleUrls: ['./attachments-chat-tab.scss']
})
export class AttachmentsChatTabComponent implements OnInit, OnDestroy {
  @Input() appointmentId: string | null = null;
  @Input() userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PATIENT';

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('chatContainer') chatContainer!: ElementRef<HTMLDivElement>;

  messages: AttachmentMessage[] = [];
  isMobile = false;
  isDragOver = false;
  showQrCode = false;
  qrCodeDataUrl = '';
  
  // Upload State
  selectedFile: File | null = null;
  attachmentTitle = '';
  isUploading = false;

  // Preview State
  previewModalOpen = false;
  previewUrl = '';
  previewTitle = '';
  previewType: 'image' | 'file' = 'image';
  previewMessage: AttachmentMessage | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private chatService: AttachmentsChatService,
    private modalService: ModalService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.checkPlatform();
    this.generateQrCode();
    
    if (this.appointmentId) {
      this.chatService.getMessages(this.appointmentId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(msgs => {
          this.messages = msgs;
          this.scrollToBottom();
        });
    }
  }

  async generateQrCode() {
    if (!this.appointmentId || !isPlatformBrowser(this.platformId)) return;
    
    // In a real app, this would be a URL to a mobile upload page with a temporary token
    // For now, we'll just point to the current page + mobile upload param
    const baseUrl = window.location.origin;
    const uploadUrl = `${baseUrl}/mobile-upload?appointmentId=${this.appointmentId}&token=${crypto.randomUUID()}`;
    
    try {
      this.qrCodeDataUrl = await QRCode.toDataURL(uploadUrl, { width: 200, margin: 1 });
    } catch (err) {
      console.error('Error generating QR Code', err);
    }
  }

  regenerateQrCode() {
    this.generateQrCode();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkPlatform() {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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

  // File Handling
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
      this.handleFileSelection(files[0]);
    }
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFileSelection(input.files[0]);
    }
  }

  handleFileSelection(file: File) {
    this.selectedFile = file;
    // Pre-fill title with filename without extension
    this.attachmentTitle = file.name.replace(/\.[^/.]+$/, "");
  }

  cancelUpload() {
    this.selectedFile = null;
    this.attachmentTitle = '';
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  async sendAttachment() {
    if (!this.selectedFile || !this.appointmentId) return;
    
    this.isUploading = true;

    try {
      const base64 = await this.fileToBase64(this.selectedFile);
      
      const newMessage: AttachmentMessage = {
        id: crypto.randomUUID(),
        senderRole: this.userrole === 'PROFESSIONAL' ? 'PROFESSIONAL' : 'PATIENT',
        senderName: this.userrole === 'PROFESSIONAL' ? 'Profissional' : 'Você',
        timestamp: new Date().toISOString(),
        title: this.attachmentTitle || this.selectedFile.name,
        fileName: this.selectedFile.name,
        fileType: this.selectedFile.type,
        fileSize: this.selectedFile.size,
        fileUrl: base64 as string
      };

      this.chatService.addMessage(this.appointmentId, newMessage);
      this.cancelUpload();
    } catch (error) {
      console.error('Error converting file', error);
      this.modalService.alert({
        title: 'Erro',
        message: 'Erro ao processar arquivo.',
        variant: 'danger'
      }).subscribe();
    } finally {
      this.isUploading = false;
    }
  }

  toggleQrCode() {
    this.showQrCode = !this.showQrCode;
  }

  downloadFile(message: AttachmentMessage) {
    const link = document.createElement('a');
    link.href = message.fileUrl;
    link.download = message.fileName;
    link.click();
  }

  private fileToBase64(file: File): Promise<string | ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

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
}
