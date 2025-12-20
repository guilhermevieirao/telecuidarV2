import { 
  Component, 
  OnInit, 
  OnDestroy, 
  Input, 
  Output, 
  EventEmitter, 
  ElementRef, 
  ViewChild,
  Inject,
  PLATFORM_ID,
  AfterViewInit
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { JitsiService, JitsiToken, JitsiCallState } from '@core/services/jitsi.service';
import { ThemeService } from '@core/services/theme.service';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { ButtonComponent } from '@shared/components/atoms/button/button';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-jitsi-video',
  standalone: true,
  imports: [CommonModule, IconComponent, ButtonComponent],
  templateUrl: './jitsi-video.html',
  styleUrls: ['./jitsi-video.scss']
})
export class JitsiVideoComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('jitsiContainer', { static: true }) jitsiContainer!: ElementRef;
  
  @Input() appointmentId!: string;
  @Input() showControls = true;
  @Input() width: string | number = '100%';
  @Input() height: string | number = '100%';
  
  @Output() participantJoined = new EventEmitter<any>();
  @Output() participantLeft = new EventEmitter<any>();
  @Output() conferenceJoined = new EventEmitter<any>();
  @Output() conferenceLeft = new EventEmitter<any>();
  @Output() callEnded = new EventEmitter<void>();
  @Output() errorOccurred = new EventEmitter<string>();

  // Estados
  isLoading = true;
  isConnected = false;
  isMuted = false;
  isVideoOff = false;
  isScreenSharing = false;
  participantCount = 0;
  errorMessage: string | null = null;
  token: JitsiToken | null = null;
  isModerator = false;
  
  // Tema
  isDarkTheme = false;

  private subscriptions: Subscription[] = [];
  private containerId = 'jitsi-meet-container';
  private isBrowser: boolean;

  constructor(
    private jitsiService: JitsiService,
    private themeService: ThemeService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // Observar mudanças de tema
    if (this.isBrowser) {
      this.subscriptions.push(
        this.themeService.isDarkTheme$.subscribe(isDark => {
          this.isDarkTheme = isDark;
        })
      );
    }

    // Observar estado da chamada
    this.subscriptions.push(
      this.jitsiService.callState$.subscribe(state => {
        this.updateState(state);
      })
    );
  }

  ngAfterViewInit(): void {
    if (this.isBrowser && this.appointmentId) {
      this.initializeCall();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.jitsiService.dispose();
  }

  private updateState(state: JitsiCallState): void {
    this.isLoading = state.isLoading;
    this.isConnected = state.isConnected;
    this.isMuted = state.isMuted;
    this.isVideoOff = state.isVideoOff;
    this.isScreenSharing = state.isScreenSharing;
    this.participantCount = state.participantCount;
    
    if (state.error && state.error !== this.errorMessage) {
      this.errorMessage = state.error;
      this.errorOccurred.emit(state.error || 'Erro desconhecido');
    }
  }

  async initializeCall(): Promise<void> {
    if (!this.isBrowser) return;

    this.isLoading = true;
    this.errorMessage = null;

    try {
      // Obter token do backend
      this.token = await this.jitsiService.getToken(this.appointmentId).toPromise() || null;
      
      if (!this.token) {
        throw new Error('Não foi possível obter autorização para a videochamada');
      }

      this.isModerator = this.token.isModerator;

      // Inicializar chamada
      await this.jitsiService.initCall(this.containerId, this.token, {
        width: this.width,
        height: this.height,
        onParticipantJoined: (p) => this.participantJoined.emit(p),
        onParticipantLeft: (p) => this.participantLeft.emit(p),
        onVideoConferenceJoined: (info) => this.conferenceJoined.emit(info),
        onVideoConferenceLeft: (info) => {
          this.conferenceLeft.emit(info);
        },
        onReadyToClose: () => {
          this.callEnded.emit();
        },
        onError: (error) => {
          this.errorMessage = error?.message || 'Erro na videochamada';
          this.errorOccurred.emit(this.errorMessage || 'Erro desconhecido');
        }
      });

      this.isLoading = false;
    } catch (error) {
      this.isLoading = false;
      this.errorMessage = error instanceof Error ? error.message : 'Erro ao iniciar videochamada';
      this.errorOccurred.emit(this.errorMessage || 'Erro desconhecido');
    }
  }

  // Controles
  toggleMute(): void {
    this.jitsiService.toggleAudio();
  }

  toggleVideo(): void {
    this.jitsiService.toggleVideo();
  }

  toggleScreenShare(): void {
    this.jitsiService.toggleScreenShare();
  }

  openChat(): void {
    this.jitsiService.openChat();
  }

  muteAll(): void {
    if (this.isModerator) {
      this.jitsiService.muteEveryone();
    }
  }

  hangup(): void {
    this.jitsiService.hangup();
    this.callEnded.emit();
  }

  retry(): void {
    this.errorMessage = null;
    this.initializeCall();
  }
}
