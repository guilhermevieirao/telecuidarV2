using System.ComponentModel.DataAnnotations;

namespace Application.DTOs.ScheduleBlocks;

public class ApproveScheduleBlockDto
{
    [Required]
    public Guid ApprovedBy { get; set; }
}
