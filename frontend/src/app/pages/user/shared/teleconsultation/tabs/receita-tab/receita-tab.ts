import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { 
  PrescriptionService, 
  Prescription, 
  PrescriptionItem, 
  AddPrescriptionItemDto,
  MedicamentoAnvisa
} from '@core/services/prescription.service';
import { CertificateService, SavedCertificate, PfxCertificateInfo } from '@core/services/certificate.service';
import { ModalService } from '@core/services/modal.service';
import { TeleconsultationRealTimeService, PrescriptionUpdatedEvent } from '@core/services/teleconsultation-realtime.service';

@Component({
  selector: 'app-receita-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ButtonComponent, IconComponent],
  templateUrl: './receita-tab.html',
  styleUrls: ['./receita-tab.scss']
})
export class ReceitaTabComponent implements OnInit, OnDestroy {
  @Input() appointmentId: string | null = null;
  @Input() userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PATIENT';
  @Input() readonly = false;
  
  @ViewChild('pfxFileInput') pfxFileInput!: ElementRef<HTMLInputElement>;

  prescription: Prescription | null = null;
  isLoading = true;
  isSaving = false;
  isGeneratingPdf = false;
  showItemForm = false;
  
  // Form para novo item
  itemForm: FormGroup;
  
  // Busca de medicamentos
  medicamentoSearch = '';
  medicamentoResults: MedicamentoAnvisa[] = [];
  showMedicamentoDropdown = false;
  isSearching = false;
  
  // Certificados salvos na plataforma
  savedCertificates: SavedCertificate[] = [];
  selectedSavedCert: SavedCertificate | null = null;
  showSavedCertsModal = false;
  isLoadingSavedCerts = false;
  showSignatureOptionsModal = false;
  
  // Salvar novo certificado
  showSaveCertModal = false;
  saveCertName = '';
  saveCertRequirePassword = true;
  saveCertInfo: PfxCertificateInfo | null = null;
  isValidatingPfx = false;
  
  // Assinatura
  isSigning = false;
  certPasswordForSign = '';
  showCertPasswordModal = false;
  
  // PFX file upload
  pfxFile: File | null = null;
  pfxPassword = '';
  showPfxPasswordModal = false;

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private prescriptionService: PrescriptionService,
    private certificateService: CertificateService,
    private modalService: ModalService,
    private teleconsultationRealTime: TeleconsultationRealTimeService,
    private cdr: ChangeDetectorRef
  ) {
    this.itemForm = this.fb.group({
      medicamento: ['', Validators.required],
      codigoAnvisa: [''],
      dosagem: ['', Validators.required],
      frequencia: ['', Validators.required],
      periodo: ['', Validators.required],
      posologia: ['', Validators.required],
      observacoes: ['']
    });
  }

  ngOnInit() {
    if (this.appointmentId) {
      this.loadPrescription();
    }

    // Carregar certificados salvos do usuário
    this.loadSavedCertificates();
    
    // Setup real-time subscriptions
    this.setupRealTimeSubscriptions();

    // Setup debounced search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      if (query.length >= 2) {
        this.searchMedicamentos(query);
      } else {
        this.medicamentoResults = [];
        this.showMedicamentoDropdown = false;
      }
    });
  }

  private setupRealTimeSubscriptions(): void {
    // Listen for prescription updates from other participant
    this.teleconsultationRealTime.prescriptionUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: PrescriptionUpdatedEvent) => {
        if (event.prescription && this.appointmentId) {
          // Reload prescription data
          this.loadPrescription();
        }
      });
  }

  loadSavedCertificates() {
    this.certificateService.loadSavedCertificates().subscribe();
    this.certificateService.getSavedCertificates().pipe(
      takeUntil(this.destroy$)
    ).subscribe(certs => {
      this.savedCertificates = certs;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPrescription() {
    if (!this.appointmentId) return;

    this.isLoading = true;
    this.prescriptionService.getPrescriptionByAppointment(this.appointmentId).subscribe({
      next: (prescription) => {
        this.prescription = prescription;
        this.isLoading = false;
      },
      error: (error) => {
        // 404 é esperado quando não existe receita ainda
        if (error.status === 404) {
          this.prescription = null;
        } else {
          console.error('Erro ao carregar receita:', error);
        }
        this.isLoading = false;
      }
    });
  }

  createPrescription() {
    if (!this.appointmentId) return;

    this.isSaving = true;
    this.prescriptionService.createPrescription({ appointmentId: this.appointmentId }).subscribe({
      next: (prescription) => {
        this.prescription = prescription;
        this.isSaving = false;
        this.showItemForm = true;
        
        // Notify other participant via SignalR
        this.teleconsultationRealTime.notifyPrescriptionUpdated(this.appointmentId!, prescription);
      },
      error: (error) => {
        this.isSaving = false;
        this.modalService.alert({
          title: 'Erro',
          message: error.error?.message || 'Erro ao criar receita.',
          variant: 'danger'
        }).subscribe();
      }
    });
  }

  onMedicamentoInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.medicamentoSearch = input.value;
    
    // Atualizar o formControl diretamente para liberar o botão
    this.itemForm.patchValue({
      medicamento: input.value,
      codigoAnvisa: '' // Limpar código ANVISA quando digita manualmente
    });
    
    // Mostrar spinner imediatamente se tiver pelo menos 2 caracteres
    if (input.value.length >= 2) {
      this.isSearching = true;
    } else {
      this.isSearching = false;
    }
    
    this.searchSubject.next(input.value);
  }

  searchMedicamentos(query: string) {
    this.prescriptionService.searchMedicamentos(query).subscribe({
      next: (results) => {
        this.medicamentoResults = results;
        this.showMedicamentoDropdown = results.length > 0;
        this.isSearching = false;
        this.isSearching = false;
      },
      error: () => {
        this.isSearching = false;
        this.medicamentoResults = [];
      }
    });
  }

  selectMedicamento(medicamento: MedicamentoAnvisa) {
    this.itemForm.patchValue({
      medicamento: medicamento.nome,
      codigoAnvisa: medicamento.codigo
    });
    this.medicamentoSearch = medicamento.nome;
    this.showMedicamentoDropdown = false;
  }

  useFreeText() {
    this.itemForm.patchValue({
      medicamento: this.medicamentoSearch,
      codigoAnvisa: ''
    });
    this.showMedicamentoDropdown = false;
  }

  hideDropdown() {
    setTimeout(() => {
      this.showMedicamentoDropdown = false;
    }, 200);
  }

  addItem() {
    if (this.itemForm.invalid || !this.prescription) return;

    const item: AddPrescriptionItemDto = this.itemForm.value;
    
    this.isSaving = true;
    this.prescriptionService.addItem(this.prescription.id, item).subscribe({
      next: (prescription) => {
        this.prescription = prescription;
        this.itemForm.reset();
        this.medicamentoSearch = '';
        this.isSaving = false;
        this.showItemForm = false;
        
        // Notify other participant via SignalR
        if (this.appointmentId) {
          this.teleconsultationRealTime.notifyPrescriptionUpdated(this.appointmentId, prescription);
        }
      },
      error: (error) => {
        this.isSaving = false;
        this.modalService.alert({
          title: 'Erro',
          message: error.error?.message || 'Erro ao adicionar medicamento.',
          variant: 'danger'
        }).subscribe();
      }
    });
  }

  removeItem(itemId: string) {
    if (!this.prescription) return;

    this.modalService.confirm({
      title: 'Remover Medicamento',
      message: 'Tem certeza que deseja remover este medicamento da receita?',
      variant: 'warning',
      confirmText: 'Sim, remover',
      cancelText: 'Cancelar'
    }).subscribe(result => {
      if (result.confirmed && this.prescription) {
        this.prescriptionService.removeItem(this.prescription.id, itemId).subscribe({
          next: (prescription) => {
            this.prescription = prescription;
            
            // Notify other participant via SignalR
            if (this.appointmentId) {
              this.teleconsultationRealTime.notifyPrescriptionUpdated(this.appointmentId, prescription);
            }
          },
          error: (error) => {
            this.modalService.alert({
              title: 'Erro',
              message: error.error?.message || 'Erro ao remover medicamento.',
              variant: 'danger'
            }).subscribe();
          }
        });
      }
    });
  }

  cancelItemForm() {
    this.showItemForm = false;
    this.itemForm.reset();
    this.medicamentoSearch = '';
  }

  deletePrescription() {
    if (!this.prescription) return;

    this.modalService.confirm({
      title: 'Excluir Receita',
      message: 'Tem certeza que deseja excluir esta receita? Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmText: 'Sim, excluir',
      cancelText: 'Cancelar'
    }).subscribe(result => {
      if (result.confirmed && this.prescription) {
        this.isSaving = true;
        this.prescriptionService.deletePrescription(this.prescription.id).subscribe({
          next: () => {
            this.prescription = null;
            this.isSaving = false;
            this.modalService.alert({
              title: 'Sucesso',
              message: 'Receita excluída com sucesso.',
              variant: 'success'
            }).subscribe();
          },
          error: (error) => {
            this.isSaving = false;
            this.modalService.alert({
              title: 'Erro',
              message: error.error?.message || 'Erro ao excluir receita.',
              variant: 'danger'
            }).subscribe();
          }
        });
      }
    });
  }

  // === Geração de PDF ===

  generatePdf() {
    if (!this.prescription) return;

    this.isGeneratingPdf = true;
    this.prescriptionService.generatePdf(this.prescription.id).subscribe({
      next: (pdf) => {
        this.isGeneratingPdf = false;
        this.downloadPdf(pdf.pdfBase64, pdf.fileName);
      },
      error: (error) => {
        this.isGeneratingPdf = false;
        this.modalService.alert({
          title: 'Erro',
          message: error.error?.message || 'Erro ao gerar PDF.',
          variant: 'danger'
        }).subscribe();
      }
    });
  }

  // === Assinatura com Certificados Salvos ===

  // Abrir modal para selecionar certificado ou arquivo PFX
  openSignatureOptions() {
    if (!this.prescription) return;

    if (this.savedCertificates.length > 0) {
      // Tem certificados salvos - mostrar lista
      this.selectedSavedCert = null;
      this.showSavedCertsModal = true;
    } else {
      // Sem certificados salvos - mostrar opções
      this.showSignatureOptionsModal = true;
    }
  }

  // Fechar modal de opções de assinatura
  closeSignatureOptionsModal() {
    this.showSignatureOptionsModal = false;
  }

  // Fechar modal de certificados salvos
  closeSavedCertsModal() {
    this.showSavedCertsModal = false;
    this.selectedSavedCert = null;
  }

  // Selecionar certificado salvo
  selectSavedCertificate(cert: SavedCertificate) {
    this.selectedSavedCert = cert;
  }

  // Confirmar assinatura com certificado salvo
  confirmSavedCertSignature() {
    if (!this.prescription || !this.selectedSavedCert) return;

    if (this.selectedSavedCert.requirePasswordOnUse) {
      // Precisa pedir senha
      this.certPasswordForSign = '';
      this.showCertPasswordModal = true;
      this.showSavedCertsModal = false;
    } else {
      // Não precisa de senha, assinar direto
      this.signWithSavedCert();
    }
  }

  // Fechar modal de senha do certificado
  closeCertPasswordModal() {
    this.showCertPasswordModal = false;
    this.certPasswordForSign = '';
  }

  // Assinar com certificado salvo
  signWithSavedCert() {
    if (!this.prescription || !this.selectedSavedCert) return;

    this.isSigning = true;
    this.showSavedCertsModal = false;
    this.showCertPasswordModal = false;

    const password = this.selectedSavedCert.requirePasswordOnUse ? this.certPasswordForSign : undefined;

    this.prescriptionService.signWithSavedCert(
      this.prescription.id, 
      this.selectedSavedCert.id,
      password
    ).subscribe({
      next: (pdf) => {
        this.isSigning = false;
        this.selectedSavedCert = null;
        this.certPasswordForSign = '';
        
        // Download the signed PDF
        this.downloadPdf(pdf.pdfBase64, pdf.fileName);
        
        // Reload prescription to update signed status
        this.loadPrescription();
        
        this.modalService.alert({
          title: 'Sucesso',
          message: 'PDF gerado e assinado digitalmente com sucesso!',
          variant: 'success'
        }).subscribe();
      },
      error: (error) => {
        this.isSigning = false;
        this.modalService.alert({
          title: 'Erro',
          message: error.error?.message || 'Erro ao gerar PDF assinado.',
          variant: 'danger'
        }).subscribe();
      }
    });
  }

  // === Salvar novo certificado ===

  // Usar arquivo PFX e opcionalmente salvar
  usePfxFile() {
    this.showSignatureOptionsModal = false;
    this.openPfxSelector();
  }

  // Abrir modal para salvar certificado
  openSaveCertModal() {
    this.showSignatureOptionsModal = false;
    this.showSavedCertsModal = false;
    this.saveCertName = '';
    this.saveCertRequirePassword = true;
    this.saveCertInfo = null;
    this.pfxFile = null;
    this.pfxPassword = '';
    this.showSaveCertModal = true;
  }

  // Fechar modal de salvar certificado
  closeSaveCertModal() {
    this.showSaveCertModal = false;
    this.saveCertInfo = null;
    this.pfxFile = null;
    this.pfxPassword = '';
  }

  // Selecionar arquivo PFX para salvar
  onSaveCertPfxSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.pfxFile = input.files[0];
      this.saveCertInfo = null;
    }
    input.value = '';
  }

  // Validar PFX antes de salvar
  async validatePfxForSave() {
    if (!this.pfxFile || !this.pfxPassword) return;

    this.isValidatingPfx = true;

    try {
      const pfxBase64 = await this.certificateService.fileToBase64(this.pfxFile);
      this.certificateService.validatePfx(pfxBase64, this.pfxPassword).subscribe({
        next: (info) => {
          this.isValidatingPfx = false;
          this.saveCertInfo = info;
          if (!info.isValid) {
            this.modalService.alert({
              title: 'Certificado Invalido',
              message: info.errorMessage || 'O certificado nao e valido.',
              variant: 'warning'
            }).subscribe();
          } else {
            // Sugerir nome baseado no CN
            this.saveCertName = this.certificateService.formatSubjectName(info.subjectName);
          }
        },
        error: (error) => {
          this.isValidatingPfx = false;
          this.modalService.alert({
            title: 'Erro',
            message: error.error?.message || 'Erro ao validar certificado.',
            variant: 'danger'
          }).subscribe();
        }
      });
    } catch {
      this.isValidatingPfx = false;
      this.modalService.alert({
        title: 'Erro',
        message: 'Erro ao ler arquivo do certificado.',
        variant: 'danger'
      }).subscribe();
    }
  }

  // Salvar certificado na plataforma
  async saveCertificate() {
    if (!this.pfxFile || !this.pfxPassword || !this.saveCertInfo?.isValid) return;

    this.isSigning = true;

    try {
      const pfxBase64 = await this.certificateService.fileToBase64(this.pfxFile);
      
      this.certificateService.saveCertificate({
        name: this.saveCertName || this.certificateService.formatSubjectName(this.saveCertInfo.subjectName),
        pfxBase64,
        password: this.pfxPassword,
        requirePasswordOnUse: this.saveCertRequirePassword
      }).subscribe({
        next: () => {
          this.isSigning = false;
          this.closeSaveCertModal();
          this.modalService.alert({
            title: 'Sucesso',
            message: 'Certificado salvo com sucesso! Voce pode usa-lo para assinar receitas.',
            variant: 'success'
          }).subscribe();
        },
        error: (error) => {
          this.isSigning = false;
          this.modalService.alert({
            title: 'Erro',
            message: error.error?.message || 'Erro ao salvar certificado.',
            variant: 'danger'
          }).subscribe();
        }
      });
    } catch {
      this.isSigning = false;
      this.modalService.alert({
        title: 'Erro',
        message: 'Erro ao processar certificado.',
        variant: 'danger'
      }).subscribe();
    }
  }

  // Usar arquivo PFX direto (sem salvar)
  useFileCertificate() {
    this.closeSavedCertsModal();
    this.openPfxSelector();
  }

  // Trigger file input for PFX selection (fallback)
  openPfxSelector() {
    if (this.pfxFileInput) {
      this.pfxFileInput.nativeElement.click();
    }
  }

  // Handle PFX file selection
  onPfxFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.pfxFile = input.files[0];
      this.pfxPassword = '';
      this.showPfxPasswordModal = true;
    }
    // Reset input to allow selecting the same file again
    input.value = '';
  }

  // Close PFX password modal
  closePfxPasswordModal() {
    this.showPfxPasswordModal = false;
    this.pfxFile = null;
    this.pfxPassword = '';
  }

  // Generate signed PDF with PFX certificate
  generateSignedPdf() {
    if (!this.prescription || !this.pfxFile || !this.pfxPassword) {
      this.modalService.alert({
        title: 'Erro',
        message: 'Selecione um certificado PFX e informe a senha.',
        variant: 'warning'
      }).subscribe();
      return;
    }

    this.isSigning = true;
    this.showPfxPasswordModal = false;

    // Read the PFX file as base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]; // Remove data:... prefix
      
      this.prescriptionService.generateSignedPdf(this.prescription!.id, base64, this.pfxPassword).subscribe({
        next: (pdf) => {
          this.isSigning = false;
          this.pfxFile = null;
          this.pfxPassword = '';
          
          // Download the signed PDF
          this.downloadPdf(pdf.pdfBase64, pdf.fileName);
          
          // Reload prescription to update signed status
          this.loadPrescription();
          
          this.modalService.alert({
            title: 'Sucesso',
            message: 'PDF gerado e assinado digitalmente com sucesso!',
            variant: 'success'
          }).subscribe();
        },
        error: (error) => {
          this.isSigning = false;
          this.modalService.alert({
            title: 'Erro',
            message: error.error?.message || 'Erro ao assinar PDF. Verifique a senha do certificado.',
            variant: 'danger'
          }).subscribe();
        }
      });
    };
    
    reader.onerror = () => {
      this.isSigning = false;
      this.modalService.alert({
        title: 'Erro',
        message: 'Erro ao ler o arquivo do certificado.',
        variant: 'danger'
      }).subscribe();
    };
    
    reader.readAsDataURL(this.pfxFile);
  }

  private downloadPdf(base64: string, fileName: string) {
    // Verificar se é HTML (para visualização) ou PDF real
    const isHtml = base64.startsWith('PCFET0NUWVBF') || !base64.startsWith('JVBERi');
    
    if (isHtml) {
      // Converter Base64 HTML para Blob e abrir em nova janela
      const htmlContent = atob(base64);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      // PDF real - fazer download
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    }
  }

  // === Helpers ===

  get canEdit(): boolean {
    return this.userrole === 'PROFESSIONAL' && !this.prescription?.isSigned && !this.readonly;
  }

  get canDelete(): boolean {
    return this.userrole === 'PROFESSIONAL' && !this.readonly;
  }

  get isProfessional(): boolean {
    return this.userrole === 'PROFESSIONAL' && !this.readonly;
  }

  get canSign(): boolean {
    return this.userrole === 'PROFESSIONAL' && 
           !this.readonly &&
           this.prescription !== null && 
           this.prescription.items.length > 0 && 
           !this.prescription.isSigned;
  }

  get hasItems(): boolean {
    return (this.prescription?.items?.length ?? 0) > 0;
  }

  get isSigned(): boolean {
    return this.prescription?.isSigned ?? false;
  }
}
