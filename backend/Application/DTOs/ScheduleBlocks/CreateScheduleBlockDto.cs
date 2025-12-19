using System.ComponentModel.DataAnnotations;
using Domain.Entities;

namespace Application.DTOs.ScheduleBlocks;

public class CreateScheduleBlockDto
{
    [Required]
    public Guid ProfessionalId { get; set; }
    
    [Required]
    public ScheduleBlockType Type { get; set; }
    
    // For single day blocks
    public DateTime? Date { get; set; }
    
    // For date range blocks
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    
    [Required]
    [StringLength(500, MinimumLength = 3)]
    public string Reason { get; set; } = string.Empty;
}
