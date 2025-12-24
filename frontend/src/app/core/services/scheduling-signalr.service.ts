import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { environment } from '@env/environment';

// Interfaces para notificações
export interface SlotUpdateNotification {
  professionalId: string;
  specialtyId: string;
  date: string;
  time: string;
  isAvailable: boolean;
  appointmentId?: string;
}

export interface DayUpdateNotification {
  professionalId: string;
  specialtyId: string;
  date: string;
  availableSlotsCount: number;
  hasAvailability: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SchedulingSignalRService implements OnDestroy {
  private hubConnection: any = null;
  private connectionPromise: Promise<void> | null = null;
  private isBrowser: boolean;
  
  // Estado da conexão
  private _isConnected$ = new BehaviorSubject<boolean>(false);
  public isConnected$ = this._isConnected$.asObservable();
  
  // Subjects para eventos
  private _slotUpdated$ = new Subject<SlotUpdateNotification>();
  public slotUpdated$ = this._slotUpdated$.asObservable();
  
  private _dayUpdated$ = new Subject<DayUpdateNotification>();
  public dayUpdated$ = this._dayUpdated$.asObservable();

  // Grupos inscritos
  private subscribedSpecialties = new Set<string>();
  private subscribedProfessionals = new Set<string>();

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  /**
   * Obtém a URL do Hub SignalR
   */
  private getHubUrl(): string {
    // Usar a mesma base que a API, mas com endpoint do hub
    const apiUrl = environment.apiUrl;
    // Remover /api do final e adicionar /hubs/scheduling
    const baseUrl = apiUrl.replace('/api', '');
    return `${baseUrl}/hubs/scheduling`;
  }

  /**
   * Conecta ao hub SignalR
   */
  async connect(): Promise<void> {
    if (!this.isBrowser) return;
    
    if (this.hubConnection && this._isConnected$.value) {
      return; // Já conectado
    }

    if (this.connectionPromise) {
      return this.connectionPromise; // Conexão em andamento
    }

    this.connectionPromise = this.initializeConnection();
    return this.connectionPromise;
  }

  private async initializeConnection(): Promise<void> {
    try {
      // Importar SignalR dinamicamente para evitar problemas de SSR
      const signalR = await import('@microsoft/signalr');
      
      const hubUrl = this.getHubUrl();
      console.log('[SignalR] Conectando ao hub:', hubUrl);

      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Configurar handlers de eventos
      this.setupEventHandlers();

      // Configurar handlers de reconexão
      this.hubConnection.onreconnecting((error: any) => {
        console.log('[SignalR] Reconectando...', error);
        this._isConnected$.next(false);
      });

      this.hubConnection.onreconnected((connectionId: string) => {
        console.log('[SignalR] Reconectado:', connectionId);
        this._isConnected$.next(true);
        // Re-inscrever nos grupos após reconexão
        this.resubscribeToGroups();
      });

      this.hubConnection.onclose((error: any) => {
        console.log('[SignalR] Conexão fechada:', error);
        this._isConnected$.next(false);
        this.connectionPromise = null;
      });

      // Iniciar conexão
      await this.hubConnection.start();
      console.log('[SignalR] Conectado com sucesso');
      this._isConnected$.next(true);
      
    } catch (error) {
      console.error('[SignalR] Erro ao conectar:', error);
      this._isConnected$.next(false);
      this.connectionPromise = null;
      throw error;
    }
  }

  /**
   * Configura os handlers de eventos do SignalR
   */
  private setupEventHandlers(): void {
    if (!this.hubConnection) return;

    // Handler para atualização de slot
    this.hubConnection.on('SlotUpdated', (notification: SlotUpdateNotification) => {
      console.log('[SignalR] Slot atualizado:', notification);
      this._slotUpdated$.next(notification);
    });

    // Handler para atualização de dia
    this.hubConnection.on('DayUpdated', (notification: DayUpdateNotification) => {
      console.log('[SignalR] Dia atualizado:', notification);
      this._dayUpdated$.next(notification);
    });
  }

  /**
   * Re-inscreve nos grupos após reconexão
   */
  private async resubscribeToGroups(): Promise<void> {
    for (const specialtyId of this.subscribedSpecialties) {
      await this.joinSpecialtyGroup(specialtyId);
    }
    for (const professionalId of this.subscribedProfessionals) {
      await this.joinProfessionalGroup(professionalId);
    }
  }

  /**
   * Desconecta do hub
   */
  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      try {
        await this.hubConnection.stop();
        console.log('[SignalR] Desconectado');
      } catch (error) {
        console.error('[SignalR] Erro ao desconectar:', error);
      }
      this.hubConnection = null;
      this.connectionPromise = null;
      this._isConnected$.next(false);
      this.subscribedSpecialties.clear();
      this.subscribedProfessionals.clear();
    }
  }

  /**
   * Inscreve para receber atualizações de uma especialidade
   */
  async joinSpecialtyGroup(specialtyId: string): Promise<void> {
    if (!this.hubConnection || !this._isConnected$.value) {
      await this.connect();
    }
    
    if (this.hubConnection && this._isConnected$.value) {
      try {
        await this.hubConnection.invoke('JoinSpecialtyGroup', specialtyId);
        this.subscribedSpecialties.add(specialtyId);
        console.log('[SignalR] Inscrito na especialidade:', specialtyId);
      } catch (error) {
        console.error('[SignalR] Erro ao inscrever na especialidade:', error);
      }
    }
  }

  /**
   * Remove inscrição de uma especialidade
   */
  async leaveSpecialtyGroup(specialtyId: string): Promise<void> {
    if (this.hubConnection && this._isConnected$.value) {
      try {
        await this.hubConnection.invoke('LeaveSpecialtyGroup', specialtyId);
        this.subscribedSpecialties.delete(specialtyId);
        console.log('[SignalR] Removido da especialidade:', specialtyId);
      } catch (error) {
        console.error('[SignalR] Erro ao remover inscrição da especialidade:', error);
      }
    }
  }

  /**
   * Inscreve para receber atualizações de um profissional
   */
  async joinProfessionalGroup(professionalId: string): Promise<void> {
    if (!this.hubConnection || !this._isConnected$.value) {
      await this.connect();
    }
    
    if (this.hubConnection && this._isConnected$.value) {
      try {
        await this.hubConnection.invoke('JoinProfessionalGroup', professionalId);
        this.subscribedProfessionals.add(professionalId);
        console.log('[SignalR] Inscrito no profissional:', professionalId);
      } catch (error) {
        console.error('[SignalR] Erro ao inscrever no profissional:', error);
      }
    }
  }

  /**
   * Remove inscrição de um profissional
   */
  async leaveProfessionalGroup(professionalId: string): Promise<void> {
    if (this.hubConnection && this._isConnected$.value) {
      try {
        await this.hubConnection.invoke('LeaveProfessionalGroup', professionalId);
        this.subscribedProfessionals.delete(professionalId);
        console.log('[SignalR] Removido do profissional:', professionalId);
      } catch (error) {
        console.error('[SignalR] Erro ao remover inscrição do profissional:', error);
      }
    }
  }
}
