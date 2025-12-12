import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { IconComponent } from '@shared/components/atoms/icon/icon';

@Component({
  selector: 'app-schedule-block-request-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, IconComponent],
  templateUrl: './schedule-block-request-modal.html',
  styleUrls: ['./schedule-block-request-modal.scss']
})
export class ScheduleBlockRequestModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() request = new EventEmitter<any>();

  blockType: 'single' | 'range' = 'single';
  singleDate: string = '';
  rangeStart: string = '';
  rangeEnd: string = '';
  reason: string = '';

  onBackdropClick(): void {
    this.onCancel();
  }

  onCancel(): void {
    this.resetForm();
    this.close.emit();
  }

  onSubmit(): void {
    if (this.isValid()) {
      const requestData = {
        type: this.blockType,
        date: this.blockType === 'single' ? this.singleDate : null,
        startDate: this.blockType === 'range' ? this.rangeStart : null,
        endDate: this.blockType === 'range' ? this.rangeEnd : null,
        reason: this.reason,
        requestDate: new Date().toISOString()
      };
      this.request.emit(requestData);
      this.resetForm();
    }
  }

  isValid(): boolean {
    if (!this.reason) return false;
    if (this.blockType === 'single' && !this.singleDate) return false;
    if (this.blockType === 'range' && (!this.rangeStart || !this.rangeEnd)) return false;
    return true;
  }

  resetForm(): void {
    this.blockType = 'single';
    this.singleDate = '';
    this.rangeStart = '';
    this.rangeEnd = '';
    this.reason = '';
  }
}
