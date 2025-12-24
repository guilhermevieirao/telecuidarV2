using Application.DTOs.Schedules;
using Application.Interfaces;
using WebAPI.Services;
using WebAPI.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WebAPI.Extensions;

namespace WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SchedulesController : ControllerBase
{
    private readonly IScheduleService _scheduleService;
    private readonly IAuditLogService _auditLogService;
    private readonly IRealTimeNotificationService _realTimeNotification;
    private readonly ITemporarySlotReservationService _reservationService;

    public SchedulesController(
        IScheduleService scheduleService, 
        IAuditLogService auditLogService,
        IRealTimeNotificationService realTimeNotification,
        ITemporarySlotReservationService reservationService)
    {
        _scheduleService = scheduleService;
        _auditLogService = auditLogService;
        _realTimeNotification = realTimeNotification;
        _reservationService = reservationService;
    }
    
    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return userIdClaim != null ? Guid.Parse(userIdClaim) : null;
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedSchedulesDto>> GetSchedules(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null)
    {
        try
        {
            var result = await _scheduleService.GetSchedulesAsync(page, pageSize, search, status);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpGet("professional/{professionalId}")]
    public async Task<ActionResult<List<ScheduleDto>>> GetSchedulesByProfessional(Guid professionalId)
    {
        var schedules = await _scheduleService.GetSchedulesByProfessionalAsync(professionalId);
        return Ok(schedules);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ScheduleDto>> GetSchedule(Guid id)
    {
        var schedule = await _scheduleService.GetScheduleByIdAsync(id);
        if (schedule == null)
            return NotFound();

        return Ok(schedule);
    }

    [HttpGet("professional/{professionalId}/availability")]
    public async Task<ActionResult<ProfessionalAvailabilityDto>> GetAvailability(
        Guid professionalId,
        [FromQuery] DateTime startDate,
        [FromQuery] DateTime endDate)
    {
        try
        {
            var availability = await _scheduleService.GetAvailabilitySlotsAsync(professionalId, startDate, endDate);
            
            // Filtrar slots reservados (exceto os do usuário atual)
            var currentUserId = GetCurrentUserId();
            availability.Slots = availability.Slots
                .Where(slot => !_reservationService.IsSlotReserved(professionalId, slot.Date, slot.Time, currentUserId))
                .ToList();
            
            return Ok(availability);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN,PROFESSIONAL")]
    public async Task<ActionResult<ScheduleDto>> CreateSchedule([FromBody] CreateScheduleDto dto)
    {
        var schedule = await _scheduleService.CreateScheduleAsync(dto);
        
        // Audit log
        await _auditLogService.CreateAuditLogAsync(
            GetCurrentUserId(),
            "create",
            "Schedule",
            schedule.Id.ToString(),
            null,
            HttpContextExtensions.SerializeToJson(new { schedule.ProfessionalId, schedule.ValidityStartDate, schedule.ValidityEndDate, schedule.Status }),
            HttpContext.GetIpAddress(),
            HttpContext.GetUserAgent()
        );
        
        // Real-time notification
        await _realTimeNotification.NotifyEntityCreatedAsync("Schedule", schedule.Id.ToString(), schedule, GetCurrentUserId()?.ToString());
        
        return CreatedAtAction(nameof(GetSchedule), new { id = schedule.Id }, schedule);
    }

    [HttpPatch("{id}")]
    [HttpPut("{id}")]
    [Authorize(Roles = "ADMIN,PROFESSIONAL")]
    public async Task<ActionResult<ScheduleDto>> UpdateSchedule(Guid id, [FromBody] UpdateScheduleDto dto)
    {
        var oldSchedule = await _scheduleService.GetScheduleByIdAsync(id);
        if (oldSchedule == null)
            return NotFound();
        
        var schedule = await _scheduleService.UpdateScheduleAsync(id, dto);
        
        // Audit log with differences
        var oldValues = oldSchedule != null ? HttpContextExtensions.SerializeToJson(new { oldSchedule.ValidityStartDate, oldSchedule.ValidityEndDate, oldSchedule.Status }) : null;
        var newValues = HttpContextExtensions.SerializeToJson(new { schedule?.ValidityStartDate, schedule?.ValidityEndDate, schedule?.Status });
        
        await _auditLogService.CreateAuditLogAsync(
            GetCurrentUserId(),
            "update",
            "Schedule",
            id.ToString(),
            oldValues,
            newValues,
            HttpContext.GetIpAddress(),
            HttpContext.GetUserAgent()
        );
        
        // Real-time notification
        await _realTimeNotification.NotifyEntityUpdatedAsync("Schedule", id.ToString(), schedule!, GetCurrentUserId()?.ToString());

        return Ok(schedule);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN,PROFESSIONAL")]
    public async Task<ActionResult> DeleteSchedule(Guid id)
    {
        var schedule = await _scheduleService.GetScheduleByIdAsync(id);
        if (schedule == null)
            return NotFound();
        
        var result = await _scheduleService.DeleteScheduleAsync(id);
        
        // Audit log
        await _auditLogService.CreateAuditLogAsync(
            GetCurrentUserId(),
            "delete",
            "Schedule",
            id.ToString(),
            HttpContextExtensions.SerializeToJson(new { schedule.ProfessionalId, schedule.ValidityStartDate, schedule.ValidityEndDate, schedule.Status }),
            null,
            HttpContext.GetIpAddress(),
            HttpContext.GetUserAgent()
        );
        
        // Real-time notification
        await _realTimeNotification.NotifyEntityDeletedAsync("Schedule", id.ToString(), GetCurrentUserId()?.ToString());

        return Ok(new { message = "Schedule deleted successfully" });
    }
}
