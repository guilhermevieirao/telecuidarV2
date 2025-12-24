using Application.DTOs.Invites;
using Application.Interfaces;
using WebAPI.Services;
using WebAPI.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InvitesController : ControllerBase
{
    private readonly IInviteService _inviteService;
    private readonly IRealTimeNotificationService _realTimeNotification;

    public InvitesController(IInviteService inviteService, IRealTimeNotificationService realTimeNotification)
    {
        _inviteService = inviteService;
        _realTimeNotification = realTimeNotification;
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<PaginatedInvitesDto>> GetInvites(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDirection = null,
        [FromQuery] string? role = null,
        [FromQuery] string? status = null)
    {
        try
        {
            var result = await _inviteService.GetInvitesAsync(page, pageSize, sortBy, sortDirection, role, status);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<InviteDto>> GetInvite(Guid id)
    {
        try
        {
            var invite = await _inviteService.GetInviteByIdAsync(id);
            if (invite == null)
            {
                return NotFound(new { message = "Invite not found" });
            }
            return Ok(invite);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<InviteDto>> CreateInvite([FromBody] CreateInviteDto dto)
    {
        try
        {
            var invite = await _inviteService.CreateInviteAsync(dto);
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityCreatedAsync("Invite", invite.Id.ToString(), invite);
            
            return CreatedAtAction(nameof(GetInvite), new { id = invite.Id }, invite);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost("generate-link")]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<object>> GenerateInviteLink([FromBody] CreateInviteDto dto)
    {
        try
        {
            var invite = await _inviteService.CreateInviteAsync(dto);
            // Use frontend URL for the registration link
            var link = $"http://localhost:4200/registrar?token={invite.Token}";
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityCreatedAsync("Invite", invite.Id.ToString(), invite);
            
            return Ok(new 
            { 
                link = link,
                token = invite.Token,
                expiresAt = invite.ExpiresAt,
                role = invite.Role
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpGet("validate/{token}")]
    [AllowAnonymous]
    public async Task<ActionResult<object>> ValidateToken(string token)
    {
        try
        {
            var invite = await _inviteService.ValidateTokenAsync(token);
            if (invite == null)
            {
                return NotFound(new { message = "Invalid or expired token" });
            }
            
            return Ok(new 
            { 
                email = invite.Email,
                role = invite.Role,
                specialtyId = invite.SpecialtyId,
                expiresAt = invite.ExpiresAt
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<object>> RegisterViaInvite([FromBody] RegisterViaInviteDto dto)
    {
        try
        {
            var user = await _inviteService.RegisterViaInviteAsync(dto);
            return Ok(new { message = "User registered successfully", user });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPatch("{id}/cancel")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> CancelInvite(Guid id)
    {
        try
        {
            var result = await _inviteService.CancelInviteAsync(id);
            if (!result)
            {
                return NotFound(new { message = "Invite not found" });
            }
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityUpdatedAsync("Invite", id.ToString(), new { Status = "Cancelled" });
            
            return Ok(new { message = "Invite cancelled successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> DeleteInvite(Guid id)
    {
        try
        {
            var result = await _inviteService.DeleteInviteAsync(id);
            if (!result)
            {
                return NotFound(new { message = "Invite not found" });
            }
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityDeletedAsync("Invite", id.ToString());
            
            return Ok(new { message = "Invite deleted successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }
}
