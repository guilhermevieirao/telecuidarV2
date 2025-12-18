namespace Application.DTOs.Schedules;

// Time Range for a period
public class TimeRangeDto
{
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
}

// Break Time configuration
public class BreakTimeDto
{
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
}

// Global configuration for the schedule
public class GlobalConfigDto
{
    public TimeRangeDto TimeRange { get; set; } = new();
    public BreakTimeDto? BreakTime { get; set; }
    public int ConsultationDuration { get; set; }
    public int IntervalBetweenConsultations { get; set; }
}

// Day-specific configuration
public class DayConfigDto
{
    public string Day { get; set; } = string.Empty; // Monday, Tuesday, etc
    public bool IsWorking { get; set; }
    public TimeRangeDto? TimeRange { get; set; }
    public BreakTimeDto? BreakTime { get; set; }
    public int? ConsultationDuration { get; set; }
    public int? IntervalBetweenConsultations { get; set; }
    public bool Customized { get; set; }
}

public class ScheduleDto
{
    public Guid Id { get; set; }
    public Guid ProfessionalId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public string ProfessionalEmail { get; set; } = string.Empty;
    public GlobalConfigDto GlobalConfig { get; set; } = new();
    public List<DayConfigDto> DaysConfig { get; set; } = new();
    public string ValidityStartDate { get; set; } = string.Empty;
    public string? ValidityEndDate { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateScheduleDto
{
    public Guid ProfessionalId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public string ProfessionalEmail { get; set; } = string.Empty;
    public GlobalConfigDto GlobalConfig { get; set; } = new();
    public List<DayConfigDto> DaysConfig { get; set; } = new();
    public string ValidityStartDate { get; set; } = string.Empty;
    public string? ValidityEndDate { get; set; }
    public string Status { get; set; } = "Active";
}

public class UpdateScheduleDto
{
    public GlobalConfigDto? GlobalConfig { get; set; }
    public List<DayConfigDto>? DaysConfig { get; set; }
    public string? ValidityStartDate { get; set; }
    public string? ValidityEndDate { get; set; }
    public string? Status { get; set; }
}

public class AvailableSlotDto
{
    public DateTime Date { get; set; }
    public string Time { get; set; } = string.Empty;
    public bool IsAvailable { get; set; }
}

public class ProfessionalAvailabilityDto
{
    public Guid ProfessionalId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public List<AvailableSlotDto> Slots { get; set; } = new();
}

public class PaginatedSchedulesDto
{
    public List<ScheduleDto> Data { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}
