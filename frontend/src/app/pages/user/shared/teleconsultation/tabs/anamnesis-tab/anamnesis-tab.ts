import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { AppointmentsService, Appointment } from '@core/services/appointments.service';
import { TeleconsultationRealTimeService, DataUpdatedEvent } from '@core/services/teleconsultation-realtime.service';
import { Subject, takeUntil, debounceTime } from 'rxjs';

@Component({
  selector: 'app-anamnesis-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, ButtonComponent],
  templateUrl: './anamnesis-tab.html',
  styleUrls: ['./anamnesis-tab.scss']
})
export class AnamnesisTabComponent implements OnInit, OnDestroy, OnChanges {
  @Input() appointmentId: string | null = null;
  @Input() appointment: Appointment | null = null;
  @Input() userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PROFESSIONAL';
  @Input() readonly = false;

  anamnesisForm: FormGroup;
  isSaving = false;
  lastSaved: Date | null = null;
  private destroy$ = new Subject<void>();
  private dataLoaded = false;
  private isReceivingUpdate = false; // Flag para evitar loop de atualizações

  constructor(
    private fb: FormBuilder,
    private appointmentsService: AppointmentsService,
    private teleconsultationRealTime: TeleconsultationRealTimeService,
    private cdr: ChangeDetectorRef
  ) {
    this.anamnesisForm = this.fb.group({
      // ========================================
      // S - SUBJETIVO
      // ========================================
      // Queixa Principal
      chiefComplaint: [''],
      
      // História da Doença Atual
      presentIllnessHistory: [''],
      
      // História Patológica Pregressa (HPP) - NOVO
      pastMedicalHistory: [''],
      
      // Antecedentes Pessoais
      personalHistory: this.fb.group({
        previousDiseases: [''],
        surgeries: [''],
        hospitalizations: [''],
        allergies: [''],
        currentMedications: [''],
        vaccinations: ['']
      }),
      
      // Antecedentes Familiares
      familyHistory: [''],
      
      // Hábitos de Vida
      lifestyle: this.fb.group({
        diet: [''],
        physicalActivity: [''],
        smoking: [''],
        alcohol: [''],
        drugs: [''],
        sleep: ['']
      }),
      
      // ========================================
      // O - OBJETIVO
      // ========================================
      // Revisão de Sistemas
      systemsReview: this.fb.group({
        cardiovascular: [''],
        respiratory: [''],
        gastrointestinal: [''],
        genitourinary: [''],
        musculoskeletal: [''],
        neurological: [''],
        psychiatric: [''],
        endocrine: [''],
        hematologic: ['']
      }),
      
      // Exame Físico / Dados Objetivos
      objectiveExam: [''],
      
      // ========================================
      // A - AVALIAÇÃO
      // ========================================
      assessment: [''],
      
      // ========================================
      // P - PLANO
      // ========================================
      plan: [''],
      
      // Observações Adicionais
      additionalNotes: ['']
    });
  }

  ngOnInit() {
    // Setup real-time subscriptions
    this.setupRealTimeSubscriptions();
    
    // Carregar dados existentes se já tiver appointment
    if (this.appointment && !this.dataLoaded) {
      this.loadAnamnesisData();
    }
    
    // Desabilitar para pacientes ou modo readonly (somente visualização)
    if (this.userrole === 'PATIENT' || this.readonly) {
      this.anamnesisForm.disable();
      return;
    }
    
    // Auto-save on value changes (debounced) - apenas para profissionais
    // Enviar preview em tempo real (debounce curto)
    this.anamnesisForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300) // 300ms para preview em tempo real
      )
      .subscribe(() => {
        if (!this.isReceivingUpdate && this.appointmentId) {
          // Salvar no cache local
          this.saveToLocalCache();
          // Notificar outros participantes sobre a mudança (preview)
          this.teleconsultationRealTime.notifyDataUpdated(
            this.appointmentId,
            'anamnesis',
            this.anamnesisForm.value
          );
        }
      });
    
    // Salvar no banco com debounce maior
    this.anamnesisForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(2000) // 2s para salvar no banco
      )
      .subscribe(() => {
        if (this.anamnesisForm.dirty && !this.isReceivingUpdate) {
          this.saveAnamnesis();
        }
      });
  }

  ngOnChanges(changes: SimpleChanges) {
    // Quando appointment mudar e ainda não carregamos os dados, carregar
    if (changes['appointment'] && changes['appointment'].currentValue && !this.dataLoaded) {
      this.loadAnamnesisData();
    }
  }

  private setupRealTimeSubscriptions(): void {
    // Listen for anamnesis updates from other participant
    this.teleconsultationRealTime.getDataUpdates$('anamnesis')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: DataUpdatedEvent) => {
        if (event.data) {
          // Marcar que estamos recebendo uma atualização para evitar loop
          this.isReceivingUpdate = true;
          
          // Update form with received data
          this.anamnesisForm.patchValue(event.data, { emitEvent: false });
          this.anamnesisForm.markAsPristine();
          // Salvar no cache local para persistir entre trocas de aba
          this.saveToLocalCache();
          this.cdr.detectChanges();
          
          // Liberar flag após um pequeno delay
          setTimeout(() => {
            this.isReceivingUpdate = false;
          }, 100);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAnamnesisData() {
    // Primeiro verificar se há dados no cache local (mais recentes)
    const cachedData = this.loadFromLocalCache();
    if (cachedData) {
      this.anamnesisForm.patchValue(cachedData, { emitEvent: false });
      this.anamnesisForm.markAsPristine();
      this.dataLoaded = true;
      return;
    }
    
    // Carregar dados da anamnese do appointment
    if (this.appointment?.anamnesisJson) {
      try {
        const anamnesisData = JSON.parse(this.appointment.anamnesisJson);
        this.anamnesisForm.patchValue(anamnesisData, { emitEvent: false });
        this.anamnesisForm.markAsPristine();
        this.dataLoaded = true;
      } catch (error) {
        console.error('Erro ao carregar dados da anamnese:', error);
      }
    } else if (this.appointment) {
      // Appointment existe mas não tem dados de anamnese ainda
      this.dataLoaded = true;
    }
  }

  private getCacheKey(): string {
    return `anamnesis_${this.appointmentId}`;
  }

  private saveToLocalCache(): void {
    if (!this.appointmentId) return;
    try {
      sessionStorage.setItem(this.getCacheKey(), JSON.stringify(this.anamnesisForm.value));
    } catch (e) {
      // Ignorar erros de sessionStorage
    }
  }

  private loadFromLocalCache(): any {
    if (!this.appointmentId) return null;
    try {
      const cached = sessionStorage.getItem(this.getCacheKey());
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  }

  private clearLocalCache(): void {
    if (!this.appointmentId) return;
    try {
      sessionStorage.removeItem(this.getCacheKey());
    } catch (e) {
      // Ignorar erros de sessionStorage
    }
  }

  saveAnamnesis() {
    if (this.anamnesisForm.invalid || !this.appointmentId) return;

    this.isSaving = true;
    
    const anamnesisJson = JSON.stringify(this.anamnesisForm.value);
    
    this.appointmentsService.updateAppointment(this.appointmentId, { anamnesisJson })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.lastSaved = new Date();
          this.anamnesisForm.markAsPristine();
          // Atualizar o appointment localmente para que os dados mais recentes
          // sejam usados quando o componente for recriado (ao mudar de aba)
          if (this.appointment) {
            this.appointment = { ...this.appointment, anamnesisJson };
          }
          // MANTER cache para quando trocar de aba e voltar - os dados já salvos estarão disponíveis
          this.saveToLocalCache();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Erro ao salvar anamnese:', error);
          this.isSaving = false;
          this.cdr.detectChanges();
        }
      });
  }

  onManualSave() {
    this.saveAnamnesis();
  }
}
