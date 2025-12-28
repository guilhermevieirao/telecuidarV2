namespace Application.DTOs.Invites;

public class InviteDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public Guid? SpecialtyId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public Guid CreatedBy { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    
    // Campos para pré-preenchimento
    public string? PrefilledName { get; set; }
    public string? PrefilledLastName { get; set; }
    public string? PrefilledCpf { get; set; }
    public string? PrefilledPhone { get; set; }
}

public class CreateInviteDto
{
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public Guid? SpecialtyId { get; set; }
    
    // Campos para pré-preenchimento
    public string? Name { get; set; }
    public string? LastName { get; set; }
    public string? Cpf { get; set; }
    public string? Phone { get; set; }
}

public class RegisterViaInviteDto
{
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Cpf { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class PaginatedInvitesDto
{
    public List<InviteDto> Data { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}
