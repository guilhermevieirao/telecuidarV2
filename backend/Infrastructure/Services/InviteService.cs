using Application.DTOs.Invites;
using Application.DTOs.Users;
using Application.DTOs.Notifications;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;

namespace Infrastructure.Services;

public class InviteService : IInviteService
{
    private readonly ApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly INotificationService _notificationService;
    private readonly IEmailService _emailService;
    private readonly ILogger<InviteService> _logger;
    private readonly string _frontendUrl;

    public InviteService(
        ApplicationDbContext context, 
        IPasswordHasher passwordHasher, 
        INotificationService notificationService,
        IEmailService emailService,
        ILogger<InviteService> logger)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _notificationService = notificationService;
        _emailService = emailService;
        _logger = logger;
        _frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:4200";
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
                CreatedAt = i.CreatedAt,
                PrefilledName = i.PrefilledName,
                PrefilledLastName = i.PrefilledLastName,
                PrefilledCpf = i.PrefilledCpf,
                PrefilledPhone = i.PrefilledPhone
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
            CreatedAt = invite.CreatedAt,
            PrefilledName = invite.PrefilledName,
            PrefilledLastName = invite.PrefilledLastName,
            PrefilledCpf = invite.PrefilledCpf,
            PrefilledPhone = invite.PrefilledPhone
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
            CreatedAt = DateTime.UtcNow,
            PrefilledName = dto.Name,
            PrefilledLastName = dto.LastName,
            PrefilledCpf = dto.Cpf,
            PrefilledPhone = dto.Phone
        };

        _context.Invites.Add(invite);
        await _context.SaveChangesAsync();

        // Enviar email se o convite for para um email específico
        if (!string.IsNullOrWhiteSpace(invite.Email))
        {
            try
            {
                var createdByName = adminUser.Name + " " + adminUser.LastName;
                var roleDisplayName = invite.Role.ToString();
                
                var htmlBody = EmailTemplateService.GenerateInviteEmailHtml(
                    string.Empty, // Nome ainda não conhecido
                    roleDisplayName,
                    invite.Token,
                    invite.ExpiresAt,
                    createdByName,
                    _frontendUrl
                );

                var textBody = EmailTemplateService.GenerateInviteEmailPlainText(
                    string.Empty,
                    roleDisplayName,
                    invite.Token,
                    invite.ExpiresAt,
                    createdByName,
                    _frontendUrl
                );

                var subject = "[TeleCuidar] Você foi convidado para a plataforma";

                // Envio assíncrono do email (não bloqueia a resposta)
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var emailSent = await _emailService.SendEmailAsync(invite.Email, invite.Email, subject, htmlBody, textBody);
                        if (emailSent)
                        {
                            _logger.LogInformation("Email de convite enviado com sucesso para {Email}", invite.Email);
                        }
                        else
                        {
                            _logger.LogWarning("Falha ao enviar email de convite para {Email}. Serviço de email pode estar desabilitado.", invite.Email);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Erro ao enviar email de convite para {Email}", invite.Email);
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao preparar email de convite para {Email}", invite.Email);
            }
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
            CreatedAt = invite.CreatedAt,
            PrefilledName = invite.PrefilledName,
            PrefilledLastName = invite.PrefilledLastName,
            PrefilledCpf = invite.PrefilledCpf,
            PrefilledPhone = invite.PrefilledPhone
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
            
            // Notificar admin que criou o convite
            try
            {
                await _notificationService.CreateNotificationAsync(new CreateNotificationDto
                {
                    UserId = invite.CreatedBy,
                    Title = "Convite Expirado",
                    Message = $"O convite para {invite.Email ?? "perfil " + invite.Role} expirou.",
                    Type = "Warning"
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erro ao criar notificação de convite expirado: {ex.Message}");
            }
            
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
            CreatedAt = invite.CreatedAt,
            PrefilledName = invite.PrefilledName,
            PrefilledLastName = invite.PrefilledLastName,
            PrefilledCpf = invite.PrefilledCpf,
            PrefilledPhone = invite.PrefilledPhone
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
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Criar perfil específico baseado no role
        if (invite.Role == UserRole.PROFESSIONAL && invite.SpecialtyId.HasValue)
        {
            var professionalProfile = new ProfessionalProfile
            {
                UserId = user.Id,
                SpecialtyId = invite.SpecialtyId
            };
            _context.ProfessionalProfiles.Add(professionalProfile);
            await _context.SaveChangesAsync();
        }
        else if (invite.Role == UserRole.PATIENT)
        {
            var patientProfile = new PatientProfile { UserId = user.Id };
            _context.PatientProfiles.Add(patientProfile);
            await _context.SaveChangesAsync();
        }

        // Mark invite as accepted
        invite.Status = InviteStatus.Accepted;
        invite.AcceptedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        
        // Notificar admin que criou o convite
        try
        {
            await _notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId = invite.CreatedBy,
                Title = "Convite Aceito",
                Message = $"{user.Name} {user.LastName} aceitou o convite e se registrou na plataforma.",
                Type = "Success"
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Erro ao criar notificação de convite aceito: {ex.Message}");
        }

        // Recarregar usuário com perfis
        var userWithProfiles = await _context.Users
            .Include(u => u.PatientProfile)
            .Include(u => u.ProfessionalProfile)
                .ThenInclude(p => p!.Specialty)
            .FirstAsync(u => u.Id == user.Id);

        return new UserDto
        {
            Id = userWithProfiles.Id,
            Email = userWithProfiles.Email,
            Name = userWithProfiles.Name,
            LastName = userWithProfiles.LastName,
            Cpf = userWithProfiles.Cpf,
            Phone = userWithProfiles.Phone,
            Role = userWithProfiles.Role.ToString(),
            Status = userWithProfiles.Status.ToString(),
            EmailVerified = userWithProfiles.EmailVerified,
            CreatedAt = userWithProfiles.CreatedAt,
            UpdatedAt = userWithProfiles.UpdatedAt,
            PatientProfile = userWithProfiles.PatientProfile != null ? new PatientProfileDto
            {
                Id = userWithProfiles.PatientProfile.Id,
                Cns = userWithProfiles.PatientProfile.Cns,
                SocialName = userWithProfiles.PatientProfile.SocialName,
                Gender = userWithProfiles.PatientProfile.Gender,
                BirthDate = userWithProfiles.PatientProfile.BirthDate,
                MotherName = userWithProfiles.PatientProfile.MotherName,
                FatherName = userWithProfiles.PatientProfile.FatherName,
                Nationality = userWithProfiles.PatientProfile.Nationality,
                ZipCode = userWithProfiles.PatientProfile.ZipCode,
                Address = userWithProfiles.PatientProfile.Address,
                City = userWithProfiles.PatientProfile.City,
                State = userWithProfiles.PatientProfile.State
            } : null,
            ProfessionalProfile = userWithProfiles.ProfessionalProfile != null ? new ProfessionalProfileDto
            {
                Id = userWithProfiles.ProfessionalProfile.Id,
                Crm = userWithProfiles.ProfessionalProfile.Crm,
                Cbo = userWithProfiles.ProfessionalProfile.Cbo,
                SpecialtyId = userWithProfiles.ProfessionalProfile.SpecialtyId,
                SpecialtyName = userWithProfiles.ProfessionalProfile.Specialty?.Name,
                Gender = userWithProfiles.ProfessionalProfile.Gender,
                BirthDate = userWithProfiles.ProfessionalProfile.BirthDate,
                Nationality = userWithProfiles.ProfessionalProfile.Nationality,
                ZipCode = userWithProfiles.ProfessionalProfile.ZipCode,
                Address = userWithProfiles.ProfessionalProfile.Address,
                City = userWithProfiles.ProfessionalProfile.City,
                State = userWithProfiles.ProfessionalProfile.State
            } : null
        };
    }

    public async Task<InviteDto> RegenerateInviteAsync(Guid id)
    {
        var invite = await _context.Invites
            .Include(i => i.CreatedByUser)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (invite == null)
        {
            throw new InvalidOperationException("Invite not found");
        }

        // Generate new token and reset expiry date
        invite.Token = GenerateSecureToken();
        invite.ExpiresAt = DateTime.UtcNow.AddDays(7);
        invite.Status = InviteStatus.Pending;
        
        await _context.SaveChangesAsync();

        // Resend email if email is provided
        if (!string.IsNullOrWhiteSpace(invite.Email))
        {
            try
            {
                var createdByName = invite.CreatedByUser != null 
                    ? $"{invite.CreatedByUser.Name} {invite.CreatedByUser.LastName}"
                    : "System";
                var roleDisplayName = invite.Role.ToString();
                
                var htmlBody = EmailTemplateService.GenerateInviteEmailHtml(
                    string.Empty,
                    roleDisplayName,
                    invite.Token,
                    invite.ExpiresAt,
                    createdByName,
                    _frontendUrl
                );

                var textBody = EmailTemplateService.GenerateInviteEmailPlainText(
                    string.Empty,
                    roleDisplayName,
                    invite.Token,
                    invite.ExpiresAt,
                    createdByName,
                    _frontendUrl
                );

                var subject = "[TeleCuidar] Convite reenviado - Você foi convidado para a plataforma";

                // Envio assíncrono do email
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var emailSent = await _emailService.SendEmailAsync(invite.Email, invite.Email, subject, htmlBody, textBody);
                        if (emailSent)
                        {
                            _logger.LogInformation("Email de convite reenviado com sucesso para {Email}", invite.Email);
                        }
                        else
                        {
                            _logger.LogWarning("Falha ao reenviar email de convite para {Email}. Serviço de email pode estar desabilitado.", invite.Email);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Erro ao reenviar email de convite para {Email}", invite.Email);
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao preparar email reenviado para {Email}", invite.Email);
            }
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
            CreatedByName = invite.CreatedByUser != null ? $"{invite.CreatedByUser.Name} {invite.CreatedByUser.LastName}" : "System",
            CreatedAt = invite.CreatedAt,
            PrefilledName = invite.PrefilledName,
            PrefilledLastName = invite.PrefilledLastName,
            PrefilledCpf = invite.PrefilledCpf,
            PrefilledPhone = invite.PrefilledPhone
        };
    }

    public async Task<bool> CancelInviteAsync(Guid id)
    {
        var invite = await _context.Invites.FindAsync(id);
        if (invite == null) return false;

        // Apenas mudar o status para Cancelled
        invite.Status = InviteStatus.Cancelled;
        await _context.SaveChangesAsync();
        return true;
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
