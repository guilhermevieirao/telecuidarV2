import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type IconName =
  | 'heart'
  | 'stethoscope'
  | 'calendar'
  | 'user'
  | 'users'
  | 'video'
  | 'video-off'
  | 'check'
  | 'arrow-right'
  | 'shield'
  | 'clock'
  | 'file'
  | 'download'
  | 'moon'
  | 'sun'
  | 'menu'
  | 'close'
  | 'google'
  | 'arrow-left'
  | 'alert-circle'
  | 'check-circle'
  | 'x-circle'
  | 'home'
  | 'mail'
  | 'bell'
  | 'settings'
  | 'bar-chart'
  | 'activity'
  | 'book'
  | 'plus'
  | 'search'
  | 'edit'
  | 'trash'
  | 'chevrons-up-down'
  | 'chevron-up'
  | 'chevron-down'
  | 'camera'
  | 'minus'
  | 'eye'
  | 'eye-off'
  | 'smartphone'
  | 'refresh-cw'
  | 'image'
  | 'upload-cloud'
  | 'slash'
  | 'mic'
  | 'mic-off'
  | 'monitor'
  | 'message-circle'
  | 'volume-x'
  | 'phone'
  | 'phone-off'
  | 'panel-right';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl' | number;

@Component({
  selector: 'app-icon',
  imports: [CommonModule],
  templateUrl: './icon.html',
  styleUrl: './icon.scss'
})
export class IconComponent {
  @Input() name!: IconName;
  @Input() size: IconSize = 24;
  @Input() color?: string;

  get pixelSize(): number {
    if (typeof this.size === 'number') {
      return this.size;
    }
    
    switch (this.size) {
      case 'sm': return 16;
      case 'md': return 24;
      case 'lg': return 32;
      case 'xl': return 48;
      default: return 24;
    }
  }
}
