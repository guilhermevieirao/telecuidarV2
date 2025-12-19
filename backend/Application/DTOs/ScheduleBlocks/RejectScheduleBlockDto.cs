using System.ComponentModel.DataAnnotations;

namespace Application.DTOs.ScheduleBlocks;

public class RejectScheduleBlockDto
{
    [Required]
    public Guid RejectedBy { get; set; }
    
    [Required]
    [StringLength(500, MinimumLength = 3)]
    public string RejectionReason { get; set; } = string.Empty;
}
