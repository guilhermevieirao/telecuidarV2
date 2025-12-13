import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Appointment } from '@core/services/appointments.service';
import { ButtonComponent } from '@shared/components/atoms/button/button';

@Component({
  selector: 'app-conclusion-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './conclusion-tab.html',
  styleUrls: ['./conclusion-tab.scss']
})
export class ConclusionTabComponent {
  @Input() appointment: Appointment | null = null;
  @Output() finish = new EventEmitter<string>();

  observations = '';

  onFinish() {
    this.finish.emit(this.observations);
  }
}
