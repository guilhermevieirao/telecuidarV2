using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;

namespace WebAPI.Hubs;

/// <summary>
/// SignalR Hub genérico para notificações em tempo real de todas as entidades do sistema
/// </summary>
public class NotificationHub : Hub
{
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Cliente conectado ao NotificationHub: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Cliente desconectado do NotificationHub: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Inscreve o cliente para receber atualizações de um usuário específico (notificações pessoais)
    /// </summary>
    public async Task JoinUserGroup(string userId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        _logger.LogInformation("Cliente {ConnectionId} inscrito no grupo do usuário {UserId}", Context.ConnectionId, userId);
    }

    /// <summary>
    /// Remove a inscrição do cliente de um usuário
    /// </summary>
    public async Task LeaveUserGroup(string userId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
        _logger.LogInformation("Cliente {ConnectionId} removido do grupo do usuário {UserId}", Context.ConnectionId, userId);
    }

    /// <summary>
    /// Inscreve o cliente para receber atualizações de uma role (ADMIN, PROFESSIONAL, PATIENT)
    /// </summary>
    public async Task JoinRoleGroup(string role)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"role_{role}");
        _logger.LogInformation("Cliente {ConnectionId} inscrito no grupo da role {Role}", Context.ConnectionId, role);
    }

    /// <summary>
    /// Remove a inscrição do cliente de uma role
    /// </summary>
    public async Task LeaveRoleGroup(string role)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"role_{role}");
        _logger.LogInformation("Cliente {ConnectionId} removido do grupo da role {Role}", Context.ConnectionId, role);
    }

    /// <summary>
    /// Inscreve o cliente para receber atualizações de uma entidade específica
    /// </summary>
    public async Task JoinEntityGroup(string entityType, string entityId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"{entityType}_{entityId}");
        _logger.LogInformation("Cliente {ConnectionId} inscrito no grupo {EntityType}_{EntityId}", Context.ConnectionId, entityType, entityId);
    }

    /// <summary>
    /// Remove a inscrição do cliente de uma entidade
    /// </summary>
    public async Task LeaveEntityGroup(string entityType, string entityId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"{entityType}_{entityId}");
        _logger.LogInformation("Cliente {ConnectionId} removido do grupo {EntityType}_{EntityId}", Context.ConnectionId, entityType, entityId);
    }
}

#region DTOs para Notificações

/// <summary>
/// Tipos de entidades que podem ser atualizadas
/// </summary>
public enum EntityType
{
    User,
    Appointment,
    Specialty,
    Schedule,
    ScheduleBlock,
    Invite,
    Notification,
    Report,
    AuditLog,
    Dashboard
}

/// <summary>
/// Tipos de operações que podem ocorrer
/// </summary>
public enum OperationType
{
    Created,
    Updated,
    Deleted,
    StatusChanged
}

/// <summary>
/// DTO base para notificações de entidades
/// </summary>
public class EntityNotification
{
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public object? Data { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? TriggeredByUserId { get; set; }
}

/// <summary>
/// DTO para atualização de dashboard/estatísticas
/// </summary>
public class DashboardUpdateNotification
{
    public string StatType { get; set; } = string.Empty; // TotalUsers, TotalAppointments, etc.
    public object? Value { get; set; }
    public object? PreviousValue { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// DTO para notificações do usuário (sino)
/// </summary>
public class UserNotificationUpdate
{
    public string NotificationId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
    public int UnreadCount { get; set; }
}

/// <summary>
/// DTO para atualização de status de consulta
/// </summary>
public class AppointmentStatusUpdate
{
    public string AppointmentId { get; set; } = string.Empty;
    public string PreviousStatus { get; set; } = string.Empty;
    public string NewStatus { get; set; } = string.Empty;
    public string? PatientId { get; set; }
    public string? ProfessionalId { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

#endregion
