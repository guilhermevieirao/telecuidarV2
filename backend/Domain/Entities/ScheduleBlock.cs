using Domain.Common;

namespace Domain.Entities;

public enum ScheduleBlockStatus
{
    Pending,
    Approved,
    Rejected,
    Expired
}

public enum ScheduleBlockType
{
    Single,
    Range
}

public class ScheduleBlock : BaseEntity
{
    public Guid ProfessionalId { get; set; }
    
    public ScheduleBlockType Type { get; set; }
    
    // For single day blocks
    public DateTime? Date { get; set; }
    
    // For date range blocks
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    
    public string Reason { get; set; } = string.Empty;
    
    public ScheduleBlockStatus Status { get; set; } = ScheduleBlockStatus.Pending;
    
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    
    public string? RejectionReason { get; set; }
    
    // Navigation Properties
    public User Professional { get; set; } = null!;
    public User? Approver { get; set; }
}
