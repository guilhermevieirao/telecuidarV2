using Application.DTOs.Invites;
using Application.DTOs.Users;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace Infrastructure.Services;

public class InviteService : IInviteService
{
    private readonly ApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;

    public InviteService(ApplicationDbContext context, IPasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    public async Task<PaginatedInvitesDto> GetInvitesAsync(
        int page, 
        int pageSize, 
        string? sortBy, 
        string? sortDirection, 
        string? role, 
        string? status)
    {
        var query = _context.Invites
            .Include(i => i.CreatedByUser)
            .AsQueryable();

        // Apply filters
        if (!string.IsNullOrEmpty(role) && Enum.TryParse<UserRole>(role, true, out var userRole))
        {
            query = query.Where(i => i.Role == userRole);
        }

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<InviteStatus>(status, true, out var inviteStatus))
        {
            query = query.Where(i => i.Status == inviteStatus);
        }

        var total = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(total / (double)pageSize);

        var invites = await query
            .OrderByDescending(i => i.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new InviteDto
            {
                Id = i.Id,
                Email = i.Email ?? string.Empty,
                Role = i.Role.ToString(),
                Status = i.Status.ToString(),
                Token = i.Token,
                ExpiresAt = i.ExpiresAt,
                CreatedBy = i.CreatedBy,
                CreatedByName = i.CreatedByUser != null ? $"{i.CreatedByUser.Name} {i.CreatedByUser.LastName}" : "System",
                CreatedAt = i.CreatedAt
            })
            .ToListAsync();

        return new PaginatedInvitesDto
        {
            Data = invites,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };
    }

    public async Task<InviteDto?> GetInviteByIdAsync(Guid id)
    {
        var invite = await _context.Invites
            .Include(i => i.CreatedByUser)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (invite == null) return null;

        return new InviteDto
        {
            Id = invite.Id,
            Email = invite.Email ?? string.Empty,
            Role = invite.Role.ToString(),
            Status = invite.Status.ToString(),
            Token = invite.Token,
            ExpiresAt = invite.ExpiresAt,
            CreatedBy = invite.CreatedBy,
            CreatedByName = invite.CreatedByUser != null ? $"{invite.CreatedByUser.Name} {invite.CreatedByUser.LastName}" : "System",
            CreatedAt = invite.CreatedAt
        };
    }

    public async Task<InviteDto> CreateInviteAsync(CreateInviteDto dto)
    {
        if (!Enum.TryParse<UserRole>(dto.Role, true, out var userRole))
        {
            throw new InvalidOperationException("Invalid role");
        }

        // Only validate email if it's provided (for generic links, email can be empty)
        if (!string.IsNullOrWhiteSpace(dto.Email))
        {
            // Check if email already has a pending invite
            var existingInvite = await _context.Invites
                .FirstOrDefaultAsync(i => i.Email == dto.Email && i.Status == InviteStatus.Pending);

            if (existingInvite != null)
            {
                throw new InvalidOperationException("This email already has a pending invite");
            }

            // Check if email is already registered
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (existingUser != null)
            {
                throw new InvalidOperationException("This email is already registered");
            }
        }

        // Generate secure token
        var token = GenerateSecureToken();

        // Get admin user to use as CreatedBy (temporary solution until we implement proper auth context)
        var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Role == UserRole.ADMIN);
        if (adminUser == null)
        {
            throw new InvalidOperationException("No admin user found in the system");
        }

        var invite = new Invite
        {
            Email = dto.Email,
            Role = userRole,
            SpecialtyId = dto.SpecialtyId,
            Token = token,
            Status = InviteStatus.Pending,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedBy = adminUser.Id,
            CreatedAt = DateTime.UtcNow
        };

        _context.Invites.Add(invite);
        await _context.SaveChangesAsync();

        return new InviteDto
        {
            Id = invite.Id,
            Email = invite.Email ?? string.Empty,
            Role = invite.Role.ToString(),
            Status = invite.Status.ToString(),
            Token = invite.Token,
            ExpiresAt = invite.ExpiresAt,
            CreatedBy = invite.CreatedBy,
            CreatedByName = "System",
            CreatedAt = invite.CreatedAt
        };
    }

    public async Task<InviteDto?> ValidateTokenAsync(string token)
    {
        var invite = await _context.Invites
            .FirstOrDefaultAsync(i => i.Token == token && i.Status == InviteStatus.Pending);

        if (invite == null) return null;

        // Check if expired
        if (invite.ExpiresAt < DateTime.UtcNow)
        {
            invite.Status = InviteStatus.Expired;
            await _context.SaveChangesAsync();
            return null;
        }

        return new InviteDto
        {
            Id = invite.Id,
            Email = invite.Email ?? string.Empty,
            Role = invite.Role.ToString(),
            Status = invite.Status.ToString(),
            Token = invite.Token,
            ExpiresAt = invite.ExpiresAt,
            CreatedBy = invite.CreatedBy,
            CreatedByName = "System",
            CreatedAt = invite.CreatedAt
        };
    }

    public async Task<UserDto> RegisterViaInviteAsync(RegisterViaInviteDto dto)
    {
        var invite = await _context.Invites
            .FirstOrDefaultAsync(i => i.Token == dto.Token && i.Status == InviteStatus.Pending);

        if (invite == null)
        {
            throw new InvalidOperationException("Invalid or expired token");
        }

        if (invite.ExpiresAt < DateTime.UtcNow)
        {
            invite.Status = InviteStatus.Expired;
            await _context.SaveChangesAsync();
            throw new InvalidOperationException("This invitation has expired");
        }

        // Validate password
        if (!Application.Validators.CustomValidators.IsValidPassword(dto.Password))
        {
            var missing = Application.Validators.CustomValidators.GetPasswordMissingRequirements(dto.Password);
            throw new InvalidOperationException($"Password must have: {string.Join(", ", missing)}");
        }

        // Validate CPF
        if (!Application.Validators.CustomValidators.IsValidCpf(dto.Cpf))
        {
            throw new InvalidOperationException("Invalid CPF");
        }

        // Check if CPF is already in use
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Cpf == dto.Cpf);
        if (existingUser != null)
        {
            throw new InvalidOperationException("CPF already in use");
        }

        // Use email from dto if provided, otherwise use invite email, otherwise throw error
        var userEmail = !string.IsNullOrWhiteSpace(dto.Email) ? dto.Email : invite.Email;
        if (string.IsNullOrWhiteSpace(userEmail))
        {
            throw new InvalidOperationException("Email is required");
        }

        // Check if email is already in use
        var existingEmailUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
        if (existingEmailUser != null)
        {
            throw new InvalidOperationException("Email already in use");
        }

        // Create user
        var user = new User
        {
            Email = userEmail,
            Name = dto.Name,
            LastName = dto.LastName,
            Cpf = dto.Cpf,
            Phone = dto.Phone,
            PasswordHash = _passwordHasher.HashPassword(dto.Password),
            Role = invite.Role,
            Status = UserStatus.Active,
            EmailVerified = true, // Auto-verify since they used invite
            SpecialtyId = invite.SpecialtyId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);

        // Mark invite as accepted
        invite.Status = InviteStatus.Accepted;
        invite.AcceptedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            Name = user.Name,
            LastName = user.LastName,
            Cpf = user.Cpf,
            Phone = user.Phone,
            Role = user.Role.ToString(),
            Status = user.Status.ToString(),
            EmailVerified = user.EmailVerified,
            SpecialtyId = user.SpecialtyId,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }

    public async Task<bool> DeleteInviteAsync(Guid id)
    {
        var invite = await _context.Invites.FindAsync(id);
        if (invite == null) return false;

        _context.Invites.Remove(invite);
        await _context.SaveChangesAsync();
        return true;
    }

    private static string GenerateSecureToken()
    {
        var bytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "").Replace("/", "").Replace("=", "")[..32];
    }
}
