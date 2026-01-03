import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';

@Component({
  selector: 'app-input-password',
  standalone: true,
  imports: [CommonModule, IconComponent, ReactiveFormsModule],
  template: `
    <div class="input-password">
      <input
        [type]="type"
        [placeholder]="placeholder"
        [value]="value"
        [disabled]="disabled"
        (input)="onInput($event)"
        (blur)="onTouched()"
        class="input-password__field"
        [class.input-password__field--error]="hasError"
      />
      <button
        type="button"
        class="input-password__toggle"
        (click)="toggleVisibility()"
        [disabled]="disabled"
      >
        <app-icon [name]="showPassword ? 'eye-off' : 'eye'" [size]="20"></app-icon>
      </button>
    </div>
  `,
  styles: [`
    @use 'variables' as *;
    @use 'mixins' as *;

    .input-password {
      position: relative;
      display: flex;
      align-items: center;

      &__field {
        width: 100%;
        padding: 14px 48px 14px 16px;
        font-size: 15px;
        font-weight: 500;
        color: #1e293b;
        background: linear-gradient(145deg, #f8fafc, #ffffff);
        border: 2px solid #e2e8f0;
        border-radius: 14px;
        outline: none;
        transition: all 0.2s ease;
        box-shadow: 
          inset 0 2px 4px rgba(0, 0, 0, 0.03),
          0 2px 4px rgba(0, 0, 0, 0.02);

        &::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }

        &:hover {
          border-color: #cbd5e1;
          box-shadow: 
            inset 0 2px 4px rgba(0, 0, 0, 0.03),
            0 4px 8px rgba(0, 0, 0, 0.04);
        }

        &:focus {
          border-color: #3b82f6;
          box-shadow: 
            0 0 0 4px rgba(59, 130, 246, 0.15),
            inset 0 2px 4px rgba(0, 0, 0, 0.03);
        }

        &:disabled {
          background: #f1f5f9;
          color: #94a3b8;
          cursor: not-allowed;
        }

        &--error {
          border-color: #ef4444;
          background: linear-gradient(145deg, #fef2f2, #ffffff);

          &:focus {
            border-color: #ef4444;
            box-shadow: 
              0 0 0 4px rgba(239, 68, 68, 0.15),
              inset 0 2px 4px rgba(0, 0, 0, 0.03);
          }
        }
      }

      &__toggle {
        position: absolute;
        right: 12px;
        background: none;
        border: none;
        cursor: pointer;
        color: #64748b;
        padding: 4px;
        border-radius: 6px;
        transition: all 0.2s ease;

        &:hover:not(:disabled) {
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
        }

        &:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
      }
    }

    // Dark theme support
    :host-context([data-theme="dark"]) .input-password {
      &__field {
        background: linear-gradient(145deg, #1e293b, #334155);
        border-color: #475569;
        color: #f1f5f9;

        &::placeholder {
          color: #64748b;
        }

        &:hover {
          border-color: #64748b;
        }

        &:focus {
          border-color: #3b82f6;
        }

        &--error {
          border-color: #ef4444;
          background: linear-gradient(145deg, rgba(239, 68, 68, 0.1), #1e293b);
        }
      }

      &__toggle {
        color: #94a3b8;

        &:hover:not(:disabled) {
          color: #60a5fa;
          background: rgba(59, 130, 246, 0.15);
        }
      }
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputPasswordComponent),
      multi: true
    }
  ]
})
export class InputPasswordComponent implements ControlValueAccessor {
  @Input() placeholder = '';
  @Input() disabled = false;
  @Input() hasError = false;

  value = '';
  showPassword = false;
  
  onChange: any = () => {};
  onTouched: any = () => {};

  get type(): string {
    return this.showPassword ? 'text' : 'password';
  }

  toggleVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
  }

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
