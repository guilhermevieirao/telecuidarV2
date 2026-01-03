import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent, IconName } from '../icon/icon';

@Component({
  selector: 'app-checkbox',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <label class="checkbox" [class.checkbox--disabled]="disabled" [class.checkbox--with-icon]="icon">
      <input
        type="checkbox"
        class="checkbox__input"
        [checked]="value"
        [disabled]="disabled"
        (change)="onChange($event)"
        (blur)="onTouched()"
      />
      <span class="checkbox__box">
        @if (icon) {
          <app-icon [name]="icon" [size]="14" class="checkbox__icon" />
        }
      </span>
      <span class="checkbox__label" *ngIf="label">{{ label }}</span>
    </label>
  `,
  styles: [`
    @use 'variables' as *;
    @use 'mixins' as *;

    .checkbox {
      display: inline-flex;
      align-items: center;
      gap: $spacing-sm;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

      &--disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      &__input {
        position: absolute;
        opacity: 0;
        pointer-events: none;

        &:checked + .checkbox__box {
          background: linear-gradient(145deg, #3b82f6 0%, #2563eb 100%);
          border-color: #3b82f6;
          box-shadow:
            0 2px 0 rgba(37, 99, 235, 0.3),
            0 4px 8px rgba(59, 130, 246, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
          transform: scale(1);

          &::after {
            opacity: 1;
            transform: rotate(45deg) scale(1);
          }
        }

        &:focus + .checkbox__box {
          box-shadow: 
            0 0 0 3px rgba(59, 130, 246, 0.15),
            0 2px 0 rgba(0, 0, 0, 0.03),
            0 3px 6px rgba(0, 0, 0, 0.06);
        }
      }

      &__box {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        // Estilo 3D
        background: linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%);
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        box-shadow:
          0 2px 0 rgba(0, 0, 0, 0.03),
          0 3px 6px rgba(0, 0, 0, 0.06),
          inset 0 1px 0 rgba(255, 255, 255, 0.8);
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

        &::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 6px;
          width: 6px;
          height: 10px;
          border: solid white;
          border-width: 0 2.5px 2.5px 0;
          transform: rotate(45deg) scale(0);
          opacity: 0;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      }

      &--with-icon {
        .checkbox__input:checked + .checkbox__box {
          &::after {
            display: none;
          }
        }

        .checkbox__icon {
          opacity: 0;
          transform: scale(0);
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          color: white;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
        }

        .checkbox__input:checked + .checkbox__box .checkbox__icon {
          opacity: 1;
          transform: scale(1);
        }
      }

      &__label {
        font-size: 14px;
        font-weight: 500;
        color: #64748b;
        line-height: 1.4;
        transition: color 0.2s ease;
      }

      &:hover:not(&--disabled) {
        .checkbox__box {
          border-color: #3b82f6;
          transform: translateY(-1px);
          box-shadow:
            0 3px 0 rgba(0, 0, 0, 0.03),
            0 4px 8px rgba(59, 130, 246, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .checkbox__label {
          color: #3b82f6;
        }
      }

      &:active:not(&--disabled) .checkbox__box {
        transform: translateY(1px);
        box-shadow:
          0 1px 0 rgba(0, 0, 0, 0.03),
          0 2px 4px rgba(0, 0, 0, 0.05);
      }
    }

    // Dark mode
    :host-context([data-theme='dark']) {
      .checkbox {
        &__box {
          background: linear-gradient(145deg, #334155 0%, #1e293b 100%);
          border-color: #475569;
          box-shadow:
            0 2px 0 rgba(0, 0, 0, 0.15),
            0 3px 6px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        &__input {
          &:checked + .checkbox__box {
            background: linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%);
            border-color: #3b82f6;
            box-shadow:
              0 2px 0 rgba(29, 78, 216, 0.4),
              0 4px 8px rgba(59, 130, 246, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.15);
          }

          &:focus + .checkbox__box {
            box-shadow: 
              0 0 0 3px rgba(59, 130, 246, 0.25),
              0 2px 0 rgba(0, 0, 0, 0.15),
              0 3px 6px rgba(0, 0, 0, 0.2);
          }
        }

        &__label {
          color: #94a3b8;
        }

        &:hover:not(&--disabled) {
          .checkbox__box {
            border-color: #60a5fa;
            box-shadow:
              0 3px 0 rgba(0, 0, 0, 0.15),
              0 4px 8px rgba(59, 130, 246, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.05);
          }

          .checkbox__label {
            color: #60a5fa;
          }
        }
      }
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true
    }
  ]
})
export class CheckboxComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() disabled = false;
  @Input() icon?: IconName;

  value = false;
  
  onChangeCallback: any = () => {};
  onTouched: any = () => {};

  onChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.checked;
    this.onChangeCallback(this.value);
  }

  writeValue(value: boolean): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
