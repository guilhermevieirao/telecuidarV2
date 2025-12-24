using System.Collections.Concurrent;
using System.Timers;

namespace WebAPI.Services;

/// <summary>
/// Representa uma reserva temporária de um slot
/// </summary>
public class TemporarySlotReservation
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public Guid ProfessionalId { get; set; }
    public Guid SpecialtyId { get; set; }
    public DateTime Date { get; set; }
    public string Time { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public DateTime ExpiresAt { get; set; }
}

/// <summary>
/// Interface para o serviço de reservas temporárias
/// </summary>
public interface ITemporarySlotReservationService
{
    /// <summary>
    /// Cria uma reserva temporária de slot
    /// </summary>
    Task<TemporarySlotReservation?> ReserveSlotAsync(Guid professionalId, Guid specialtyId, DateTime date, string time, Guid userId, int durationMinutes = 5);
    
    /// <summary>
    /// Libera uma reserva temporária
    /// </summary>
    Task<bool> ReleaseReservationAsync(string reservationId);
    
    /// <summary>
    /// Libera todas as reservas de um usuário
    /// </summary>
    Task ReleaseUserReservationsAsync(Guid userId);
    
    /// <summary>
    /// Verifica se um slot está reservado
    /// </summary>
    bool IsSlotReserved(Guid professionalId, DateTime date, string time, Guid? excludeUserId = null);
    
    /// <summary>
    /// Obtém reserva ativa de um usuário para um slot específico
    /// </summary>
    TemporarySlotReservation? GetUserReservation(Guid userId, Guid professionalId, DateTime date, string time);
}

/// <summary>
/// Implementação do serviço de reservas temporárias de slots
/// </summary>
public class TemporarySlotReservationService : ITemporarySlotReservationService, IDisposable
{
    private readonly ConcurrentDictionary<string, TemporarySlotReservation> _reservations = new();
    private readonly ISchedulingNotificationService _notificationService;
    private readonly ILogger<TemporarySlotReservationService> _logger;
    private readonly System.Timers.Timer _cleanupTimer;

    public TemporarySlotReservationService(
        ISchedulingNotificationService notificationService,
        ILogger<TemporarySlotReservationService> logger)
    {
        _notificationService = notificationService;
        _logger = logger;
        
        // Timer para limpar reservas expiradas a cada minuto
        _cleanupTimer = new System.Timers.Timer(60000); // 60 segundos
        _cleanupTimer.Elapsed += CleanupExpiredReservations;
        _cleanupTimer.AutoReset = true;
        _cleanupTimer.Start();
    }

    public async Task<TemporarySlotReservation?> ReserveSlotAsync(
        Guid professionalId, 
        Guid specialtyId, 
        DateTime date, 
        string time, 
        Guid userId, 
        int durationMinutes = 5)
    {
        // Verificar se o slot já está reservado por outro usuário
        if (IsSlotReserved(professionalId, date, time, userId))
        {
            _logger.LogWarning(
                "Tentativa de reservar slot já reservado: Professional {ProfessionalId}, Data {Date}, Hora {Time}",
                professionalId, date.ToString("yyyy-MM-dd"), time);
            return null;
        }

        // Liberar qualquer reserva anterior do usuário
        await ReleaseUserReservationsAsync(userId);

        var reservation = new TemporarySlotReservation
        {
            ProfessionalId = professionalId,
            SpecialtyId = specialtyId,
            Date = date,
            Time = time,
            UserId = userId,
            ExpiresAt = DateTime.UtcNow.AddMinutes(durationMinutes)
        };

        _reservations[reservation.Id] = reservation;

        _logger.LogInformation(
            "Reserva temporária criada: {ReservationId}, Professional {ProfessionalId}, Data {Date}, Hora {Time}, Usuário {UserId}, Expira em {ExpiresAt}",
            reservation.Id, professionalId, date.ToString("yyyy-MM-dd"), time, userId, reservation.ExpiresAt);

        // Notificar outros usuários que o slot está temporariamente indisponível
        await _notificationService.NotifySlotUpdateAsync(
            professionalId.ToString(),
            specialtyId.ToString(),
            date,
            time,
            false,
            null,
            userId.ToString()
        );

        // Notificar atualização do dia (decremento de 1 slot)
        await _notificationService.NotifyDayUpdateAsync(
            professionalId.ToString(),
            specialtyId.ToString(),
            date,
            -1, // Slot reservado = -1
            userId.ToString()
        );

        // Notificar atualização dos profissionais disponíveis no slot
        await _notificationService.NotifySlotProfessionalsUpdateAsync(
            specialtyId.ToString(),
            date,
            time,
            professionalId.ToString(),
            false, // Profissional não disponível neste slot
            userId.ToString()
        );

        return reservation;
    }

    public async Task<bool> ReleaseReservationAsync(string reservationId)
    {
        if (_reservations.TryRemove(reservationId, out var reservation))
        {
            _logger.LogInformation(
                "Reserva liberada: {ReservationId}, Professional {ProfessionalId}, Data {Date}, Hora {Time}",
                reservationId, reservation.ProfessionalId, reservation.Date.ToString("yyyy-MM-dd"), reservation.Time);

            // Notificar que o slot está disponível novamente
            await _notificationService.NotifySlotUpdateAsync(
                reservation.ProfessionalId.ToString(),
                reservation.SpecialtyId.ToString(),
                reservation.Date,
                reservation.Time,
                true,
                null,
                reservation.UserId.ToString()
            );

            // Notificar atualização do dia (incremento de 1 slot)
            await _notificationService.NotifyDayUpdateAsync(
                reservation.ProfessionalId.ToString(),
                reservation.SpecialtyId.ToString(),
                reservation.Date,
                1, // Slot liberado = +1
                reservation.UserId.ToString()
            );

            // Notificar atualização dos profissionais disponíveis no slot
            await _notificationService.NotifySlotProfessionalsUpdateAsync(
                reservation.SpecialtyId.ToString(),
                reservation.Date,
                reservation.Time,
                reservation.ProfessionalId.ToString(),
                true, // Profissional disponível novamente neste slot
                reservation.UserId.ToString()
            );

            return true;
        }

        return false;
    }

    public async Task ReleaseUserReservationsAsync(Guid userId)
    {
        var userReservations = _reservations.Values
            .Where(r => r.UserId == userId)
            .ToList();

        foreach (var reservation in userReservations)
        {
            await ReleaseReservationAsync(reservation.Id);
        }
    }

    public bool IsSlotReserved(Guid professionalId, DateTime date, string time, Guid? excludeUserId = null)
    {
        var now = DateTime.UtcNow;
        
        return _reservations.Values.Any(r =>
            r.ProfessionalId == professionalId &&
            r.Date.Date == date.Date &&
            r.Time == time &&
            r.ExpiresAt > now &&
            (!excludeUserId.HasValue || r.UserId != excludeUserId.Value));
    }

    public TemporarySlotReservation? GetUserReservation(Guid userId, Guid professionalId, DateTime date, string time)
    {
        var now = DateTime.UtcNow;
        
        return _reservations.Values.FirstOrDefault(r =>
            r.UserId == userId &&
            r.ProfessionalId == professionalId &&
            r.Date.Date == date.Date &&
            r.Time == time &&
            r.ExpiresAt > now);
    }

    private async void CleanupExpiredReservations(object? sender, ElapsedEventArgs e)
    {
        var now = DateTime.UtcNow;
        var expiredReservations = _reservations.Values
            .Where(r => r.ExpiresAt <= now)
            .ToList();

        foreach (var reservation in expiredReservations)
        {
            _logger.LogInformation(
                "Limpando reserva expirada: {ReservationId}, Professional {ProfessionalId}, Data {Date}, Hora {Time}",
                reservation.Id, reservation.ProfessionalId, reservation.Date.ToString("yyyy-MM-dd"), reservation.Time);

            await ReleaseReservationAsync(reservation.Id);
        }
    }

    public void Dispose()
    {
        _cleanupTimer?.Stop();
        _cleanupTimer?.Dispose();
    }
}
