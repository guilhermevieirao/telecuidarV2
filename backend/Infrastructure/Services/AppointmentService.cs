using Application.DTOs.Appointments;
using Application.DTOs.Notifications;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class AppointmentService : IAppointmentService
{
    private readonly ApplicationDbContext _context;
    private readonly IScheduleBlockService _scheduleBlockService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<AppointmentService> _logger;

    public AppointmentService(
        ApplicationDbContext context, 
        IScheduleBlockService scheduleBlockService,
        INotificationService notificationService,
        ILogger<AppointmentService> logger)
    {
        _context = context;
        _scheduleBlockService = scheduleBlockService;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<PaginatedAppointmentsDto> GetAppointmentsAsync(int page, int pageSize, string? search, string? status, DateTime? startDate, DateTime? endDate)
    {
        var query = _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Professional)
            .Include(a => a.Specialty)
            .AsQueryable();

        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(a =>
                a.Patient.Name.Contains(search) ||
                a.Professional.Name.Contains(search) ||
                a.Specialty.Name.Contains(search));
        }

        if (!string.IsNullOrEmpty(status) && status.ToLower() != "all")
        {
            if (Enum.TryParse<AppointmentStatus>(status, true, out var appointmentStatus))
            {
                query = query.Where(a => a.Status == appointmentStatus);
            }
        }

        if (startDate.HasValue)
        {
            query = query.Where(a => a.Date >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(a => a.Date <= endDate.Value);
        }

        var total = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(total / (double)pageSize);

        var appointments = await query
            .OrderByDescending(a => a.Date)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AppointmentDto
            {
                Id = a.Id,
                PatientId = a.PatientId,
                PatientName = a.Patient.Name + " " + a.Patient.LastName,
                ProfessionalId = a.ProfessionalId,
                ProfessionalName = a.Professional.Name + " " + a.Professional.LastName,
                SpecialtyId = a.SpecialtyId,
                SpecialtyName = a.Specialty.Name,
                Date = a.Date,
                Time = a.Time.ToString(@"hh\:mm"),
                EndTime = a.EndTime != null ? a.EndTime.Value.ToString(@"hh\:mm") : null,
                Type = a.Type.ToString(),
                Status = a.Status.ToString(),
                Observation = a.Observation,
                MeetLink = a.MeetLink,
                PreConsultationJson = a.PreConsultationJson,
                AISummary = a.AISummary,
                AISummaryGeneratedAt = a.AISummaryGeneratedAt,
                AIDiagnosticHypothesis = a.AIDiagnosticHypothesis,
                AIDiagnosisGeneratedAt = a.AIDiagnosisGeneratedAt,
                CreatedAt = a.CreatedAt,
                UpdatedAt = a.UpdatedAt
            })
            .ToListAsync();

        return new PaginatedAppointmentsDto
        {
            Data = appointments,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };
    }

    public async Task<AppointmentDto?> GetAppointmentByIdAsync(Guid id)
    {
        var appointment = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Professional)
            .Include(a => a.Specialty)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (appointment == null) return null;

        return new AppointmentDto
        {
            Id = appointment.Id,
            PatientId = appointment.PatientId,
            PatientName = appointment.Patient.Name + " " + appointment.Patient.LastName,
            ProfessionalId = appointment.ProfessionalId,
            ProfessionalName = appointment.Professional.Name + " " + appointment.Professional.LastName,
            SpecialtyId = appointment.SpecialtyId,
            SpecialtyName = appointment.Specialty.Name,
            Specialty = new SpecialtyBasicDto
            {
                Id = appointment.Specialty.Id,
                Name = appointment.Specialty.Name,
                Description = appointment.Specialty.Description,
                Status = appointment.Specialty.Status.ToString(),
                CustomFieldsJson = appointment.Specialty.CustomFieldsJson
            },
            Date = appointment.Date,
            Time = appointment.Time.ToString(@"hh\:mm"),
            EndTime = appointment.EndTime != null ? appointment.EndTime.Value.ToString(@"hh\:mm") : null,
            Type = appointment.Type.ToString(),
            Status = appointment.Status.ToString(),
            Observation = appointment.Observation,
            MeetLink = appointment.MeetLink,
            PreConsultationJson = appointment.PreConsultationJson,
            AISummary = appointment.AISummary,
            AISummaryGeneratedAt = appointment.AISummaryGeneratedAt,
            AIDiagnosticHypothesis = appointment.AIDiagnosticHypothesis,
            AIDiagnosisGeneratedAt = appointment.AIDiagnosisGeneratedAt,
            CreatedAt = appointment.CreatedAt,
            UpdatedAt = appointment.UpdatedAt
        };
    }

    public async Task<AppointmentDto> CreateAppointmentAsync(CreateAppointmentDto dto)
    {
        if (!Enum.TryParse<AppointmentType>(dto.Type, true, out var type))
        {
            throw new InvalidOperationException("Invalid appointment type");
        }

        // Verificar se há bloqueio de agenda aprovado para esta data e profissional
        var hasApprovedBlock = await _context.ScheduleBlocks
            .AnyAsync(sb => sb.ProfessionalId == dto.ProfessionalId &&
                           sb.Status == ScheduleBlockStatus.Approved &&
                           ((sb.Type == ScheduleBlockType.Single && sb.Date == dto.Date) ||
                            (sb.Type == ScheduleBlockType.Range && 
                             sb.StartDate <= dto.Date && 
                             sb.EndDate >= dto.Date)));

        if (hasApprovedBlock)
        {
            throw new InvalidOperationException("Não é possível agendar consulta. O profissional possui bloqueio de agenda aprovado para esta data.");
        }

        var appointment = new Appointment
        {
            PatientId = dto.PatientId,
            ProfessionalId = dto.ProfessionalId,
            SpecialtyId = dto.SpecialtyId,
            Date = dto.Date,
            Time = TimeSpan.Parse(dto.Time),
            EndTime = string.IsNullOrEmpty(dto.EndTime) ? null : TimeSpan.Parse(dto.EndTime),
            Type = type,
            Status = AppointmentStatus.Scheduled,
            Observation = dto.Observation,
            MeetLink = dto.MeetLink
        };

        _context.Appointments.Add(appointment);
        await _context.SaveChangesAsync();

        // Load navigation properties
        await _context.Entry(appointment).Reference(a => a.Patient).LoadAsync();
        await _context.Entry(appointment).Reference(a => a.Professional).LoadAsync();
        await _context.Entry(appointment).Reference(a => a.Specialty).LoadAsync();

        // Notificar profissional sobre novo agendamento
        try
        {
            var dateInfo = appointment.Date.ToString("dd/MM/yyyy HH:mm");
            var patientName = $"{appointment.Patient.Name} {appointment.Patient.LastName}".Trim();
            
            await _notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId = appointment.ProfessionalId,
                Title = "📅 Nova Consulta Agendada",
                Message = $"Uma consulta foi agendada com {patientName} para {dateInfo}",
                Type = "Info"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar notificação de novo agendamento para profissional");
        }

        return new AppointmentDto
        {
            Id = appointment.Id,
            PatientId = appointment.PatientId,
            PatientName = appointment.Patient.Name + " " + appointment.Patient.LastName,
            ProfessionalId = appointment.ProfessionalId,
            ProfessionalName = appointment.Professional.Name + " " + appointment.Professional.LastName,
            SpecialtyId = appointment.SpecialtyId,
            SpecialtyName = appointment.Specialty.Name,
            Date = appointment.Date,
            Time = appointment.Time.ToString(@"hh\:mm"),
            EndTime = appointment.EndTime?.ToString(@"hh\:mm"),
            Type = appointment.Type.ToString(),
            Status = appointment.Status.ToString(),
            Observation = appointment.Observation,
            MeetLink = appointment.MeetLink,
            CreatedAt = appointment.CreatedAt,
            UpdatedAt = appointment.UpdatedAt
        };
    }

    public async Task<AppointmentDto?> UpdateAppointmentAsync(Guid id, UpdateAppointmentDto dto)
    {
        var appointment = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Professional)
            .Include(a => a.Specialty)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (appointment == null) return null;

        var previousStatus = appointment.Status;

        if (!string.IsNullOrEmpty(dto.Status) && Enum.TryParse<AppointmentStatus>(dto.Status, true, out var status))
            appointment.Status = status;

        if (dto.Observation != null)
            appointment.Observation = dto.Observation;

        if (dto.PreConsultationJson != null)
            appointment.PreConsultationJson = dto.PreConsultationJson;

        appointment.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Notificar paciente se agendamento foi confirmado
        try
        {
            if (previousStatus != AppointmentStatus.Confirmed && appointment.Status == AppointmentStatus.Confirmed)
            {
                var dateInfo = appointment.Date.ToString("dd/MM/yyyy HH:mm");
                var professionalName = $"{appointment.Professional.Name} {appointment.Professional.LastName}".Trim();
                
                await _notificationService.CreateNotificationAsync(new CreateNotificationDto
                {
                    UserId = appointment.PatientId,
                    Title = "✅ Consulta Confirmada",
                    Message = $"Sua consulta com Dr(a) {professionalName} foi confirmada para {dateInfo}",
                    Type = "Success"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar notificação de confirmação de agendamento");
        }

        return new AppointmentDto
        {
            Id = appointment.Id,
            PatientId = appointment.PatientId,
            PatientName = appointment.Patient.Name + " " + appointment.Patient.LastName,
            ProfessionalId = appointment.ProfessionalId,
            ProfessionalName = appointment.Professional.Name + " " + appointment.Professional.LastName,
            SpecialtyId = appointment.SpecialtyId,
            SpecialtyName = appointment.Specialty.Name,
            Date = appointment.Date,
            Time = appointment.Time.ToString(@"hh\:mm"),
            EndTime = appointment.EndTime?.ToString(@"hh\:mm"),
            Type = appointment.Type.ToString(),
            Status = appointment.Status.ToString(),
            Observation = appointment.Observation,
            MeetLink = appointment.MeetLink,
            PreConsultationJson = appointment.PreConsultationJson,
            CreatedAt = appointment.CreatedAt,
            UpdatedAt = appointment.UpdatedAt
        };
    }

    public async Task<bool> CancelAppointmentAsync(Guid id)
    {
        var appointment = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Professional)
            .FirstOrDefaultAsync(a => a.Id == id);
        
        if (appointment == null) return false;

        appointment.Status = AppointmentStatus.Cancelled;
        appointment.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Notificar profissional sobre cancelamento
        try
        {
            var dateInfo = appointment.Date.ToString("dd/MM/yyyy HH:mm");
            var patientName = $"{appointment.Patient.Name} {appointment.Patient.LastName}".Trim();
            
            await _notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId = appointment.ProfessionalId,
                Title = "❌ Consulta Cancelada",
                Message = $"A consulta com {patientName} agendada para {dateInfo} foi cancelada.",
                Type = "Warning"
            });

            // Notificar paciente sobre cancelamento
            await _notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId = appointment.PatientId,
                Title = "❌ Sua Consulta foi Cancelada",
                Message = $"Sua consulta com Dr(a) {appointment.Professional.Name} {appointment.Professional.LastName} foi cancelada.",
                Type = "Warning"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar notificações de cancelamento de agendamento");
        }

        return true;
    }

    public async Task<bool> FinishAppointmentAsync(Guid id)
    {
        var appointment = await _context.Appointments.FindAsync(id);
        if (appointment == null) return false;

        appointment.Status = AppointmentStatus.Completed;
        appointment.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return true;
    }
}
