using Domain.Entities;

namespace Application.DTOs.ScheduleBlocks;

public class UpdateScheduleBlockDto
{
    public ScheduleBlockType? Type { get; set; }
    public DateTime? Date { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Reason { get; set; }
}
