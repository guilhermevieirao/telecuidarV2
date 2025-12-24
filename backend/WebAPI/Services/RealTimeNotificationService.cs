using Microsoft.AspNetCore.SignalR;
using WebAPI.Hubs;

namespace WebAPI.Services;

/// <summary>
/// Interface para o serviço de notificações em tempo real
/// </summary>
public interface IRealTimeNotificationService
{
    // Notificações de entidades genéricas
    Task NotifyEntityCreatedAsync(string entityType, string entityId, object data, string? triggeredByUserId = null);
    Task NotifyEntityUpdatedAsync(string entityType, string entityId, object data, string? triggeredByUserId = null);
    Task NotifyEntityDeletedAsync(string entityType, string entityId, string? triggeredByUserId = null);
    
    // Notificações para usuários específicos
    Task NotifyUserAsync(string userId, UserNotificationUpdate notification);
    Task NotifyUsersAsync(IEnumerable<string> userIds, UserNotificationUpdate notification);
    
    // Notificações por role
    Task NotifyRoleAsync(string role, EntityNotification notification);
    
    // Dashboard updates
    Task NotifyDashboardUpdateAsync(DashboardUpdateNotification update);
    
    // Appointment status changes
    Task NotifyAppointmentStatusChangeAsync(AppointmentStatusUpdate update);
    
    // Notificações para todos
    Task NotifyAllAsync(EntityNotification notification);
}

/// <summary>
/// Serviço de notificações em tempo real usando SignalR
/// </summary>
public class RealTimeNotificationService : IRealTimeNotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ILogger<RealTimeNotificationService> _logger;

    public RealTimeNotificationService(
        IHubContext<NotificationHub> hubContext,
        ILogger<RealTimeNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task NotifyEntityCreatedAsync(string entityType, string entityId, object data, string? triggeredByUserId = null)
    {
        var notification = new EntityNotification
        {
            EntityType = entityType,
            EntityId = entityId,
            Operation = "Created",
            Data = data,
            Timestamp = DateTime.UtcNow,
            TriggeredByUserId = triggeredByUserId
        };

        // Notifica o grupo da entidade e todos os admins
        await _hubContext.Clients.Group($"role_ADMIN").SendAsync("EntityCreated", notification);
        await _hubContext.Clients.All.SendAsync($"{entityType}Created", notification);
        
        _logger.LogInformation("Notificação de criação enviada: {EntityType} {EntityId}", entityType, entityId);
    }

    public async Task NotifyEntityUpdatedAsync(string entityType, string entityId, object data, string? triggeredByUserId = null)
    {
        var notification = new EntityNotification
        {
            EntityType = entityType,
            EntityId = entityId,
            Operation = "Updated",
            Data = data,
            Timestamp = DateTime.UtcNow,
            TriggeredByUserId = triggeredByUserId
        };

        // Notifica quem está visualizando a entidade específica
        await _hubContext.Clients.Group($"{entityType}_{entityId}").SendAsync("EntityUpdated", notification);
        // Notifica admins
        await _hubContext.Clients.Group("role_ADMIN").SendAsync("EntityUpdated", notification);
        // Notifica broadcast geral para listas
        await _hubContext.Clients.All.SendAsync($"{entityType}Updated", notification);
        
        _logger.LogInformation("Notificação de atualização enviada: {EntityType} {EntityId}", entityType, entityId);
    }

    public async Task NotifyEntityDeletedAsync(string entityType, string entityId, string? triggeredByUserId = null)
    {
        var notification = new EntityNotification
        {
            EntityType = entityType,
            EntityId = entityId,
            Operation = "Deleted",
            Timestamp = DateTime.UtcNow,
            TriggeredByUserId = triggeredByUserId
        };

        // Notifica admins
        await _hubContext.Clients.Group("role_ADMIN").SendAsync("EntityDeleted", notification);
        // Notifica broadcast geral
        await _hubContext.Clients.All.SendAsync($"{entityType}Deleted", notification);
        
        _logger.LogInformation("Notificação de exclusão enviada: {EntityType} {EntityId}", entityType, entityId);
    }

    public async Task NotifyUserAsync(string userId, UserNotificationUpdate notification)
    {
        await _hubContext.Clients.Group($"user_{userId}").SendAsync("NewNotification", notification);
        _logger.LogInformation("Notificação enviada para usuário {UserId}: {Title}", userId, notification.Title);
    }

    public async Task NotifyUsersAsync(IEnumerable<string> userIds, UserNotificationUpdate notification)
    {
        var tasks = userIds.Select(userId => NotifyUserAsync(userId, notification));
        await Task.WhenAll(tasks);
    }

    public async Task NotifyRoleAsync(string role, EntityNotification notification)
    {
        await _hubContext.Clients.Group($"role_{role}").SendAsync("RoleNotification", notification);
        _logger.LogInformation("Notificação enviada para role {Role}: {EntityType} {Operation}", role, notification.EntityType, notification.Operation);
    }

    public async Task NotifyDashboardUpdateAsync(DashboardUpdateNotification update)
    {
        // Notifica todos os admins sobre mudanças no dashboard
        await _hubContext.Clients.Group("role_ADMIN").SendAsync("DashboardUpdated", update);
        _logger.LogInformation("Atualização de dashboard enviada: {StatType}", update.StatType);
    }

    public async Task NotifyAppointmentStatusChangeAsync(AppointmentStatusUpdate update)
    {
        // Notifica o paciente
        if (!string.IsNullOrEmpty(update.PatientId))
        {
            await _hubContext.Clients.Group($"user_{update.PatientId}").SendAsync("AppointmentStatusChanged", update);
        }
        
        // Notifica o profissional
        if (!string.IsNullOrEmpty(update.ProfessionalId))
        {
            await _hubContext.Clients.Group($"user_{update.ProfessionalId}").SendAsync("AppointmentStatusChanged", update);
        }
        
        // Notifica admins
        await _hubContext.Clients.Group("role_ADMIN").SendAsync("AppointmentStatusChanged", update);
        
        _logger.LogInformation("Mudança de status de consulta: {AppointmentId} de {Previous} para {New}", 
            update.AppointmentId, update.PreviousStatus, update.NewStatus);
    }

    public async Task NotifyAllAsync(EntityNotification notification)
    {
        await _hubContext.Clients.All.SendAsync("GlobalNotification", notification);
        _logger.LogInformation("Notificação global enviada: {EntityType} {Operation}", notification.EntityType, notification.Operation);
    }
}
