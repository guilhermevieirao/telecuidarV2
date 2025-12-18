using Domain.Common;

namespace Domain.Entities;

public class Schedule : BaseEntity
{
    public Guid ProfessionalId { get; set; }
    
    // Global Configuration (stored as JSON)
    public string GlobalConfigJson { get; set; } = string.Empty;
    
    // Days Configuration (stored as JSON)
    public string DaysConfigJson { get; set; } = string.Empty;
    
    // Validity Period
    public DateTime ValidityStartDate { get; set; }
    public DateTime? ValidityEndDate { get; set; }
    
    // Status
    public bool IsActive { get; set; } = true;
    
    // Navigation Properties
    public User Professional { get; set; } = null!;
}
