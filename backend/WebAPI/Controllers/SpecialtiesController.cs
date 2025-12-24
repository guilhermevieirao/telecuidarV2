using Application.DTOs.Specialties;
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
public class SpecialtiesController : ControllerBase
{
    private readonly ISpecialtyService _specialtyService;
    private readonly IAuditLogService _auditLogService;
    private readonly IRealTimeNotificationService _realTimeNotification;

    public SpecialtiesController(
        ISpecialtyService specialtyService, 
        IAuditLogService auditLogService,
        IRealTimeNotificationService realTimeNotification)
    {
        _specialtyService = specialtyService;
        _auditLogService = auditLogService;
        _realTimeNotification = realTimeNotification;
    }
    
    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return userIdClaim != null ? Guid.Parse(userIdClaim) : null;
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedSpecialtiesDto>> GetSpecialties(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null)
    {
        try
        {
            var result = await _specialtyService.GetSpecialtiesAsync(page, pageSize, search, status);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SpecialtyDto>> GetSpecialty(Guid id)
    {
        try
        {
            var specialty = await _specialtyService.GetSpecialtyByIdAsync(id);
            if (specialty == null)
            {
                return NotFound(new { message = "Specialty not found" });
            }
            return Ok(specialty);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<SpecialtyDto>> CreateSpecialty([FromBody] CreateSpecialtyDto dto)
    {
        try
        {
            var specialty = await _specialtyService.CreateSpecialtyAsync(dto);
            
            // Audit log
            await _auditLogService.CreateAuditLogAsync(
                GetCurrentUserId(),
                "create",
                "Specialty",
                specialty.Id.ToString(),
                null,
                HttpContextExtensions.SerializeToJson(new { specialty.Name, specialty.Description, specialty.Status }),
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityCreatedAsync("Specialty", specialty.Id.ToString(), specialty, GetCurrentUserId()?.ToString());
            
            return CreatedAtAction(nameof(GetSpecialty), new { id = specialty.Id }, specialty);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<SpecialtyDto>> UpdateSpecialty(Guid id, [FromBody] UpdateSpecialtyDto dto)
    {
        try
        {
            var oldSpecialty = await _specialtyService.GetSpecialtyByIdAsync(id);
            if (oldSpecialty == null)
            {
                return NotFound(new { message = "Specialty not found" });
            }
            
            var specialty = await _specialtyService.UpdateSpecialtyAsync(id, dto);
            
            // Audit log with differences
            var oldValues = oldSpecialty != null ? HttpContextExtensions.SerializeToJson(new { oldSpecialty.Name, oldSpecialty.Description, oldSpecialty.Status }) : null;
            var newValues = HttpContextExtensions.SerializeToJson(new { specialty?.Name, specialty?.Description, specialty?.Status });
            
            await _auditLogService.CreateAuditLogAsync(
                GetCurrentUserId(),
                "update",
                "Specialty",
                id.ToString(),
                oldValues,
                newValues,
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityUpdatedAsync("Specialty", id.ToString(), specialty!, GetCurrentUserId()?.ToString());
            
            return Ok(specialty);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> DeleteSpecialty(Guid id)
    {
        try
        {
            var specialty = await _specialtyService.GetSpecialtyByIdAsync(id);
            if (specialty == null)
            {
                return NotFound(new { message = "Specialty not found" });
            }
            
            var result = await _specialtyService.DeleteSpecialtyAsync(id);
            
            // Audit log
            await _auditLogService.CreateAuditLogAsync(
                GetCurrentUserId(),
                "delete",
                "Specialty",
                id.ToString(),
                HttpContextExtensions.SerializeToJson(new { specialty.Name, specialty.Description }),
                null,
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityDeletedAsync("Specialty", id.ToString(), GetCurrentUserId()?.ToString());
            
            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }
}
