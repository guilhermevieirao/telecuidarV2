using Domain.Enums;

namespace Domain.Entities;

public class Invite
{
    public Guid Id { get; set; }
    public string? Email { get; set; } // Opcional para links genéricos
    public UserRole Role { get; set; }
    public Guid? SpecialtyId { get; set; }
    public string Token { get; set; } = string.Empty;
    public InviteStatus Status { get; set; } = InviteStatus.Pending;
    public DateTime ExpiresAt { get; set; }
    public Guid CreatedBy { get; set; }
    public User? CreatedByUser { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    
    // Campos para pré-preenchimento
    public string? PrefilledName { get; set; }
    public string? PrefilledLastName { get; set; }
    public string? PrefilledCpf { get; set; }
    public string? PrefilledPhone { get; set; }
}

public enum InviteStatus
{
    Pending,
    Accepted,
    Expired,
    Cancelled
}
