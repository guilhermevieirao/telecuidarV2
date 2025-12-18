using Application.DTOs.Schedules;
using Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SchedulesController : ControllerBase
{
    private readonly IScheduleService _scheduleService;

    public SchedulesController(IScheduleService scheduleService)
    {
        _scheduleService = scheduleService;
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
        return CreatedAtAction(nameof(GetSchedule), new { id = schedule.Id }, schedule);
    }

    [HttpPatch("{id}")]
    [HttpPut("{id}")]
    [Authorize(Roles = "ADMIN,PROFESSIONAL")]
    public async Task<ActionResult<ScheduleDto>> UpdateSchedule(Guid id, [FromBody] UpdateScheduleDto dto)
    {
        var schedule = await _scheduleService.UpdateScheduleAsync(id, dto);
        if (schedule == null)
            return NotFound();

        return Ok(schedule);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN,PROFESSIONAL")]
    public async Task<ActionResult> DeleteSchedule(Guid id)
    {
        var result = await _scheduleService.DeleteScheduleAsync(id);
        if (!result)
            return NotFound();

        return Ok(new { message = "Schedule deleted successfully" });
    }
}
