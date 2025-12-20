import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { BiometricsTabComponent } from '../tabs/biometrics-tab/biometrics-tab';
import { AttachmentsChatTabComponent } from '../tabs/attachments-chat-tab/attachments-chat-tab';
import { SoapTabComponent } from '../tabs/soap-tab/soap-tab';
import { ConclusionTabComponent } from '../tabs/conclusion-tab/conclusion-tab';
import { PatientDataTabComponent } from '../tabs/patient-data-tab/patient-data-tab';
import { PreConsultationDataTabComponent } from '../tabs/pre-consultation-data-tab/pre-consultation-data-tab';
import { AnamnesisTabComponent } from '../tabs/anamnesis-tab/anamnesis-tab';
import { SpecialtyFieldsTabComponent } from '../tabs/specialty-fields-tab/specialty-fields-tab';
import { IotTabComponent } from '../tabs/iot-tab/iot-tab';
import { AITabComponent } from '../tabs/ai-tab/ai-tab';
import { CadsusTabComponent } from '../tabs/cadsus-tab/cadsus-tab';
import { DictationService } from '@core/services/dictation.service';
import { Appointment } from '@core/services/appointments.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-teleconsultation-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    BiometricsTabComponent,
    AttachmentsChatTabComponent,
    SoapTabComponent,
    ConclusionTabComponent,
    PatientDataTabComponent,
    PreConsultationDataTabComponent,
    AnamnesisTabComponent,
    SpecialtyFieldsTabComponent,
    IotTabComponent,
    AITabComponent,
    CadsusTabComponent
  ],
  templateUrl: './teleconsultation-sidebar.html',
  styleUrls: ['./teleconsultation-sidebar.scss']
})
export class TeleconsultationSidebarComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() isFullScreen = false;
  @Input() isHeaderVisible = true;
  @Input() tabs: string[] = [];
  @Input() activeTab = '';
  @Input() userrole: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN' = 'PATIENT';
  @Input() appointmentId: string | null = null;
  @Input() appointment: Appointment | null = null;

  @Output() toggle = new EventEmitter<void>();
  @Output() toggleMode = new EventEmitter<void>();
  @Output() tabChange = new EventEmitter<string>();
  @Output() finishConsultation = new EventEmitter<string>();

  isDictationActive = false;
  isListening = false;
  private destroy$ = new Subject<void>();

  constructor(private dictationService: DictationService) {}

  ngOnInit() {
    this.dictationService.isDictationActive$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isActive => this.isDictationActive = isActive);

    this.dictationService.isListening$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isListening => this.isListening = isListening);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDictation() {
    this.dictationService.toggleDictation();
  }

  onToggle() {
    this.toggle.emit();
  }

  onToggleMode() {
    this.toggleMode.emit();
  }

  onTabChange(tab: string) {
    this.tabChange.emit(tab);
  }

  onFinishConsultation(observations: string) {
    this.finishConsultation.emit(observations);
  }
}
