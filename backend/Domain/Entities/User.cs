using Domain.Common;
using Domain.Enums;

namespace Domain.Entities;

public class User : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Cpf { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Avatar { get; set; }
    public UserRole Role { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;
    public bool EmailVerified { get; set; } = false;
    public string? EmailVerificationToken { get; set; }
    public DateTime? EmailVerificationTokenExpiry { get; set; }
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiry { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }
    
    // Foreign Key
    public Guid? SpecialtyId { get; set; }
    
    // Navigation Properties
    public Specialty? Specialty { get; set; }
    public ICollection<Appointment> AppointmentsAsPatient { get; set; } = new List<Appointment>();
    public ICollection<Appointment> AppointmentsAsProfessional { get; set; } = new List<Appointment>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    public ICollection<Schedule> Schedules { get; set; } = new List<Schedule>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    public ICollection<ScheduleBlock> ScheduleBlocks { get; set; } = new List<ScheduleBlock>();
}
