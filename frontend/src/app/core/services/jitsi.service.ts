import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '@env/environment';

const API_BASE_URL = environment.apiUrl;

/**
 * Configuração do Jitsi retornada pelo backend
 */
export interface JitsiConfig {
  enabled: boolean;
  domain: string;
  requiresAuth: boolean;
}

/**
 * Token JWT para acesso ao Jitsi
 */
export interface JitsiToken {
  token: string;
  roomName: string;
  domain: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  isModerator: boolean;
  expiresAt: number;
}

/**
 * Opções de configuração da interface do Jitsi
 */
export interface JitsiInterfaceConfig {
  SHOW_JITSI_WATERMARK: boolean;
  SHOW_WATERMARK_FOR_GUESTS: boolean;
  SHOW_BRAND_WATERMARK: boolean;
  BRAND_WATERMARK_LINK: string;
  SHOW_POWERED_BY: boolean;
  SHOW_PROMOTIONAL_CLOSE_PAGE: boolean;
  DISABLE_JOIN_LEAVE_NOTIFICATIONS: boolean;
  DISABLE_PRESENCE_STATUS: boolean;
  DISABLE_FOCUS_INDICATOR: boolean;
  DISABLE_DOMINANT_SPEAKER_INDICATOR: boolean;
  DISABLE_VIDEO_BACKGROUND: boolean;
  GENERATE_ROOMNAMES_ON_WELCOME_PAGE: boolean;
  MOBILE_APP_PROMO: boolean;
  HIDE_INVITE_MORE_HEADER: boolean;
  TOOLBAR_BUTTONS: string[];
  SETTINGS_SECTIONS: string[];
  DEFAULT_BACKGROUND: string;
  DEFAULT_LOCAL_DISPLAY_NAME: string;
  DEFAULT_REMOTE_DISPLAY_NAME: string;
  LANG_DETECTION: boolean;
  filmStripOnly: boolean;
  VERTICAL_FILMSTRIP: boolean;
  TILE_VIEW_MAX_COLUMNS: number;
}

/**
 * Opções de configuração do Jitsi
 */
export interface JitsiConfigOptions {
  startWithAudioMuted: boolean;
  startWithVideoMuted: boolean;
  enableWelcomePage: boolean;
  enableClosePage: boolean;
  prejoinPageEnabled: boolean;
  disableDeepLinking: boolean;
  enableNoisyMicDetection: boolean;
  enableNoAudioDetection: boolean;
  requireDisplayName: boolean;
  defaultLanguage: string;
  disableThirdPartyRequests: boolean;
  enableLobbyChat: boolean;
  hideLobbyButton: boolean;
  autoKnockLobby: boolean;
  lobby: {
    autoKnock: boolean;
    enableChat: boolean;
  };
  toolbarButtons?: string[];
  hideConferenceSubject: boolean;
  hideConferenceTimer: boolean;
  hideParticipantsStats: boolean;
  disablePolls: boolean;
  disableReactions: boolean;
  disableProfile: boolean;
  disableRemoteMute: boolean;
  remoteVideoMenu: {
    disableKick: boolean;
    disableGrantModerator: boolean;
  };
  disableLocalVideoFlip: boolean;
  disableInviteFunctions: boolean;
  doNotStoreRoom: boolean;
  disableAddingBackgroundImages: boolean;
  notifications: string[];
  connectionIndicators: {
    disabled: boolean;
  };
}

/**
 * Estado atual da chamada
 */
export interface JitsiCallState {
  isConnected: boolean;
  isLoading: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  participantCount: number;
  error: string | null;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class JitsiService {
  private apiUrl = `${API_BASE_URL}/jitsi`;
  private jitsiApi: any = null;
  private scriptLoaded = false;
  
  // Estado da chamada
  private callState = new BehaviorSubject<JitsiCallState>({
    isConnected: false,
    isLoading: false,
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    participantCount: 0,
    error: null
  });
  
  public callState$ = this.callState.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /**
   * Obtém as configurações do Jitsi do backend
   */
  getConfig(): Observable<JitsiConfig> {
    return this.http.get<JitsiConfig>(`${this.apiUrl}/config`);
  }

  /**
   * Obtém um token JWT para acesso à sala
   */
  getToken(appointmentId: string): Observable<JitsiToken> {
    return this.http.get<JitsiToken>(`${this.apiUrl}/token/${appointmentId}`);
  }

  /**
   * Valida se o usuário tem acesso à sala
   */
  validateAccess(appointmentId: string): Observable<boolean> {
    return this.http.get<{ hasAccess: boolean }>(`${this.apiUrl}/validate/${appointmentId}`).pipe(
      map(response => response.hasAccess),
      catchError(() => of(false))
    );
  }

  /**
   * Carrega o script da External API do Jitsi
   */
  loadJitsiScript(domain: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!isPlatformBrowser(this.platformId)) {
        reject(new Error('Jitsi só pode ser carregado no navegador'));
        return;
      }

      if (this.scriptLoaded && window.JitsiMeetExternalAPI) {
        resolve();
        return;
      }

      // Verificar se já existe
      const existingScript = document.querySelector('script[src*="external_api.js"]');
      if (existingScript) {
        if (window.JitsiMeetExternalAPI) {
          this.scriptLoaded = true;
          resolve();
        } else {
          existingScript.addEventListener('load', () => {
            this.scriptLoaded = true;
            resolve();
          });
          existingScript.addEventListener('error', () => {
            reject(new Error('Erro ao carregar script do Jitsi'));
          });
        }
        return;
      }

      const script = document.createElement('script');
      // Jitsi sempre usa HTTPS (certificado auto-assinado em dev, Let's Encrypt em prod)
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      
      script.onload = () => {
        this.scriptLoaded = true;
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error('Erro ao carregar script do Jitsi'));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Inicializa a videochamada em um elemento DOM
   */
  async initCall(
    containerId: string,
    token: JitsiToken,
    options?: {
      width?: string | number;
      height?: string | number;
      onParticipantJoined?: (participant: any) => void;
      onParticipantLeft?: (participant: any) => void;
      onVideoConferenceJoined?: (info: any) => void;
      onVideoConferenceLeft?: (info: any) => void;
      onReadyToClose?: () => void;
      onError?: (error: any) => void;
    }
  ): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Jitsi só pode ser inicializado no navegador');
    }

    this.updateCallState({ isLoading: true, error: null });

    try {
      // Carregar script primeiro
      await this.loadJitsiScript(token.domain);

      // Configurações de interface - SEM LOGO, SEM WATERMARK
      const interfaceConfigOverwrite: Partial<JitsiInterfaceConfig> = {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        BRAND_WATERMARK_LINK: '',
        SHOW_POWERED_BY: false,
        SHOW_PROMOTIONAL_CLOSE_PAGE: false,
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
        DISABLE_PRESENCE_STATUS: false,
        DISABLE_FOCUS_INDICATOR: false,
        DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
        GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
        MOBILE_APP_PROMO: false,
        HIDE_INVITE_MORE_HEADER: true,
        LANG_DETECTION: false,
        filmStripOnly: false,
        VERTICAL_FILMSTRIP: true,
        TILE_VIEW_MAX_COLUMNS: 2,
        TOOLBAR_BUTTONS: [
          'microphone',
          'camera',
          'desktop',
          'fullscreen',
          'fodeviceselection',
          'hangup',
          'chat',
          'settings',
          'videoquality',
          'filmstrip',
          'tileview',
          'select-background',
          'mute-everyone',
          'mute-video-everyone'
        ],
        SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile'],
        DEFAULT_LOCAL_DISPLAY_NAME: 'Eu',
        DEFAULT_REMOTE_DISPLAY_NAME: 'Participante'
      };

      // Configurações da chamada - PORTUGUÊS e customizado
      const configOverwrite: Partial<JitsiConfigOptions> = {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        enableWelcomePage: false,
        enableClosePage: false,
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        enableNoisyMicDetection: true,
        enableNoAudioDetection: true,
        requireDisplayName: false,
        defaultLanguage: 'ptBR',
        disableThirdPartyRequests: true,
        enableLobbyChat: false,
        hideLobbyButton: true,
        autoKnockLobby: true,
        lobby: {
          autoKnock: true,
          enableChat: false
        },
        hideConferenceSubject: true,
        hideConferenceTimer: false,
        hideParticipantsStats: true,
        disablePolls: true,
        disableReactions: false,
        disableProfile: true,
        disableRemoteMute: !token.isModerator,
        remoteVideoMenu: {
          disableKick: !token.isModerator,
          disableGrantModerator: !token.isModerator
        },
        disableLocalVideoFlip: false,
        disableInviteFunctions: true,
        doNotStoreRoom: true,
        disableAddingBackgroundImages: false,
        notifications: [],
        connectionIndicators: {
          disabled: false
        }
      };

      // Remover botões de moderador se não for moderador
      if (!token.isModerator) {
        interfaceConfigOverwrite.TOOLBAR_BUTTONS = interfaceConfigOverwrite.TOOLBAR_BUTTONS?.filter(
          btn => !['mute-everyone', 'mute-video-everyone'].includes(btn)
        );
      }

      // Criar instância do Jitsi
      this.jitsiApi = new window.JitsiMeetExternalAPI(token.domain, {
        roomName: token.roomName,
        width: options?.width || '100%',
        height: options?.height || '100%',
        parentNode: document.getElementById(containerId),
        jwt: token.token || undefined,
        configOverwrite,
        interfaceConfigOverwrite,
        userInfo: {
          displayName: token.displayName,
          email: token.email,
          avatarURL: token.avatarUrl
        },
        lang: 'ptBR'
      });

      // Event listeners
      this.setupEventListeners(options);

      this.updateCallState({ isLoading: false, isConnected: true });
    } catch (error) {
      this.updateCallState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Erro ao inicializar videochamada' 
      });
      throw error;
    }
  }

  /**
   * Configura os event listeners do Jitsi
   */
  private setupEventListeners(options?: {
    onParticipantJoined?: (participant: any) => void;
    onParticipantLeft?: (participant: any) => void;
    onVideoConferenceJoined?: (info: any) => void;
    onVideoConferenceLeft?: (info: any) => void;
    onReadyToClose?: () => void;
    onError?: (error: any) => void;
  }): void {
    if (!this.jitsiApi) return;

    // Participante entrou
    this.jitsiApi.addListener('participantJoined', (participant: any) => {
      this.updateCallState({ 
        participantCount: this.callState.value.participantCount + 1 
      });
      options?.onParticipantJoined?.(participant);
    });

    // Participante saiu
    this.jitsiApi.addListener('participantLeft', (participant: any) => {
      this.updateCallState({ 
        participantCount: Math.max(0, this.callState.value.participantCount - 1) 
      });
      options?.onParticipantLeft?.(participant);
    });

    // Entrou na conferência
    this.jitsiApi.addListener('videoConferenceJoined', (info: any) => {
      this.updateCallState({ isConnected: true, participantCount: 1 });
      options?.onVideoConferenceJoined?.(info);
    });

    // Saiu da conferência
    this.jitsiApi.addListener('videoConferenceLeft', (info: any) => {
      this.updateCallState({ isConnected: false, participantCount: 0 });
      options?.onVideoConferenceLeft?.(info);
    });

    // Pronto para fechar
    this.jitsiApi.addListener('readyToClose', () => {
      options?.onReadyToClose?.();
    });

    // Erros
    this.jitsiApi.addListener('errorOccurred', (error: any) => {
      this.updateCallState({ error: error.message || 'Erro na videochamada' });
      options?.onError?.(error);
    });

    // Estado do áudio
    this.jitsiApi.addListener('audioMuteStatusChanged', (status: { muted: boolean }) => {
      this.updateCallState({ isMuted: status.muted });
    });

    // Estado do vídeo
    this.jitsiApi.addListener('videoMuteStatusChanged', (status: { muted: boolean }) => {
      this.updateCallState({ isVideoOff: status.muted });
    });

    // Compartilhamento de tela
    this.jitsiApi.addListener('screenSharingStatusChanged', (status: { on: boolean }) => {
      this.updateCallState({ isScreenSharing: status.on });
    });
  }

  /**
   * Atualiza o estado da chamada
   */
  private updateCallState(updates: Partial<JitsiCallState>): void {
    this.callState.next({ ...this.callState.value, ...updates });
  }

  /**
   * Alterna o áudio (mute/unmute)
   */
  toggleAudio(): void {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleAudio');
    }
  }

  /**
   * Alterna o vídeo (liga/desliga câmera)
   */
  toggleVideo(): void {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleVideo');
    }
  }

  /**
   * Alterna compartilhamento de tela
   */
  toggleScreenShare(): void {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleShareScreen');
    }
  }

  /**
   * Alterna tela cheia
   */
  toggleFullscreen(): void {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleFilmStrip');
    }
  }

  /**
   * Entra em modo tile view
   */
  setTileView(enabled: boolean): void {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleTileView');
    }
  }

  /**
   * Muta todos os participantes (apenas moderador)
   */
  muteEveryone(): void {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('muteEveryone');
    }
  }

  /**
   * Abre o chat
   */
  openChat(): void {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleChat');
    }
  }

  /**
   * Encerra a chamada
   */
  hangup(): void {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('hangup');
    }
  }

  /**
   * Destrói a instância do Jitsi e limpa recursos
   */
  dispose(): void {
    if (this.jitsiApi) {
      this.jitsiApi.dispose();
      this.jitsiApi = null;
    }
    this.callState.next({
      isConnected: false,
      isLoading: false,
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      participantCount: 0,
      error: null
    });
  }

  /**
   * Retorna se há uma chamada ativa
   */
  isActive(): boolean {
    return this.jitsiApi !== null;
  }

  /**
   * Obtém informações dos participantes
   */
  getParticipantsInfo(): any[] {
    if (!this.jitsiApi) return [];
    return this.jitsiApi.getParticipantsInfo();
  }

  /**
   * Obtém estatísticas da chamada
   */
  getVideoQuality(): any {
    if (!this.jitsiApi) return null;
    return this.jitsiApi.getVideoQuality();
  }
}
