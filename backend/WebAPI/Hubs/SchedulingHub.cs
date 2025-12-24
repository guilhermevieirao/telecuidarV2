using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using WebAPI.Services;

namespace WebAPI.Hubs;

/// <summary>
/// SignalR Hub para atualizações em tempo real de agendamentos
/// </summary>
public class SchedulingHub : Hub
{
    private readonly ILogger<SchedulingHub> _logger;
    private readonly IUserConnectionService _userConnectionService;

    public SchedulingHub(ILogger<SchedulingHub> logger, IUserConnectionService userConnectionService)
    {
        _logger = logger;
        _userConnectionService = userConnectionService;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Cliente conectado ao SchedulingHub: {ConnectionId}", Context.ConnectionId);
        
        // Adicionar ao grupo do próprio usuário e rastrear conexão (se autenticado)
        var userId = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
            _userConnectionService.AddConnection(userId, Context.ConnectionId);
            _logger.LogInformation("Cliente {ConnectionId} adicionado ao grupo do usuário {UserId}", Context.ConnectionId, userId);
        }
        
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Cliente desconectado do SchedulingHub: {ConnectionId}", Context.ConnectionId);
        
        // Remover rastreamento de conexão
        var userId = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userId))
        {
            _userConnectionService.RemoveConnection(userId, Context.ConnectionId);
        }
        
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Inscreve o cliente para receber atualizações de uma especialidade específica
    /// </summary>
    public async Task JoinSpecialtyGroup(string specialtyId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"specialty_{specialtyId}");
        _logger.LogInformation("Cliente {ConnectionId} inscrito na especialidade {SpecialtyId}", Context.ConnectionId, specialtyId);
    }

    /// <summary>
    /// Remove a inscrição do cliente de uma especialidade
    /// </summary>
    public async Task LeaveSpecialtyGroup(string specialtyId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"specialty_{specialtyId}");
        _logger.LogInformation("Cliente {ConnectionId} removido da especialidade {SpecialtyId}", Context.ConnectionId, specialtyId);
    }

    /// <summary>
    /// Inscreve o cliente para receber atualizações de um profissional específico
    /// </summary>
    public async Task JoinProfessionalGroup(string professionalId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"professional_{professionalId}");
        _logger.LogInformation("Cliente {ConnectionId} inscrito no profissional {ProfessionalId}", Context.ConnectionId, professionalId);
    }

    /// <summary>
    /// Remove a inscrição do cliente de um profissional
    /// </summary>
    public async Task LeaveProfessionalGroup(string professionalId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"professional_{professionalId}");
        _logger.LogInformation("Cliente {ConnectionId} removido do profissional {ProfessionalId}", Context.ConnectionId, professionalId);
    }
}

/// <summary>
/// DTO para notificações de atualização de slots
/// </summary>
public class SlotUpdateNotification
{
    public string ProfessionalId { get; set; } = string.Empty;
    public string SpecialtyId { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string Time { get; set; } = string.Empty;
    public bool IsAvailable { get; set; }
    public string? AppointmentId { get; set; }
}

/// <summary>
/// DTO para notificações de atualização de dia
/// </summary>
public class DayUpdateNotification
{
    public string ProfessionalId { get; set; } = string.Empty;
    public string SpecialtyId { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public int AvailableSlotsCount { get; set; }
    public bool HasAvailability { get; set; }
    /// <summary>
    /// Delta de slots: -1 quando um slot é reservado, +1 quando é liberado
    /// </summary>
    public int SlotsDelta { get; set; }
}

/// <summary>
/// DTO para notificações de atualização de disponibilidade de especialidade
/// </summary>
public class SpecialtyAvailabilityNotification
{
    public string SpecialtyId { get; set; } = string.Empty;
    public bool HasAvailability { get; set; }
    /// <summary>
    /// Delta de profissionais disponíveis: -1 quando um profissional fica sem vagas, +1 quando volta a ter
    /// </summary>
    public int ProfessionalsDelta { get; set; }
}

/// <summary>
/// DTO para notificações de atualização de slot com contagem de profissionais
/// </summary>
public class SlotProfessionalsUpdateNotification
{
    public string SpecialtyId { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string Time { get; set; } = string.Empty;
    public string ProfessionalId { get; set; } = string.Empty;
    public bool IsAvailable { get; set; }
}

/// <summary>
/// DTO para notificações de bloqueio de agenda
/// </summary>
public class ScheduleBlockNotification
{
    public string ProfessionalId { get; set; } = string.Empty;
    public string BlockType { get; set; } = string.Empty; // "Single" ou "Range"
    public DateTime? Date { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool IsBlocked { get; set; } // true = bloqueado, false = desbloqueado
}
