import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { QrCodeModalComponent } from './qrcode-modal/qrcode-modal';
import { MediaPreviewModalComponent } from '@shared/components/molecules/media-preview-modal/media-preview-modal';
import { AppointmentsService, Appointment } from '@core/services/appointments.service';
import { ModalService } from '@core/services/modal.service';
import { TemporaryUploadService } from '@core/services/temporary-upload.service';
import { DeviceDetectorService } from '@core/services/device-detector.service';

interface Attachment {
  title: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'document';
}

@Component({
  selector: 'app-pre-consultation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    ButtonComponent,
    IconComponent,
    QrCodeModalComponent,
    MediaPreviewModalComponent
  ],
  templateUrl: './pre-consultation.html',
  styleUrls: ['./pre-consultation.scss']
})
export class PreConsultationComponent implements OnInit, OnDestroy {
  appointmentId: string | null = null;
  appointment: Appointment | null = null;
  form: FormGroup;
  isSubmitting = false;

  // Attachments State
  attachments: Attachment[] = [];
  isAddingAttachment = false;
  newAttachmentTitle = '';
  selectedFile: File | null = null;
  selectedFilePreview: string | null = null;
  
  // Multiple files pending (for batch add)
  pendingFiles: { file: File; title: string; previewUrl: string; loading?: boolean }[] = [];
  
  // Editing existing attachment
  editingAttachmentIndex: number | null = null;

  // Mobile Upload
  isQrCodeModalOpen = false;
  mobileUploadUrl = '';
  mobileUploadToken = '';
  isMobile = false;
  private pollingInterval: any;

  // Media Preview
  isPreviewModalOpen = false;
  previewUrl = '';
  previewTitle = '';
  previewType: 'image' | 'file' = 'image';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private appointmentsService: AppointmentsService,
    private modalService: ModalService,
    private temporaryUploadService: TemporaryUploadService,
    private deviceDetector: DeviceDetectorService
  ) {
    this.checkIfMobile();
    this.form = this.fb.group({
      personalInfo: this.fb.group({
        fullName: [''],
        birthDate: [''],
        weight: [''],
        height: ['']
      }),
      medicalHistory: this.fb.group({
        chronicConditions: [''],
        medications: [''],
        allergies: [''],
        surgeries: [''],
        generalObservations: ['']
      }),
      lifestyleHabits: this.fb.group({
        smoker: [''],
        alcoholConsumption: [''],
        physicalActivity: [''],
        generalObservations: ['']
      }),
      vitalSigns: this.fb.group({
        bloodPressure: [''],
        heartRate: [''],
        temperature: [''],
        oxygenSaturation: [''],
        generalObservations: ['']
      }),
      currentSymptoms: this.fb.group({
        mainSymptoms: [''],
        symptomOnset: [''],
        painIntensity: [''],
        generalObservations: ['']
      }),
      additionalObservations: ['']
    });
  }

  checkIfMobile() {
    if (typeof navigator !== 'undefined') {
      this.isMobile = this.deviceDetector.isMobile();
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.appointmentId = params['id'];
      if (this.appointmentId) {
        this.loadAppointment(this.appointmentId);
      }
    });
  }

  loadAppointment(id: string) {
    this.appointmentsService.getAppointmentById(id).subscribe({
      next: (appt) => {
        if (appt) {
          this.appointment = appt;
          
          // Pre-fill if data exists
          if (appt.preConsultationJson) {
            try {
              const preConsultationData = JSON.parse(appt.preConsultationJson);
              this.form.patchValue(preConsultationData);
              
              // Load existing attachments if any
              if (preConsultationData.attachments && Array.isArray(preConsultationData.attachments)) {
                this.attachments = preConsultationData.attachments.map((att: any) => ({
                  title: att.title,
                  file: new File([], att.title),
                  previewUrl: att.fileUrl,
                  type: att.type
                }));
              }
            } catch (error) {
              console.error('Erro ao carregar dados da pré-consulta:', error);
            }
          } else {
            // Auto-fill patient name if available
            this.form.get('personalInfo.fullName')?.setValue(appt.patientName);
          }
        } else {
          this.router.navigate(['/consultas']);
        }
      },
      error: () => this.router.navigate(['/consultas'])
    });
  }

  // Attachment Methods
  startAddingAttachment() {
    this.isAddingAttachment = true;
    this.newAttachmentTitle = '';
    this.selectedFile = null;
    this.selectedFilePreview = null;
  }

  cancelAddingAttachment() {
    this.isAddingAttachment = false;
    this.newAttachmentTitle = '';
    this.selectedFile = null;
    this.selectedFilePreview = null;
    this.pendingFiles = [];
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
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
          }
        });
      }
      this.isAddingAttachment = true;
    }
    event.target.value = '';
  }

  private createPreviewUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e: any) => resolve(e.target.result);
        reader.readAsDataURL(file);
      } else {
        resolve('assets/icons/file-placeholder.svg');
      }
    });
  }

  removePendingFile(index: number) {
    this.pendingFiles.splice(index, 1);
    if (this.pendingFiles.length === 0) {
      this.isAddingAttachment = false;
    }
  }

  // Edit existing attachment
  editAttachment(index: number) {
    this.editingAttachmentIndex = index;
  }

  saveAttachmentEdit(index: number) {
    this.editingAttachmentIndex = null;
  }

  cancelAttachmentEdit() {
    this.editingAttachmentIndex = null;
  }

  onFileDropped(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onFileSelectedDirectly(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.newAttachmentTitle = file.name.replace(/\.[^/.]+$/, ""); // Default title from filename
      
      // Create preview and save immediately (simplified flow for mobile)
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.selectedFilePreview = e.target.result;
          this.saveAttachment(); // Auto-save for streamlined mobile UX
        };
        reader.readAsDataURL(file);
      } else {
        this.selectedFilePreview = 'assets/icons/file-placeholder.svg';
        this.saveAttachment();
      }
    }
    // Reset input
    event.target.value = '';
  }

  private handleFile(file: File) {
    this.selectedFile = file;
    
    // Create preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedFilePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      // For non-image files, use a placeholder or handle accordingly
      // Since the UI expects a previewUrl for the list, we might need a placeholder icon
      // But for the 'add attachment' preview, it shows an <img> tag.
      // We'll use a placeholder image or generic icon data URL
      this.selectedFilePreview = 'assets/icons/file-placeholder.svg'; // Or a base64 string of a file icon
    }
  }

  saveAttachment() {
    // Save from old single-file flow
    if (this.newAttachmentTitle && this.selectedFile) {
      this.attachments.push({
        title: this.newAttachmentTitle,
        file: this.selectedFile,
        previewUrl: this.selectedFilePreview || '',
        type: this.selectedFile.type.startsWith('image/') ? 'image' : 'document'
      });
    }
    
    // Save all pending files (new multi-file flow)
    for (const pending of this.pendingFiles) {
      if (pending.title) {
        this.attachments.push({
          title: pending.title,
          file: pending.file,
          previewUrl: pending.previewUrl,
          type: pending.file.type.startsWith('image/') ? 'image' : 'document'
        });
      }
    }
    
    this.cancelAddingAttachment();
  }

  // Mobile Upload Methods
  openMobileUpload() {
    // Only generate new token if we don't have one active
    if (!this.mobileUploadToken) {
      this.mobileUploadToken = Math.random().toString(36).substring(7);
      this.mobileUploadUrl = `${window.location.origin}/mobile-upload?token=${this.mobileUploadToken}`;
      this.startPolling(); // Start polling and keep it running
    }
    this.isQrCodeModalOpen = true;
  }

  regenerateQrCode() {
    this.stopPolling(); // Stop previous poll
    this.mobileUploadToken = Math.random().toString(36).substring(7);
    this.mobileUploadUrl = `${window.location.origin}/mobile-upload?token=${this.mobileUploadToken}`;
    this.startPolling(); // Start new poll
  }

  closeQrCodeModal() {
    this.isQrCodeModalOpen = false;
    // DON'T stop polling - keep listening for uploads even with modal closed
  }

  startPolling() {
    // Poll every 2 seconds via API
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
    if (!this.mobileUploadToken) return;

    // First check if upload exists (HEAD request - doesn't log 404 errors)
    this.temporaryUploadService.checkUpload(this.mobileUploadToken).subscribe({
      next: (exists) => {
        if (exists) {
          // Fetch all available uploads in the queue
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
          if (payload) {
            // Add to attachments
            this.attachments.push({
              title: payload.title,
              file: new File([], payload.title),
              previewUrl: payload.fileUrl,
              type: payload.type
            });
            receivedFiles.push(payload.title);
            
            // Check if there are more uploads
            this.temporaryUploadService.checkUpload(this.mobileUploadToken).subscribe({
              next: (moreExists) => {
                if (moreExists) {
                  fetchNext();
                } else {
                  // No more uploads, show single notification
                  this.showUploadNotification(receivedFiles);
                }
              }
            });
          } else {
            // No payload returned, show notification for what we have
            if (receivedFiles.length > 0) {
              this.showUploadNotification(receivedFiles);
            }
          }
        },
        error: () => {
          // Error fetching, show notification for what we have
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
      message = `Arquivo "${files[0]}" adicionado! Você pode enviar mais arquivos.`;
    } else {
      message = `${count} arquivos adicionados! Você pode enviar mais arquivos.`;
    }
    
    this.modalService.alert({
      title: 'Upload Recebido',
      message: message,
      variant: 'success'
    });
  }

  removeAttachment(index: number) {
    this.attachments.splice(index, 1);
  }

  openPreview(attachment: Attachment) {
    this.previewUrl = attachment.previewUrl;
    this.previewTitle = attachment.title;
    // Assuming type logic - if it has image in type string or starts with image
    this.previewType = attachment.type === 'image' ? 'image' : 'file';
    this.isPreviewModalOpen = true;
  }

  closePreview() {
    this.isPreviewModalOpen = false;
    this.previewUrl = '';
    this.previewTitle = '';
  }

  downloadAttachment() {
    // Basic download implementation
    const link = document.createElement('a');
    link.href = this.previewUrl;
    link.download = this.previewTitle;
    link.click();
  }

  onSubmit() {
    if (this.appointmentId) {
      this.isSubmitting = true;
      
      const formData = this.form.value;
      
      // Add attachments to form data
      formData.attachments = this.attachments.map(att => ({
        title: att.title,
        fileUrl: att.previewUrl,
        type: att.type
      }));

      // Criar o DTO correto para update
      const updateDto = {
        preConsultationJson: JSON.stringify(formData)
      };

      this.appointmentsService.updateAppointment(this.appointmentId, updateDto).subscribe({
        next: (appointment) => {
          this.isSubmitting = false;
          this.modalService.alert({
            title: 'Sucesso',
            message: 'Pré-consulta salva com sucesso!',
            variant: 'success'
          }).subscribe(() => {
            this.router.navigate(['/consultas']);
          });
        },
        error: (error) => {
          this.isSubmitting = false;
          console.error('Erro ao salvar pré-consulta:', error);
          this.modalService.alert({
            title: 'Erro',
            message: 'Erro ao salvar pré-consulta. Tente novamente.',
            variant: 'danger'
          }).subscribe();
        }
      });
    }
  }

  onCancel() {
    this.router.navigate(['/consultas']);
  }
}
