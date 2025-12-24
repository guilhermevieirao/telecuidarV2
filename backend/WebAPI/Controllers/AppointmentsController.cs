using Application.DTOs.Appointments;
using Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WebAPI.Extensions;
using WebAPI.Services;
using WebAPI.Hubs;

namespace WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AppointmentsController : ControllerBase
{
    private readonly IAppointmentService _appointmentService;
    private readonly IAuditLogService _auditLogService;
    private readonly ISchedulingNotificationService _schedulingNotificationService;
    private readonly IRealTimeNotificationService _realTimeNotification;

    public AppointmentsController(
        IAppointmentService appointmentService, 
        IAuditLogService auditLogService,
        ISchedulingNotificationService schedulingNotificationService,
        IRealTimeNotificationService realTimeNotification)
    {
        _appointmentService = appointmentService;
        _auditLogService = auditLogService;
        _schedulingNotificationService = schedulingNotificationService;
        _realTimeNotification = realTimeNotification;
    }
    
    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return userIdClaim != null ? Guid.Parse(userIdClaim) : null;
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedAppointmentsDto>> GetAppointments(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] Guid? patientId = null,
        [FromQuery] Guid? professionalId = null)
    {
        var currentUserId = GetCurrentUserId();
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        // Se o usuário é PATIENT, forçar filtro por patientId
        if (userRole == "PATIENT" && currentUserId.HasValue)
        {
            patientId = currentUserId.Value;
        }
        // Se o usuário é PROFESSIONAL, forçar filtro por professionalId
        else if (userRole == "PROFESSIONAL" && currentUserId.HasValue)
        {
            professionalId = currentUserId.Value;
        }
        // ADMIN pode ver todas as consultas (não aplica filtro)

        var result = await _appointmentService.GetAppointmentsAsync(page, pageSize, search, status, startDate, endDate, patientId, professionalId);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AppointmentDto>> GetAppointment(Guid id)
    {
        var appointment = await _appointmentService.GetAppointmentByIdAsync(id);
        if (appointment == null)
            return NotFound();

        return Ok(appointment);
    }

    [HttpPost]
    public async Task<ActionResult<AppointmentDto>> CreateAppointment([FromBody] CreateAppointmentDto dto)
    {
        try
        {
            var appointment = await _appointmentService.CreateAppointmentAsync(dto);
            
            // Obter connectionId do SignalR do usuário atual (se conectado)
            var currentUserId = GetCurrentUserId()?.ToString();
            
            // Notificar em tempo real sobre o slot ocupado (excluindo o usuário que criou)
            await _schedulingNotificationService.NotifyAppointmentCreatedAsync(
                appointment.ProfessionalId.ToString(),
                appointment.SpecialtyId.ToString(),
                appointment.Date,
                appointment.Time,
                appointment.Id.ToString(),
                currentUserId
            );
            
            // Real-time notification for dashboard and lists
            await _realTimeNotification.NotifyEntityCreatedAsync("Appointment", appointment.Id.ToString(), appointment, currentUserId);
            await _realTimeNotification.NotifyDashboardUpdateAsync(new DashboardUpdateNotification
            {
                StatType = "TotalAppointments",
                Value = null
            });
            
            // Audit log
            await _auditLogService.CreateAuditLogAsync(
                GetCurrentUserId(),
                "create",
                "Appointment",
                appointment.Id.ToString(),
                null,
                HttpContextExtensions.SerializeToJson(new { appointment.PatientId, appointment.ProfessionalId, appointment.Date, appointment.Time, appointment.Status }),
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );
            
            return CreatedAtAction(nameof(GetAppointment), new { id = appointment.Id }, appointment);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult<AppointmentDto>> UpdateAppointment(Guid id, [FromBody] UpdateAppointmentDto dto)
    {
        var oldAppointment = await _appointmentService.GetAppointmentByIdAsync(id);
        if (oldAppointment == null)
            return NotFound();
        
        var appointment = await _appointmentService.UpdateAppointmentAsync(id, dto);
        
        // Audit log with differences
        var oldValues = oldAppointment != null ? HttpContextExtensions.SerializeToJson(new { oldAppointment.Date, oldAppointment.Time, oldAppointment.Status, oldAppointment.Observation }) : null;
        var newValues = HttpContextExtensions.SerializeToJson(new { appointment?.Date, appointment?.Time, appointment?.Status, appointment?.Observation });
        
        await _auditLogService.CreateAuditLogAsync(
            GetCurrentUserId(),
            "update",
            "Appointment",
            id.ToString(),
            oldValues,
            newValues,
            HttpContext.GetIpAddress(),
            HttpContext.GetUserAgent()
        );
        
        // Real-time notification for status changes
        if (appointment != null && oldAppointment != null && oldAppointment.Status != appointment.Status)
        {
            await _realTimeNotification.NotifyAppointmentStatusChangeAsync(new AppointmentStatusUpdate
            {
                AppointmentId = id.ToString(),
                PreviousStatus = oldAppointment.Status,
                NewStatus = appointment.Status,
                PatientId = appointment.PatientId.ToString(),
                ProfessionalId = appointment.ProfessionalId.ToString()
            });
        }
        
        await _realTimeNotification.NotifyEntityUpdatedAsync("Appointment", id.ToString(), appointment!, GetCurrentUserId()?.ToString());

        return Ok(appointment);
    }

    [HttpPost("{id}/cancel")]
    public async Task<ActionResult> CancelAppointment(Guid id)
    {
        var appointment = await _appointmentService.GetAppointmentByIdAsync(id);
        if (appointment == null)
            return NotFound();
        
        var result = await _appointmentService.CancelAppointmentAsync(id);
        
        // Notificar em tempo real sobre o slot liberado
        await _schedulingNotificationService.NotifyAppointmentCancelledAsync(
            appointment.ProfessionalId.ToString(),
            appointment.SpecialtyId.ToString(),
            appointment.Date,
            appointment.Time,
            id.ToString()
        );
        
        // Real-time notification for status change
        await _realTimeNotification.NotifyAppointmentStatusChangeAsync(new AppointmentStatusUpdate
        {
            AppointmentId = id.ToString(),
            PreviousStatus = appointment.Status,
            NewStatus = "Cancelled",
            PatientId = appointment.PatientId.ToString(),
            ProfessionalId = appointment.ProfessionalId.ToString()
        });
        await _realTimeNotification.NotifyDashboardUpdateAsync(new DashboardUpdateNotification
        {
            StatType = "AppointmentCancelled",
            Value = null
        });
        
        // Audit log
        await _auditLogService.CreateAuditLogAsync(
            GetCurrentUserId(),
            "update",
            "Appointment",
            id.ToString(),
            HttpContextExtensions.SerializeToJson(new { Status = appointment.Status }),
            HttpContextExtensions.SerializeToJson(new { Status = "CANCELLED" }),
            HttpContext.GetIpAddress(),
            HttpContext.GetUserAgent()
        );

        return Ok(new { message = "Appointment cancelled successfully" });
    }

    [HttpPost("{id}/finish")]
    public async Task<ActionResult> FinishAppointment(Guid id)
    {
        var appointment = await _appointmentService.GetAppointmentByIdAsync(id);
        if (appointment == null)
            return NotFound();
        
        var result = await _appointmentService.FinishAppointmentAsync(id);
        
        // Real-time notification for status change
        await _realTimeNotification.NotifyAppointmentStatusChangeAsync(new AppointmentStatusUpdate
        {
            AppointmentId = id.ToString(),
            PreviousStatus = appointment.Status,
            NewStatus = "Finished",
            PatientId = appointment.PatientId.ToString(),
            ProfessionalId = appointment.ProfessionalId.ToString()
        });
        await _realTimeNotification.NotifyDashboardUpdateAsync(new DashboardUpdateNotification
        {
            StatType = "AppointmentCompleted",
            Value = null
        });
        
        // Audit log
        await _auditLogService.CreateAuditLogAsync(
            GetCurrentUserId(),
            "update",
            "Appointment",
            id.ToString(),
            HttpContextExtensions.SerializeToJson(new { Status = appointment.Status }),
            HttpContextExtensions.SerializeToJson(new { Status = "FINISHED" }),
            HttpContext.GetIpAddress(),
            HttpContext.GetUserAgent()
        );

        return Ok(new { message = "Appointment finished successfully" });
    }
}
