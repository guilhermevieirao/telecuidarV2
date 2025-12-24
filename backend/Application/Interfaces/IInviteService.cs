using Application.DTOs.Invites;
using Application.DTOs.Users;

namespace Application.Interfaces;

public interface IInviteService
{
    Task<PaginatedInvitesDto> GetInvitesAsync(int page, int pageSize, string? sortBy, string? sortDirection, string? role, string? status);
    Task<InviteDto?> GetInviteByIdAsync(Guid id);
    Task<InviteDto> CreateInviteAsync(CreateInviteDto dto);
    Task<InviteDto> RegenerateInviteAsync(Guid id);
    Task<InviteDto?> ValidateTokenAsync(string token);
    Task<UserDto> RegisterViaInviteAsync(RegisterViaInviteDto dto);
    Task<bool> CancelInviteAsync(Guid id);
    Task<bool> DeleteInviteAsync(Guid id);
}
