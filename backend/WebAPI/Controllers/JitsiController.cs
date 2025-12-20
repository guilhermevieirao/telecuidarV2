using Application.DTOs.Jitsi;
using Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace WebAPI.Controllers;

/// <summary>
/// Controller para gerenciamento de videochamadas Jitsi
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class JitsiController : ControllerBase
{
    private readonly IJitsiService _jitsiService;
    private readonly IAuditLogService _auditLogService;

    public JitsiController(IJitsiService jitsiService, IAuditLogService auditLogService)
    {
        _jitsiService = jitsiService;
        _auditLogService = auditLogService;
    }

    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return userIdClaim != null && Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    /// <summary>
    /// Obtém as configurações do Jitsi
    /// </summary>
    [HttpGet("config")]
    public ActionResult<JitsiConfigDto> GetConfig()
    {
        var config = _jitsiService.GetConfig();
        return Ok(config);
    }

    /// <summary>
    /// Gera um token JWT para acesso à sala de videochamada
    /// </summary>
    /// <param name="appointmentId">ID da consulta</param>
    /// <returns>Token JWT e configurações da sala</returns>
    [HttpGet("token/{appointmentId}")]
    [Authorize]
    public async Task<ActionResult<JitsiTokenResponseDto>> GetToken(Guid appointmentId)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { message = "Usuário não autenticado" });

        // Gerar token
        var tokenResponse = await _jitsiService.GenerateTokenAsync(userId.Value, appointmentId);
        
        if (tokenResponse == null)
            return NotFound(new { message = "Consulta não encontrada ou você não tem permissão para acessar esta sala" });

        // Registrar acesso no audit log
        await _auditLogService.CreateAuditLogAsync(
            userId,
            "jitsi_access",
            "Appointment",
            appointmentId.ToString(),
            null,
            System.Text.Json.JsonSerializer.Serialize(new 
            { 
                RoomName = tokenResponse.RoomName,
                IsModerator = tokenResponse.IsModerator,
                Domain = tokenResponse.Domain
            }),
            GetIpAddress(),
            GetUserAgent()
        );

        return Ok(tokenResponse);
    }

    /// <summary>
    /// Valida se o usuário tem acesso a uma sala específica
    /// </summary>
    /// <param name="appointmentId">ID da consulta</param>
    [HttpGet("validate/{appointmentId}")]
    [Authorize]
    public async Task<ActionResult<bool>> ValidateAccess(Guid appointmentId)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { message = "Usuário não autenticado" });

        var hasAccess = await _jitsiService.ValidateAccessAsync(userId.Value, appointmentId);
        return Ok(new { hasAccess });
    }

    private string? GetIpAddress()
    {
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }

    private string? GetUserAgent()
    {
        return Request.Headers["User-Agent"].FirstOrDefault();
    }
}
