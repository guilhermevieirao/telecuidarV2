using Domain.Entities;

namespace Application.DTOs.ScheduleBlocks;

public class ScheduleBlockDto
{
    public Guid Id { get; set; }
    public Guid ProfessionalId { get; set; }
    public string? ProfessionalName { get; set; }
    public ScheduleBlockType Type { get; set; }
    public DateTime? Date { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string Reason { get; set; } = string.Empty;
    public ScheduleBlockStatus Status { get; set; }
    public Guid? ApprovedBy { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
