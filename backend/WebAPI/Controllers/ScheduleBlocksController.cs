using Application.DTOs.ScheduleBlocks;
using Application.Interfaces;
using Domain.Entities;
using WebAPI.Services;
using WebAPI.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ScheduleBlocksController : ControllerBase
{
    private readonly IScheduleBlockService _scheduleBlockService;
    private readonly IAuditLogService _auditLogService;
    private readonly IRealTimeNotificationService _realTimeNotification;
    private readonly ISchedulingNotificationService _schedulingNotification;

    public ScheduleBlocksController(
        IScheduleBlockService scheduleBlockService, 
        IAuditLogService auditLogService,
        IRealTimeNotificationService realTimeNotification,
        ISchedulingNotificationService schedulingNotification)
    {
        _scheduleBlockService = scheduleBlockService;
        _auditLogService = auditLogService;
        _realTimeNotification = realTimeNotification;
        _schedulingNotification = schedulingNotification;
    }

    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return userIdClaim != null ? Guid.Parse(userIdClaim) : null;
    }

    [HttpGet]
    public async Task<ActionResult> GetScheduleBlocks(
        [FromQuery] Guid? professionalId = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            ScheduleBlockStatus? statusEnum = null;
            if (!string.IsNullOrEmpty(status) && Enum.TryParse<ScheduleBlockStatus>(status, true, out var parsedStatus))
            {
                statusEnum = parsedStatus;
            }

            var (data, total) = await _scheduleBlockService.GetScheduleBlocksAsync(
                professionalId,
                statusEnum,
                page,
                pageSize);

            var totalPages = (int)Math.Ceiling(total / (double)pageSize);

            return Ok(new
            {
                data,
                total,
                page,
                pageSize,
                totalPages
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ScheduleBlockDto>> GetScheduleBlockById(Guid id)
    {
        try
        {
            var block = await _scheduleBlockService.GetScheduleBlockByIdAsync(id);
            if (block == null)
            {
                return NotFound(new { message = "Schedule block not found" });
            }

            return Ok(block);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<ScheduleBlockDto>> CreateScheduleBlock([FromBody] CreateScheduleBlockDto dto)
    {
        try
        {
            // Log incoming data for debugging
            Console.WriteLine($"[CreateScheduleBlock] Received: ProfessionalId={dto.ProfessionalId}, Type={dto.Type}, Date={dto.Date}, StartDate={dto.StartDate}, EndDate={dto.EndDate}, Reason={dto.Reason}");

            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Validate model state
            if (!ModelState.IsValid)
            {
                var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage);
                return BadRequest(new { message = "Validation failed", errors });
            }

            var block = await _scheduleBlockService.CreateScheduleBlockAsync(dto);

            await _auditLogService.CreateAuditLogAsync(
                userId.Value,
                "Create",
                "ScheduleBlock",
                block.Id.ToString(),
                null,
                $"Created schedule block for {block.Reason}",
                Request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown",
                Request.Headers.UserAgent.ToString()
            );
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityCreatedAsync("ScheduleBlock", block.Id.ToString(), block, userId?.ToString());

            return CreatedAtAction(nameof(GetScheduleBlockById), new { id = block.Id }, block);
        }
        catch (ArgumentException ex)
        {
            Console.WriteLine($"[CreateScheduleBlock] ArgumentException: {ex.Message}");
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            Console.WriteLine($"[CreateScheduleBlock] InvalidOperationException: {ex.Message}");
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CreateScheduleBlock] Exception: {ex.Message}");
            Console.WriteLine($"[CreateScheduleBlock] Stack: {ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult<ScheduleBlockDto>> UpdateScheduleBlock(Guid id, [FromBody] UpdateScheduleBlockDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var block = await _scheduleBlockService.UpdateScheduleBlockAsync(id, dto);
            if (block == null)
            {
                return NotFound(new { message = "Schedule block not found" });
            }

            await _auditLogService.CreateAuditLogAsync(
                userId.Value,
                "Update",
                "ScheduleBlock",
                id.ToString(),
                null,
                $"Updated schedule block",
                Request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown",
                Request.Headers.UserAgent.ToString()
            );
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityUpdatedAsync("ScheduleBlock", id.ToString(), block, userId?.ToString());

            return Ok(block);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteScheduleBlock(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Obter dados do bloco antes de deletar para notificação
            var block = await _scheduleBlockService.GetScheduleBlockByIdAsync(id);
            if (block == null)
            {
                return NotFound(new { message = "Schedule block not found" });
            }

            var success = await _scheduleBlockService.DeleteScheduleBlockAsync(id);
            if (!success)
            {
                return NotFound(new { message = "Schedule block not found" });
            }

            await _auditLogService.CreateAuditLogAsync(
                userId.Value,
                "Delete",
                "ScheduleBlock",
                id.ToString(),
                null,
                $"Deleted schedule block",
                Request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown",
                Request.Headers.UserAgent.ToString()
            );
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityDeletedAsync("ScheduleBlock", id.ToString(), userId?.ToString());
            
            // Notificar componentes de agendamento sobre o desbloqueio (se estava aprovado)
            if (block.Status == ScheduleBlockStatus.Approved)
            {
                await _schedulingNotification.NotifyScheduleBlockChangedAsync(
                    block.ProfessionalId.ToString(),
                    block.Type.ToString(),
                    block.Date,
                    block.StartDate,
                    block.EndDate,
                    false // isBlocked = false (desbloqueado)
                );
            }

            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<ScheduleBlockDto>> ApproveScheduleBlock(Guid id, [FromBody] ApproveScheduleBlockDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var block = await _scheduleBlockService.ApproveScheduleBlockAsync(id, dto);
            if (block == null)
            {
                return NotFound(new { message = "Schedule block not found" });
            }

            await _auditLogService.CreateAuditLogAsync(
                userId.Value,
                "Approve",
                "ScheduleBlock",
                id.ToString(),
                null,
                $"Approved schedule block",
                Request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown",
                Request.Headers.UserAgent.ToString()
            );
            
            // Real-time notification for entity update
            await _realTimeNotification.NotifyEntityUpdatedAsync("ScheduleBlock", id.ToString(), block, userId?.ToString());
            
            // Notificar componentes de agendamento sobre o bloqueio
            await _schedulingNotification.NotifyScheduleBlockChangedAsync(
                block.ProfessionalId.ToString(),
                block.Type.ToString(),
                block.Date,
                block.StartDate,
                block.EndDate,
                true // isBlocked
            );

            return Ok(block);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost("{id}/reject")]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<ScheduleBlockDto>> RejectScheduleBlock(Guid id, [FromBody] RejectScheduleBlockDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var block = await _scheduleBlockService.RejectScheduleBlockAsync(id, dto);
            if (block == null)
            {
                return NotFound(new { message = "Schedule block not found" });
            }

            await _auditLogService.CreateAuditLogAsync(
                userId.Value,
                "Reject",
                "ScheduleBlock",
                id.ToString(),
                null,
                $"Rejected schedule block: {dto.RejectionReason}",
                Request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown",
                Request.Headers.UserAgent.ToString()
            );
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityUpdatedAsync("ScheduleBlock", id.ToString(), block, userId?.ToString());

            return Ok(block);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpGet("check-conflict")]
    public async Task<ActionResult<bool>> CheckScheduleBlockConflict(
        [FromQuery] Guid professionalId,
        [FromQuery] DateTime? date = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] Guid? excludeBlockId = null)
    {
        try
        {
            var hasConflict = await _scheduleBlockService.CheckScheduleBlockConflictAsync(
                professionalId,
                date,
                startDate,
                endDate,
                excludeBlockId);

            return Ok(new { hasConflict });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }
}
