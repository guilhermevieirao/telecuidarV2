import { Injectable, Inject, PLATFORM_ID, OnDestroy, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

// Interfaces para notificações
export interface EntityNotification {
  entityType: string;
  entityId: string | number;
  action: 'Created' | 'Updated' | 'Deleted' | 'StatusChanged';
  data?: any;
  timestamp: Date;
  triggeredByUserId?: string;
}

export interface DashboardUpdateNotification {
  statType: string;
  value?: any;
  previousValue?: any;
  timestamp: Date;
}

export interface UserNotificationUpdate {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  unreadCount: number;
}

export interface AppointmentStatusUpdate {
  appointmentId: string;
  previousStatus: string;
  newStatus: string;
  patientId?: string;
  professionalId?: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class RealTimeService implements OnDestroy {
  private hubConnection: any = null;
  private connectionPromise: Promise<void> | null = null;
  private isBrowser: boolean;
  
  // Estado da conexão
  private _isConnected$ = new BehaviorSubject<boolean>(false);
  public isConnected$ = this._isConnected$.asObservable();
  
  // Subjects para eventos genéricos de entidades
  private _entityCreated$ = new Subject<EntityNotification>();
  public entityCreated$ = this._entityCreated$.asObservable();
  
  private _entityUpdated$ = new Subject<EntityNotification>();
  public entityUpdated$ = this._entityUpdated$.asObservable();
  
  private _entityDeleted$ = new Subject<EntityNotification>();
  public entityDeleted$ = this._entityDeleted$.asObservable();
  
  // Subjects para tipos específicos de entidades
  private _entityEvents$ = new Map<string, Subject<EntityNotification>>();
  
  // Dashboard updates
  private _dashboardUpdated$ = new Subject<DashboardUpdateNotification>();
  public dashboardUpdated$ = this._dashboardUpdated$.asObservable();
  
  // Notificações do usuário
  private _newNotification$ = new Subject<UserNotificationUpdate>();
  public newNotification$ = this._newNotification$.asObservable();
  
  // Mudanças de status de consulta
  private _appointmentStatusChanged$ = new Subject<AppointmentStatusUpdate>();
  public appointmentStatusChanged$ = this._appointmentStatusChanged$.asObservable();

  // Grupos inscritos
  private subscribedGroups = new Set<string>();

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private authService: AuthService,
    private ngZone: NgZone
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  /**
   * Obtém o Observable de eventos para um tipo de entidade específico
   */
  getEntityEvents$(entityType: string): Observable<EntityNotification> {
    if (!this._entityEvents$.has(entityType)) {
      this._entityEvents$.set(entityType, new Subject<EntityNotification>());
    }
    return this._entityEvents$.get(entityType)!.asObservable();
  }

  /**
   * Obtém a URL do Hub SignalR
   */
  private getHubUrl(): string {
    const apiUrl = environment.apiUrl;
    const baseUrl = apiUrl.replace('/api', '');
    return `${baseUrl}/hubs/notifications`;
  }

  /**
   * Conecta ao hub SignalR
   */
  async connect(): Promise<void> {
    if (!this.isBrowser) return;
    
    if (this.hubConnection && this._isConnected$.value) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.initializeConnection();
    return this.connectionPromise;
  }

  private async initializeConnection(): Promise<void> {
    try {
      const signalR = await import('@microsoft/signalr');
      
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(this.getHubUrl())
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.setupEventHandlers();

      await this.hubConnection.start();
      this._isConnected$.next(true);
      console.log('[RealTimeService] Conectado ao NotificationHub');
      
      // Auto-join grupos baseados no usuário atual
      await this.autoJoinGroups();
      
    } catch (error) {
      console.error('[RealTimeService] Erro ao conectar:', error);
      this._isConnected$.next(false);
      throw error;
    } finally {
      this.connectionPromise = null;
    }
  }

  private setupEventHandlers(): void {
    if (!this.hubConnection) return;

    // Eventos genéricos de entidades
    this.hubConnection.on('EntityCreated', (notification: EntityNotification) => {
      this.ngZone.run(() => {
        this._entityCreated$.next(notification);
        this.emitEntityEvent(notification);
      });
    });

    this.hubConnection.on('EntityUpdated', (notification: EntityNotification) => {
      this.ngZone.run(() => {
        this._entityUpdated$.next(notification);
        this.emitEntityEvent(notification);
      });
    });

    this.hubConnection.on('EntityDeleted', (notification: EntityNotification) => {
      this.ngZone.run(() => {
        this._entityDeleted$.next(notification);
        this.emitEntityEvent(notification);
      });
    });

    // Eventos específicos por tipo de entidade
    const entityTypes = ['User', 'Appointment', 'Specialty', 'Schedule', 'ScheduleBlock', 'Invite', 'Report', 'AuditLog'];
    entityTypes.forEach(type => {
      this.hubConnection.on(`${type}Created`, (notification: EntityNotification) => {
        this.ngZone.run(() => {
          notification.entityType = type;
          notification.action = 'Created';
          this._entityCreated$.next(notification);
          this.emitEntityEvent(notification);
        });
      });

      this.hubConnection.on(`${type}Updated`, (notification: EntityNotification) => {
        this.ngZone.run(() => {
          notification.entityType = type;
          notification.action = 'Updated';
          this._entityUpdated$.next(notification);
          this.emitEntityEvent(notification);
        });
      });

      this.hubConnection.on(`${type}Deleted`, (notification: EntityNotification) => {
        this.ngZone.run(() => {
          notification.entityType = type;
          notification.action = 'Deleted';
          this._entityDeleted$.next(notification);
          this.emitEntityEvent(notification);
        });
      });
    });

    // Dashboard updates
    this.hubConnection.on('DashboardUpdated', (notification: DashboardUpdateNotification) => {
      this.ngZone.run(() => this._dashboardUpdated$.next(notification));
    });

    // Notificações do usuário (sino)
    this.hubConnection.on('NewNotification', (notification: any) => {
      this.ngZone.run(() => {
        // Mapear formato do backend (PascalCase) para o formato esperado no frontend (camelCase)
        const mapped: UserNotificationUpdate = {
          id: notification.id || notification.notificationId || notification.NotificationId || '',
          title: notification.title || notification.Title || '',
          message: notification.message || notification.Message || '',
          type: notification.type || notification.Type || '',
          isRead: notification.isRead ?? notification.IsRead ?? false,
          createdAt: notification.createdAt || notification.CreatedAt || new Date().toISOString(),
          unreadCount: notification.unreadCount ?? notification.UnreadCount ?? 0
        };
        this._newNotification$.next(mapped);
      });
    });

    // Mudanças de status de consulta
    this.hubConnection.on('AppointmentStatusChanged', (update: AppointmentStatusUpdate) => {
      this.ngZone.run(() => this._appointmentStatusChanged$.next(update));
    });

    // Role notifications
    this.hubConnection.on('RoleNotification', (notification: EntityNotification) => {
      this.ngZone.run(() => this.emitEntityEvent(notification));
    });

    // Global notifications
    this.hubConnection.on('GlobalNotification', (notification: EntityNotification) => {
      this.ngZone.run(() => this.emitEntityEvent(notification));
    });

    // Reconexão
    this.hubConnection.onreconnecting(() => {
      console.log('[RealTimeService] Reconectando...');
      this.ngZone.run(() => this._isConnected$.next(false));
    });

    this.hubConnection.onreconnected(() => {
      console.log('[RealTimeService] Reconectado!');
      this.ngZone.run(() => this._isConnected$.next(true));
      this.rejoinGroups();
    });

    this.hubConnection.onclose(() => {
      console.log('[RealTimeService] Conexão fechada');
      this.ngZone.run(() => this._isConnected$.next(false));
    });
  }

  private emitEntityEvent(notification: EntityNotification): void {
    if (this._entityEvents$.has(notification.entityType)) {
      this._entityEvents$.get(notification.entityType)!.next(notification);
    }
  }

  private async autoJoinGroups(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (user) {
      // Join grupo do usuário para notificações pessoais
      try {
        await this.joinUserGroup(user.id);
        console.log('[RealTimeService] Joined user group:', user.id);
      } catch (err) {
        console.warn('[RealTimeService] Failed to join user group:', err);
      }

      // Join grupo da role
      try {
        await this.joinRoleGroup(user.role);
        console.log('[RealTimeService] Joined role group:', user.role);
      } catch (err) {
        console.warn('[RealTimeService] Failed to join role group:', err);
      }
    }
  }

  private async rejoinGroups(): Promise<void> {
    for (const group of this.subscribedGroups) {
      const [type, id] = group.split('_');
      try {
        if (type === 'user') {
          await this.hubConnection.invoke('JoinUserGroup', id);
        } else if (type === 'role') {
          await this.hubConnection.invoke('JoinRoleGroup', id);
        } else {
          await this.hubConnection.invoke('JoinEntityGroup', type, id);
        }
      } catch (error) {
        console.error(`[RealTimeService] Erro ao rejoin grupo ${group}:`, error);
      }
    }
  }

  /**
   * Desconecta do hub
   */
  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      try {
        await this.hubConnection.stop();
      } catch (error) {
        console.error('[RealTimeService] Erro ao desconectar:', error);
      }
      this.hubConnection = null;
      this._isConnected$.next(false);
      this.subscribedGroups.clear();
    }
  }

  /**
   * Entra no grupo de notificações do usuário
   */
  async joinUserGroup(userId: string): Promise<void> {
    if (!this.hubConnection || !this._isConnected$.value) return;
    
    try {
      await this.hubConnection.invoke('JoinUserGroup', userId);
      this.subscribedGroups.add(`user_${userId}`);
    } catch (error) {
      console.error('[RealTimeService] Erro ao entrar no grupo do usuário:', error);
    }
  }

  /**
   * Sai do grupo de notificações do usuário
   */
  async leaveUserGroup(userId: string): Promise<void> {
    if (!this.hubConnection || !this._isConnected$.value) return;
    
    try {
      await this.hubConnection.invoke('LeaveUserGroup', userId);
      this.subscribedGroups.delete(`user_${userId}`);
    } catch (error) {
      console.error('[RealTimeService] Erro ao sair do grupo do usuário:', error);
    }
  }

  /**
   * Entra no grupo de uma role
   */
  async joinRoleGroup(role: string): Promise<void> {
    if (!this.hubConnection || !this._isConnected$.value) return;
    
    try {
      await this.hubConnection.invoke('JoinRoleGroup', role);
      this.subscribedGroups.add(`role_${role}`);
    } catch (error) {
      console.error('[RealTimeService] Erro ao entrar no grupo da role:', error);
    }
  }

  /**
   * Sai do grupo de uma role
   */
  async leaveRoleGroup(role: string): Promise<void> {
    if (!this.hubConnection || !this._isConnected$.value) return;
    
    try {
      await this.hubConnection.invoke('LeaveRoleGroup', role);
      this.subscribedGroups.delete(`role_${role}`);
    } catch (error) {
      console.error('[RealTimeService] Erro ao sair do grupo da role:', error);
    }
  }

  /**
   * Entra no grupo de uma entidade específica (para acompanhar detalhes)
   */
  async joinEntityGroup(entityType: string, entityId: string): Promise<void> {
    if (!this.hubConnection || !this._isConnected$.value) return;
    
    try {
      await this.hubConnection.invoke('JoinEntityGroup', entityType, entityId);
      this.subscribedGroups.add(`${entityType}_${entityId}`);
    } catch (error) {
      console.error(`[RealTimeService] Erro ao entrar no grupo ${entityType}:`, error);
    }
  }

  /**
   * Sai do grupo de uma entidade
   */
  async leaveEntityGroup(entityType: string, entityId: string): Promise<void> {
    if (!this.hubConnection || !this._isConnected$.value) return;
    
    try {
      await this.hubConnection.invoke('LeaveEntityGroup', entityType, entityId);
      this.subscribedGroups.delete(`${entityType}_${entityId}`);
    } catch (error) {
      console.error(`[RealTimeService] Erro ao sair do grupo ${entityType}:`, error);
    }
  }
}
