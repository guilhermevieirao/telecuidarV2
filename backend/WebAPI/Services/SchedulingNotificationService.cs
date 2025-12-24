using Microsoft.AspNetCore.SignalR;
using WebAPI.Hubs;

namespace WebAPI.Services;

/// <summary>
/// Interface para o serviço de notificação de agendamentos em tempo real
/// </summary>
public interface ISchedulingNotificationService
{
    /// <summary>
    /// Notifica todos os clientes interessados sobre uma atualização de slot
    /// </summary>
    Task NotifySlotUpdateAsync(string professionalId, string specialtyId, DateTime date, string time, bool isAvailable, string? appointmentId = null, string? excludeUserId = null);

    /// <summary>
    /// Notifica todos os clientes interessados sobre uma atualização de disponibilidade de dia
    /// </summary>
    Task NotifyDayUpdateAsync(string professionalId, string specialtyId, DateTime date, int slotsDelta, string? excludeUserId = null);

    /// <summary>
    /// Notifica sobre mudança na disponibilidade de uma especialidade
    /// </summary>
    Task NotifySpecialtyAvailabilityAsync(string specialtyId, bool hasAvailability, int professionalsDelta, string? excludeUserId = null);

    /// <summary>
    /// Notifica sobre mudança nos profissionais disponíveis para um slot
    /// </summary>
    Task NotifySlotProfessionalsUpdateAsync(string specialtyId, DateTime date, string time, string professionalId, bool isAvailable, string? excludeUserId = null);

    /// <summary>
    /// Notifica que um novo agendamento foi criado
    /// </summary>
    Task NotifyAppointmentCreatedAsync(string professionalId, string specialtyId, DateTime date, string time, string appointmentId, string? excludeUserId = null);

    /// <summary>
    /// Notifica que um agendamento foi cancelado
    /// </summary>
    Task NotifyAppointmentCancelledAsync(string professionalId, string specialtyId, DateTime date, string time, string appointmentId);

    /// <summary>
    /// Notifica que um bloqueio de agenda foi aprovado ou cancelado
    /// </summary>
    Task NotifyScheduleBlockChangedAsync(string professionalId, string blockType, DateTime? date, DateTime? startDate, DateTime? endDate, bool isBlocked);
}

/// <summary>
/// Implementação do serviço de notificação de agendamentos em tempo real
/// </summary>
public class SchedulingNotificationService : ISchedulingNotificationService
{
    private readonly IHubContext<SchedulingHub> _hubContext;
    private readonly ILogger<SchedulingNotificationService> _logger;
    private readonly IUserConnectionService _userConnectionService;

    public SchedulingNotificationService(
        IHubContext<SchedulingHub> hubContext,
        ILogger<SchedulingNotificationService> logger,
        IUserConnectionService userConnectionService)
    {
        _hubContext = hubContext;
        _logger = logger;
        _userConnectionService = userConnectionService;
    }

    public async Task NotifySlotUpdateAsync(string professionalId, string specialtyId, DateTime date, string time, bool isAvailable, string? appointmentId = null, string? excludeUserId = null)
    {
        var notification = new SlotUpdateNotification
        {
            ProfessionalId = professionalId,
            SpecialtyId = specialtyId,
            Date = date,
            Time = time,
            IsAvailable = isAvailable,
            AppointmentId = appointmentId
        };

        _logger.LogInformation(
            "Notificando atualização de slot: Profissional {ProfessionalId}, Especialidade {SpecialtyId}, Data {Date}, Hora {Time}, Disponível: {IsAvailable}, Excluir usuário: {ExcludeUserId}",
            professionalId, specialtyId, date.ToString("yyyy-MM-dd"), time, isAvailable, excludeUserId ?? "nenhum");

        // Determinar clientes a notificar
        IClientProxy targetClients;
        
        if (!string.IsNullOrEmpty(excludeUserId))
        {
            // Obter connection IDs do usuário a excluir
            var excludeConnectionIds = _userConnectionService.GetConnections(excludeUserId);
            
            if (excludeConnectionIds.Any())
            {
                targetClients = _hubContext.Clients.AllExcept(excludeConnectionIds);
                _logger.LogInformation("Excluindo {Count} conexões do usuário {UserId}", excludeConnectionIds.Count, excludeUserId);
            }
            else
            {
                targetClients = _hubContext.Clients.All;
            }
        }
        else
        {
            targetClients = _hubContext.Clients.All;
        }

        // Enviar notificação apenas UMA vez para todos (exceto o usuário excluído)
        await targetClients.SendAsync("SlotUpdated", notification);
    }

    public async Task NotifyDayUpdateAsync(string professionalId, string specialtyId, DateTime date, int slotsDelta, string? excludeUserId = null)
    {
        var notification = new DayUpdateNotification
        {
            ProfessionalId = professionalId,
            SpecialtyId = specialtyId,
            Date = date,
            AvailableSlotsCount = 0, // Não usado mais, usar SlotsDelta
            HasAvailability = true, // Será calculado no frontend
            SlotsDelta = slotsDelta
        };

        _logger.LogInformation(
            "Notificando atualização de dia: Profissional {ProfessionalId}, Especialidade {SpecialtyId}, Data {Date}, Delta: {SlotsDelta}",
            professionalId, specialtyId, date.ToString("yyyy-MM-dd"), slotsDelta);

        // Determinar clientes a notificar
        IClientProxy targetClients;
        
        if (!string.IsNullOrEmpty(excludeUserId))
        {
            var excludeConnectionIds = _userConnectionService.GetConnections(excludeUserId);
            
            if (excludeConnectionIds.Any())
            {
                targetClients = _hubContext.Clients.AllExcept(excludeConnectionIds);
            }
            else
            {
                targetClients = _hubContext.Clients.All;
            }
        }
        else
        {
            targetClients = _hubContext.Clients.All;
        }

        await targetClients.SendAsync("DayUpdated", notification);
    }

    public async Task NotifySpecialtyAvailabilityAsync(string specialtyId, bool hasAvailability, int professionalsDelta, string? excludeUserId = null)
    {
        var notification = new SpecialtyAvailabilityNotification
        {
            SpecialtyId = specialtyId,
            HasAvailability = hasAvailability,
            ProfessionalsDelta = professionalsDelta
        };

        _logger.LogInformation(
            "Notificando disponibilidade de especialidade: {SpecialtyId}, Disponível: {HasAvailability}, Delta profissionais: {ProfessionalsDelta}",
            specialtyId, hasAvailability, professionalsDelta);

        IClientProxy targetClients = GetTargetClients(excludeUserId);
        await targetClients.SendAsync("SpecialtyAvailabilityUpdated", notification);
    }

    public async Task NotifySlotProfessionalsUpdateAsync(string specialtyId, DateTime date, string time, string professionalId, bool isAvailable, string? excludeUserId = null)
    {
        var notification = new SlotProfessionalsUpdateNotification
        {
            SpecialtyId = specialtyId,
            Date = date,
            Time = time,
            ProfessionalId = professionalId,
            IsAvailable = isAvailable
        };

        _logger.LogInformation(
            "Notificando atualização de profissional no slot: Especialidade {SpecialtyId}, Data {Date}, Hora {Time}, Profissional {ProfessionalId}, Disponível: {IsAvailable}",
            specialtyId, date.ToString("yyyy-MM-dd"), time, professionalId, isAvailable);

        IClientProxy targetClients = GetTargetClients(excludeUserId);
        await targetClients.SendAsync("SlotProfessionalsUpdated", notification);
    }

    private IClientProxy GetTargetClients(string? excludeUserId)
    {
        if (!string.IsNullOrEmpty(excludeUserId))
        {
            var excludeConnectionIds = _userConnectionService.GetConnections(excludeUserId);
            if (excludeConnectionIds.Any())
            {
                return _hubContext.Clients.AllExcept(excludeConnectionIds);
            }
        }
        return _hubContext.Clients.All;
    }

    public async Task NotifyAppointmentCreatedAsync(string professionalId, string specialtyId, DateTime date, string time, string appointmentId, string? excludeUserId = null)
    {
        await NotifySlotUpdateAsync(professionalId, specialtyId, date, time, false, appointmentId, excludeUserId);
    }

    public async Task NotifyAppointmentCancelledAsync(string professionalId, string specialtyId, DateTime date, string time, string appointmentId)
    {
        await NotifySlotUpdateAsync(professionalId, specialtyId, date, time, true, appointmentId);
    }

    public async Task NotifyScheduleBlockChangedAsync(string professionalId, string blockType, DateTime? date, DateTime? startDate, DateTime? endDate, bool isBlocked)
    {
        var notification = new ScheduleBlockNotification
        {
            ProfessionalId = professionalId,
            BlockType = blockType,
            Date = date,
            StartDate = startDate,
            EndDate = endDate,
            IsBlocked = isBlocked
        };

        _logger.LogInformation(
            "Notificando mudança de bloqueio de agenda: Profissional {ProfessionalId}, Tipo {BlockType}, Bloqueado: {IsBlocked}",
            professionalId, blockType, isBlocked);

        await _hubContext.Clients.All.SendAsync("ScheduleBlockChanged", notification);
    }
}
