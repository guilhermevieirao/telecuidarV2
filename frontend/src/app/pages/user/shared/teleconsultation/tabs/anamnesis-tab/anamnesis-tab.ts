import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
export class AnamnesisTabComponent implements OnInit, OnDestroy {
  @Input() appointmentId: string | null = null;
  @Input() appointment: Appointment | null = null;
  @Input() userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PROFESSIONAL';
  @Input() readonly = false;

  anamnesisForm: FormGroup;
  isSaving = false;
  lastSaved: Date | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private appointmentsService: AppointmentsService,
    private teleconsultationRealTime: TeleconsultationRealTimeService,
    private cdr: ChangeDetectorRef
  ) {
    this.anamnesisForm = this.fb.group({
      // Queixa Principal
      chiefComplaint: [''],
      
      // História da Doença Atual
      presentIllnessHistory: [''],
      
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
      
      // Observações Adicionais
      additionalNotes: ['']
    });
  }

  ngOnInit() {
    this.loadAnamnesisData();
    
    // Setup real-time subscriptions
    this.setupRealTimeSubscriptions();
    
    // Desabilitar para pacientes ou modo readonly (somente visualização)
    if (this.userrole === 'PATIENT' || this.readonly) {
      this.anamnesisForm.disable();
      return;
    }
    
    // Auto-save on value changes (debounced) - apenas para profissionais
    this.anamnesisForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(2000)
      )
      .subscribe(() => {
        if (this.anamnesisForm.dirty) {
          this.saveAnamnesis();
        }
      });
  }

  private setupRealTimeSubscriptions(): void {
    // Listen for anamnesis updates from other participant
    this.teleconsultationRealTime.getDataUpdates$('anamnesis')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: DataUpdatedEvent) => {
        if (event.data) {
          // Update form with received data
          this.anamnesisForm.patchValue(event.data, { emitEvent: false });
          this.anamnesisForm.markAsPristine();
          this.cdr.detectChanges();
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAnamnesisData() {
    // Carregar dados da anamnese do appointment
    if (this.appointment?.anamnesisJson) {
      try {
        const anamnesisData = JSON.parse(this.appointment.anamnesisJson);
        this.anamnesisForm.patchValue(anamnesisData);
        this.anamnesisForm.markAsPristine();
      } catch (error) {
        console.error('Erro ao carregar dados da anamnese:', error);
      }
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
          
          // Notify other participant via SignalR
          this.teleconsultationRealTime.notifyDataUpdated(
            this.appointmentId!,
            'anamnesis',
            this.anamnesisForm.value
          );
        },
        error: (error) => {
          console.error('Erro ao salvar anamnese:', error);
          this.isSaving = false;
        }
      });
  }

  onManualSave() {
    this.saveAnamnesis();
  }
}
