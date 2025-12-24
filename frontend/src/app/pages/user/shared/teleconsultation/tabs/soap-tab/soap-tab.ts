import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { AppointmentsService, Appointment } from '@core/services/appointments.service';
import { TeleconsultationRealTimeService, DataUpdatedEvent } from '@core/services/teleconsultation-realtime.service';
import { Subject, takeUntil, debounceTime, filter } from 'rxjs';

@Component({
  selector: 'app-soap-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent],
  templateUrl: './soap-tab.html',
  styleUrls: ['./soap-tab.scss']
})
export class SoapTabComponent implements OnInit, OnDestroy {
  @Input() appointmentId: string | null = null;
  @Input() appointment: Appointment | null = null;
  @Input() userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PATIENT';
  @Input() readonly = false;

  soapForm: FormGroup;
  isSaving = false;
  lastSaved: Date | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private appointmentsService: AppointmentsService,
    private teleconsultationRealTime: TeleconsultationRealTimeService,
    private cdr: ChangeDetectorRef
  ) {
    this.soapForm = this.fb.group({
      subjective: [''],
      objective: [''],
      assessment: [''],
      plan: ['']
    });
  }

  ngOnInit() {
    // Carregar dados existentes do SOAP
    this.loadSoapData();
    
    // Setup real-time subscriptions
    this.setupRealTimeSubscriptions();
    
    if (this.readonly) {
      this.soapForm.disable();
      return;
    }
    
    // Auto-save on value changes (debounced) - apenas para profissionais
    if (this.userrole === 'PROFESSIONAL') {
      this.soapForm.valueChanges
        .pipe(
          takeUntil(this.destroy$),
          debounceTime(2000)
        )
        .subscribe(() => {
          if (this.soapForm.dirty) {
            this.saveSoap();
          }
        });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupRealTimeSubscriptions(): void {
    // Listen for SOAP updates from other participant
    this.teleconsultationRealTime.getDataUpdates$('soap')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: DataUpdatedEvent) => {
        if (event.data) {
          // Update form with received data
          this.soapForm.patchValue(event.data, { emitEvent: false });
          this.soapForm.markAsPristine();
          this.cdr.detectChanges();
        }
      });
  }

  loadSoapData() {
    if (this.appointment?.soapJson) {
      try {
        const soapData = JSON.parse(this.appointment.soapJson);
        this.soapForm.patchValue(soapData);
        this.soapForm.markAsPristine();
      } catch (error) {
        console.error('Erro ao carregar dados do SOAP:', error);
      }
    }
  }

  saveSoap() {
    if (!this.appointmentId) return;
    
    this.isSaving = true;
    
    const soapJson = JSON.stringify(this.soapForm.value);
    
    this.appointmentsService.updateAppointment(this.appointmentId, { soapJson })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.lastSaved = new Date();
          this.soapForm.markAsPristine();
          
          // Notify other participant via SignalR
          this.teleconsultationRealTime.notifyDataUpdated(
            this.appointmentId!,
            'soap',
            this.soapForm.value
          );
        },
        error: (error) => {
          console.error('Erro ao salvar SOAP:', error);
          this.isSaving = false;
        }
      });
  }
}
