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
    Task NotifySlotUpdateAsync(string professionalId, string specialtyId, DateTime date, string time, bool isAvailable, string? appointmentId = null);

    /// <summary>
    /// Notifica todos os clientes interessados sobre uma atualização de disponibilidade de dia
    /// </summary>
    Task NotifyDayUpdateAsync(string professionalId, string specialtyId, DateTime date, int availableSlotsCount);

    /// <summary>
    /// Notifica que um novo agendamento foi criado
    /// </summary>
    Task NotifyAppointmentCreatedAsync(string professionalId, string specialtyId, DateTime date, string time, string appointmentId);

    /// <summary>
    /// Notifica que um agendamento foi cancelado
    /// </summary>
    Task NotifyAppointmentCancelledAsync(string professionalId, string specialtyId, DateTime date, string time, string appointmentId);
}

/// <summary>
/// Implementação do serviço de notificação de agendamentos em tempo real
/// </summary>
public class SchedulingNotificationService : ISchedulingNotificationService
{
    private readonly IHubContext<SchedulingHub> _hubContext;
    private readonly ILogger<SchedulingNotificationService> _logger;

    public SchedulingNotificationService(
        IHubContext<SchedulingHub> hubContext,
        ILogger<SchedulingNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task NotifySlotUpdateAsync(string professionalId, string specialtyId, DateTime date, string time, bool isAvailable, string? appointmentId = null)
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
            "Notificando atualização de slot: Profissional {ProfessionalId}, Especialidade {SpecialtyId}, Data {Date}, Hora {Time}, Disponível: {IsAvailable}",
            professionalId, specialtyId, date.ToString("yyyy-MM-dd"), time, isAvailable);

        // Notificar grupo da especialidade
        await _hubContext.Clients.Group($"specialty_{specialtyId}")
            .SendAsync("SlotUpdated", notification);

        // Notificar grupo do profissional
        await _hubContext.Clients.Group($"professional_{professionalId}")
            .SendAsync("SlotUpdated", notification);

        // Notificar todos os clientes conectados (broadcast)
        await _hubContext.Clients.All
            .SendAsync("SlotUpdated", notification);
    }

    public async Task NotifyDayUpdateAsync(string professionalId, string specialtyId, DateTime date, int availableSlotsCount)
    {
        var notification = new DayUpdateNotification
        {
            ProfessionalId = professionalId,
            SpecialtyId = specialtyId,
            Date = date,
            AvailableSlotsCount = availableSlotsCount,
            HasAvailability = availableSlotsCount > 0
        };

        _logger.LogInformation(
            "Notificando atualização de dia: Profissional {ProfessionalId}, Especialidade {SpecialtyId}, Data {Date}, Slots disponíveis: {SlotsCount}",
            professionalId, specialtyId, date.ToString("yyyy-MM-dd"), availableSlotsCount);

        // Notificar grupo da especialidade
        await _hubContext.Clients.Group($"specialty_{specialtyId}")
            .SendAsync("DayUpdated", notification);

        // Notificar grupo do profissional
        await _hubContext.Clients.Group($"professional_{professionalId}")
            .SendAsync("DayUpdated", notification);

        // Notificar todos os clientes conectados (broadcast)
        await _hubContext.Clients.All
            .SendAsync("DayUpdated", notification);
    }

    public async Task NotifyAppointmentCreatedAsync(string professionalId, string specialtyId, DateTime date, string time, string appointmentId)
    {
        await NotifySlotUpdateAsync(professionalId, specialtyId, date, time, false, appointmentId);
    }

    public async Task NotifyAppointmentCancelledAsync(string professionalId, string specialtyId, DateTime date, string time, string appointmentId)
    {
        await NotifySlotUpdateAsync(professionalId, specialtyId, date, time, true, appointmentId);
    }
}
