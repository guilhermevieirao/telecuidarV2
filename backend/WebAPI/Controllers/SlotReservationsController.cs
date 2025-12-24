using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WebAPI.Services;

namespace WebAPI.Controllers;

[ApiController]
[Route("api/slot-reservations")]
public class SlotReservationsController : ControllerBase
{
    private readonly ITemporarySlotReservationService _reservationService;
    private readonly ILogger<SlotReservationsController> _logger;

    public SlotReservationsController(
        ITemporarySlotReservationService reservationService,
        ILogger<SlotReservationsController> logger)
    {
        _reservationService = reservationService;
        _logger = logger;
    }

    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return userIdClaim != null ? Guid.Parse(userIdClaim) : null;
    }

    /// <summary>
    /// Reserva temporariamente um slot
    /// </summary>
    [Authorize]
    [HttpPost]
    public async Task<ActionResult<TemporarySlotReservation>> ReserveSlot([FromBody] ReserveSlotRequest request)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var reservation = await _reservationService.ReserveSlotAsync(
            request.ProfessionalId,
            request.SpecialtyId,
            request.Date,
            request.Time,
            userId.Value,
            5 // 5 minutos
        );

        if (reservation == null)
        {
            return Conflict(new { message = "Slot já está reservado por outro usuário" });
        }

        return Ok(reservation);
    }

    /// <summary>
    /// Libera uma reserva temporária
    /// </summary>
    [Authorize]
    [HttpDelete("{reservationId}")]
    public async Task<ActionResult> ReleaseReservation(string reservationId)
    {
        var result = await _reservationService.ReleaseReservationAsync(reservationId);
        
        if (!result)
        {
            return NotFound();
        }

        return NoContent();
    }

    /// <summary>
    /// Libera todas as reservas do usuário atual
    /// </summary>
    [Authorize]
    [HttpDelete("user/current")]
    public async Task<ActionResult> ReleaseCurrentUserReservations()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        await _reservationService.ReleaseUserReservationsAsync(userId.Value);
        return NoContent();
    }
}

public class ReserveSlotRequest
{
    public Guid ProfessionalId { get; set; }
    public Guid SpecialtyId { get; set; }
    public DateTime Date { get; set; }
    public string Time { get; set; } = string.Empty;
}
