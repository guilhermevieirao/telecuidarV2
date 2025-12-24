using Application.DTOs.Schedules;
using Application.Interfaces;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Infrastructure.Services;

public class ScheduleService : IScheduleService
{
    private readonly ApplicationDbContext _context;

    public ScheduleService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PaginatedSchedulesDto> GetSchedulesAsync(int page, int pageSize, string? search, string? status)
    {
        var query = _context.Schedules
            .Include(s => s.Professional)
            .AsQueryable();

        // Filter by status
        if (!string.IsNullOrEmpty(status) && status.ToLower() != "all")
        {
            var isActive = status.ToLower() == "active";
            query = query.Where(s => s.IsActive == isActive);
        }

        // Filter by search (professional name)
        if (!string.IsNullOrEmpty(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(s => 
                (s.Professional.Name + " " + s.Professional.LastName).ToLower().Contains(searchLower));
        }

        var total = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(total / (double)pageSize);

        var schedules = await query
            .OrderBy(s => s.Professional.Name)
            .ThenBy(s => s.ValidityStartDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var scheduleDtos = schedules.Select(s => MapToScheduleDto(s)).ToList();

        return new PaginatedSchedulesDto
        {
            Data = scheduleDtos,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };
    }

    public async Task<List<ScheduleDto>> GetSchedulesByProfessionalAsync(Guid professionalId)
    {
        var schedules = await _context.Schedules
            .Include(s => s.Professional)
            .Where(s => s.ProfessionalId == professionalId)
            .OrderBy(s => s.ValidityStartDate)
            .ToListAsync();

        return schedules.Select(s => MapToScheduleDto(s)).ToList();
    }

    public async Task<ScheduleDto?> GetScheduleByIdAsync(Guid id)
    {
        var schedule = await _context.Schedules
            .Include(s => s.Professional)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (schedule == null) return null;

        return MapToScheduleDto(schedule);
    }

    public async Task<ScheduleDto> CreateScheduleAsync(CreateScheduleDto dto)
    {
        var schedule = new Schedule
        {
            ProfessionalId = dto.ProfessionalId,
            GlobalConfigJson = JsonSerializer.Serialize(dto.GlobalConfig),
            DaysConfigJson = JsonSerializer.Serialize(dto.DaysConfig),
            ValidityStartDate = DateTime.Parse(dto.ValidityStartDate),
            ValidityEndDate = string.IsNullOrEmpty(dto.ValidityEndDate) ? null : DateTime.Parse(dto.ValidityEndDate),
            IsActive = dto.Status.ToLower() == "active"
        };

        _context.Schedules.Add(schedule);
        await _context.SaveChangesAsync();

        await _context.Entry(schedule).Reference(s => s.Professional).LoadAsync();

        return MapToScheduleDto(schedule);
    }

    public async Task<ScheduleDto?> UpdateScheduleAsync(Guid id, UpdateScheduleDto dto)
    {
        var schedule = await _context.Schedules
            .Include(s => s.Professional)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (schedule == null) return null;

        if (dto.GlobalConfig != null)
            schedule.GlobalConfigJson = JsonSerializer.Serialize(dto.GlobalConfig);

        if (dto.DaysConfig != null)
            schedule.DaysConfigJson = JsonSerializer.Serialize(dto.DaysConfig);

        if (!string.IsNullOrEmpty(dto.ValidityStartDate))
            schedule.ValidityStartDate = DateTime.Parse(dto.ValidityStartDate);

        if (dto.ValidityEndDate != null)
            schedule.ValidityEndDate = string.IsNullOrEmpty(dto.ValidityEndDate) ? null : DateTime.Parse(dto.ValidityEndDate);

        if (!string.IsNullOrEmpty(dto.Status))
            schedule.IsActive = dto.Status.ToLower() == "active";

        schedule.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return MapToScheduleDto(schedule);
    }

    public async Task<bool> DeleteScheduleAsync(Guid id)
    {
        var schedule = await _context.Schedules.FindAsync(id);
        if (schedule == null) return false;

        _context.Schedules.Remove(schedule);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<ProfessionalAvailabilityDto> GetAvailabilitySlotsAsync(Guid professionalId, DateTime startDate, DateTime endDate)
    {
        var professional = await _context.Users.FindAsync(professionalId);
        if (professional == null)
            throw new InvalidOperationException("Professional not found");

        var schedules = await _context.Schedules
            .Where(s => s.ProfessionalId == professionalId && 
                       s.IsActive &&
                       s.ValidityStartDate <= endDate &&
                       (s.ValidityEndDate == null || s.ValidityEndDate >= startDate))
            .ToListAsync();

        var appointments = await _context.Appointments
            .Where(a => a.ProfessionalId == professionalId && 
                       a.Date >= startDate && 
                       a.Date <= endDate &&
                       a.Status != Domain.Enums.AppointmentStatus.Cancelled)
            .ToListAsync();

        // Carregar bloqueios aprovados
        var scheduleBlocks = await _context.ScheduleBlocks
            .Where(sb => sb.ProfessionalId == professionalId &&
                        sb.Status == ScheduleBlockStatus.Approved &&
                        ((sb.Type == ScheduleBlockType.Single && sb.Date >= startDate && sb.Date <= endDate) ||
                         (sb.Type == ScheduleBlockType.Range && sb.StartDate <= endDate && sb.EndDate >= startDate)))
            .ToListAsync();

        var slots = new List<AvailableSlotDto>();

        foreach (var schedule in schedules)
        {
            var daysConfig = JsonSerializer.Deserialize<List<DayConfigDto>>(schedule.DaysConfigJson) ?? new List<DayConfigDto>();
            var globalConfig = JsonSerializer.Deserialize<GlobalConfigDto>(schedule.GlobalConfigJson) ?? new GlobalConfigDto();

            for (var date = startDate; date <= endDate; date = date.AddDays(1))
            {
                // Check if date is within schedule validity
                if (date < schedule.ValidityStartDate || (schedule.ValidityEndDate.HasValue && date > schedule.ValidityEndDate.Value))
                    continue;

                // Verificar se a data está bloqueada
                var isBlocked = scheduleBlocks.Any(sb =>
                    (sb.Type == ScheduleBlockType.Single && sb.Date.HasValue && sb.Date.Value.Date == date.Date) ||
                    (sb.Type == ScheduleBlockType.Range && sb.StartDate.HasValue && sb.EndDate.HasValue && 
                     sb.StartDate.Value.Date <= date.Date && sb.EndDate.Value.Date >= date.Date));

                if (isBlocked)
                    continue;

                var dayName = date.DayOfWeek.ToString();
                var dayConfig = daysConfig.FirstOrDefault(d => d.Day == dayName);

                if (dayConfig == null || !dayConfig.IsWorking)
                    continue;

                // Use day-specific config if customized, otherwise use global config
                var timeRange = dayConfig.Customized && dayConfig.TimeRange != null 
                    ? dayConfig.TimeRange 
                    : globalConfig.TimeRange;
                var consultationDuration = dayConfig.Customized && dayConfig.ConsultationDuration.HasValue 
                    ? dayConfig.ConsultationDuration.Value 
                    : globalConfig.ConsultationDuration;
                var intervalBetween = dayConfig.Customized && dayConfig.IntervalBetweenConsultations.HasValue 
                    ? dayConfig.IntervalBetweenConsultations.Value 
                    : globalConfig.IntervalBetweenConsultations;

                var startTime = TimeSpan.Parse(timeRange.StartTime);
                var endTime = TimeSpan.Parse(timeRange.EndTime);
                var currentTime = startTime;

                while (currentTime < endTime)
                {
                    var slotDateTime = date.Date + currentTime;
                    var isAvailable = !appointments.Any(a => 
                        a.Date.Date == date.Date && 
                        a.Time == currentTime);

                    slots.Add(new AvailableSlotDto
                    {
                        Date = date,
                        Time = currentTime.ToString(@"hh\:mm"),
                        IsAvailable = isAvailable && slotDateTime > DateTime.Now
                    });

                    currentTime = currentTime.Add(TimeSpan.FromMinutes(consultationDuration + intervalBetween));
                }
            }
        }

        return new ProfessionalAvailabilityDto
        {
            ProfessionalId = professionalId,
            ProfessionalName = professional.Name + " " + professional.LastName,
            Slots = slots.OrderBy(s => s.Date).ThenBy(s => s.Time).ToList()
        };
    }

    private static ScheduleDto MapToScheduleDto(Schedule schedule)
    {
        var globalConfig = JsonSerializer.Deserialize<GlobalConfigDto>(schedule.GlobalConfigJson) ?? new GlobalConfigDto();
        var daysConfig = JsonSerializer.Deserialize<List<DayConfigDto>>(schedule.DaysConfigJson) ?? new List<DayConfigDto>();

        return new ScheduleDto
        {
            Id = schedule.Id,
            ProfessionalId = schedule.ProfessionalId,
            ProfessionalName = schedule.Professional != null ? $"{schedule.Professional.Name} {schedule.Professional.LastName}" : string.Empty,
            ProfessionalEmail = schedule.Professional?.Email ?? string.Empty,
            GlobalConfig = globalConfig,
            DaysConfig = daysConfig,
            ValidityStartDate = schedule.ValidityStartDate.ToString("yyyy-MM-dd"),
            ValidityEndDate = schedule.ValidityEndDate?.ToString("yyyy-MM-dd"),
            Status = schedule.IsActive ? "Active" : "Inactive",
            CreatedAt = schedule.CreatedAt,
            UpdatedAt = schedule.UpdatedAt
        };
    }

    private static DayOfWeek ParseDayOfWeek(string day)
    {
        return day switch
        {
            "Monday" => DayOfWeek.Monday,
            "Tuesday" => DayOfWeek.Tuesday,
            "Wednesday" => DayOfWeek.Wednesday,
            "Thursday" => DayOfWeek.Thursday,
            "Friday" => DayOfWeek.Friday,
            "Saturday" => DayOfWeek.Saturday,
            "Sunday" => DayOfWeek.Sunday,
            _ => throw new ArgumentException($"Invalid day of week: {day}")
        };
    }
}
