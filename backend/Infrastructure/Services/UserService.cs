using Application.DTOs.Users;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services;

public class UserService : IUserService
{
    private readonly ApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;

    public UserService(ApplicationDbContext context, IPasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    public async Task<PaginatedUsersDto> GetUsersAsync(int page, int pageSize, string? search, string? role, string? status, Guid? specialtyId = null)
    {
        var query = _context.Users
            .Include(u => u.PatientProfile)
            .Include(u => u.ProfessionalProfile)
                .ThenInclude(p => p!.Specialty)
            .AsQueryable();

        // Apply filters
        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(u =>
                u.Name.Contains(search) ||
                u.LastName.Contains(search) ||
                u.Email.Contains(search) ||
                u.Cpf.Contains(search));
        }

        if (!string.IsNullOrEmpty(role) && role.ToLower() != "all")
        {
            if (Enum.TryParse<UserRole>(role, true, out var userRole))
            {
                query = query.Where(u => u.Role == userRole);
            }
        }

        if (!string.IsNullOrEmpty(status) && status.ToLower() != "all")
        {
            if (Enum.TryParse<UserStatus>(status, true, out var userStatus))
            {
                query = query.Where(u => u.Status == userStatus);
            }
        }
        
        // Filtrar por especialidade (via ProfessionalProfile)
        if (specialtyId.HasValue)
        {
            query = query.Where(u => 
                u.ProfessionalProfile != null && u.ProfessionalProfile.SpecialtyId == specialtyId);
        }

        var total = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(total / (double)pageSize);

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var userDtos = users.Select(u => MapToUserDto(u)).ToList();

        return new PaginatedUsersDto
        {
            Data = userDtos,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };
    }

    public async Task<UserDto?> GetUserByIdAsync(Guid id)
    {
        var user = await _context.Users
            .Include(u => u.PatientProfile)
            .Include(u => u.ProfessionalProfile)
                .ThenInclude(p => p!.Specialty)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null) return null;

        return MapToUserDto(user);
    }

    public async Task<UserDto> CreateUserAsync(CreateUserDto dto)
    {
        // Validate required fields
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("Name is required");

        if (string.IsNullOrWhiteSpace(dto.LastName))
            throw new InvalidOperationException("Last name is required");

        if (string.IsNullOrWhiteSpace(dto.Email))
            throw new InvalidOperationException("Email is required");

        if (!Application.Validators.CustomValidators.IsValidEmail(dto.Email))
            throw new InvalidOperationException("Invalid email format");

        if (string.IsNullOrWhiteSpace(dto.Cpf))
            throw new InvalidOperationException("CPF is required");

        if (!Application.Validators.CustomValidators.IsValidCpf(dto.Cpf))
            throw new InvalidOperationException("Invalid CPF");

        if (string.IsNullOrWhiteSpace(dto.Password))
            throw new InvalidOperationException("Password is required");

        if (!Application.Validators.CustomValidators.IsValidPassword(dto.Password))
        {
            var missing = Application.Validators.CustomValidators.GetPasswordMissingRequirements(dto.Password);
            throw new InvalidOperationException($"Password must have: {string.Join(", ", missing)}");
        }

        if (!string.IsNullOrWhiteSpace(dto.Phone) && !Application.Validators.CustomValidators.IsValidPhone(dto.Phone))
            throw new InvalidOperationException("Invalid phone number");

        // Validate email doesn't exist
        if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
        {
            throw new InvalidOperationException("Email already in use");
        }

        // Validate CPF doesn't exist
        if (await _context.Users.AnyAsync(u => u.Cpf == dto.Cpf))
        {
            throw new InvalidOperationException("CPF already in use");
        }

        // Validate phone doesn't exist
        if (!string.IsNullOrWhiteSpace(dto.Phone) && await _context.Users.AnyAsync(u => u.Phone == dto.Phone))
        {
            throw new InvalidOperationException("Phone already in use");
        }

        if (!Enum.TryParse<UserRole>(dto.Role, true, out var userRole))
        {
            throw new InvalidOperationException("Invalid role");
        }

        var user = new User
        {
            Email = dto.Email,
            Name = dto.Name,
            LastName = dto.LastName,
            Cpf = dto.Cpf,
            Phone = dto.Phone,
            PasswordHash = _passwordHasher.HashPassword(dto.Password),
            Role = userRole,
            Status = UserStatus.Active,
            EmailVerified = false
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Criar perfil específico baseado no role
        if (userRole == UserRole.PATIENT)
        {
            if (dto.PatientProfile != null)
            {
                await CreateOrUpdatePatientProfileAsync(user.Id, dto.PatientProfile);
            }
            else
            {
                // Criar perfil vazio para paciente
                var patientProfile = new PatientProfile { UserId = user.Id };
                _context.PatientProfiles.Add(patientProfile);
                await _context.SaveChangesAsync();
            }
        }

        if (userRole == UserRole.PROFESSIONAL)
        {
            if (dto.ProfessionalProfile != null)
            {
                await CreateOrUpdateProfessionalProfileAsync(user.Id, dto.ProfessionalProfile);
            }
            else
            {
                // Criar perfil vazio para profissional
                var professionalProfile = new ProfessionalProfile { UserId = user.Id };
                _context.ProfessionalProfiles.Add(professionalProfile);
                await _context.SaveChangesAsync();
            }
        }

        // Recarregar com os perfis
        return (await GetUserByIdAsync(user.Id))!;
    }

    public async Task<UserDto?> UpdateUserAsync(Guid id, UpdateUserDto dto)
    {
        var user = await _context.Users
            .Include(u => u.PatientProfile)
            .Include(u => u.ProfessionalProfile)
            .FirstOrDefaultAsync(u => u.Id == id);
            
        if (user == null) return null;

        if (!string.IsNullOrEmpty(dto.Name))
            user.Name = dto.Name;

        if (!string.IsNullOrEmpty(dto.LastName))
            user.LastName = dto.LastName;

        if (dto.Phone != null)
        {
            // Validar se o telefone já está em uso por outro usuário
            if (!string.IsNullOrWhiteSpace(dto.Phone) && 
                await _context.Users.AnyAsync(u => u.Phone == dto.Phone && u.Id != id))
            {
                throw new InvalidOperationException("Phone already in use");
            }
            user.Phone = dto.Phone;
        }

        if (dto.Avatar != null)
            user.Avatar = dto.Avatar;

        if (!string.IsNullOrEmpty(dto.Status) && Enum.TryParse<UserStatus>(dto.Status, true, out var status))
            user.Status = status;

        if (!string.IsNullOrEmpty(dto.Role) && Enum.TryParse<UserRole>(dto.Role, true, out var role))
            user.Role = role;

        user.UpdatedAt = DateTime.UtcNow;

        // Atualizar perfil de paciente se fornecido
        if (dto.PatientProfile != null)
        {
            await CreateOrUpdatePatientProfileAsync(user.Id, dto.PatientProfile);
        }

        // Atualizar perfil de profissional se fornecido
        if (dto.ProfessionalProfile != null)
        {
            await CreateOrUpdateProfessionalProfileAsync(user.Id, dto.ProfessionalProfile);
        }

        await _context.SaveChangesAsync();

        return await GetUserByIdAsync(id);
    }

    public async Task<bool> DeleteUserAsync(Guid id)
    {
        var user = await _context.Users
            .Include(u => u.PatientProfile)
            .Include(u => u.ProfessionalProfile)
            .FirstOrDefaultAsync(u => u.Id == id);
            
        if (user == null) return false;

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<PatientProfileDto?> GetPatientProfileAsync(Guid userId)
    {
        var profile = await _context.PatientProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);
            
        if (profile == null) return null;

        return MapToPatientProfileDto(profile);
    }

    public async Task<ProfessionalProfileDto?> GetProfessionalProfileAsync(Guid userId)
    {
        var profile = await _context.ProfessionalProfiles
            .Include(p => p.Specialty)
            .FirstOrDefaultAsync(p => p.UserId == userId);
            
        if (profile == null) return null;

        return MapToProfessionalProfileDto(profile);
    }

    public async Task<PatientProfileDto> CreateOrUpdatePatientProfileAsync(Guid userId, CreateUpdatePatientProfileDto dto)
    {
        var profile = await _context.PatientProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
        {
            profile = new PatientProfile { UserId = userId };
            _context.PatientProfiles.Add(profile);
        }

        // Atualizar campos
        if (dto.Cns != null) profile.Cns = dto.Cns;
        if (dto.SocialName != null) profile.SocialName = dto.SocialName;
        if (dto.Gender != null) profile.Gender = dto.Gender;
        if (dto.BirthDate.HasValue) profile.BirthDate = dto.BirthDate;
        if (dto.MotherName != null) profile.MotherName = dto.MotherName;
        if (dto.FatherName != null) profile.FatherName = dto.FatherName;
        if (dto.Nationality != null) profile.Nationality = dto.Nationality;
        if (dto.ZipCode != null) profile.ZipCode = dto.ZipCode;
        if (dto.Address != null) profile.Address = dto.Address;
        if (dto.City != null) profile.City = dto.City;
        if (dto.State != null) profile.State = dto.State;

        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapToPatientProfileDto(profile);
    }

    public async Task<ProfessionalProfileDto> CreateOrUpdateProfessionalProfileAsync(Guid userId, CreateUpdateProfessionalProfileDto dto)
    {
        var profile = await _context.ProfessionalProfiles
            .Include(p => p.Specialty)
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
        {
            profile = new ProfessionalProfile { UserId = userId };
            _context.ProfessionalProfiles.Add(profile);
        }

        // Atualizar campos
        if (dto.Crm != null) profile.Crm = dto.Crm;
        if (dto.Cbo != null) profile.Cbo = dto.Cbo;
        if (dto.SpecialtyId.HasValue) profile.SpecialtyId = dto.SpecialtyId;
        if (dto.Gender != null) profile.Gender = dto.Gender;
        if (dto.BirthDate.HasValue) profile.BirthDate = dto.BirthDate;
        if (dto.Nationality != null) profile.Nationality = dto.Nationality;
        if (dto.ZipCode != null) profile.ZipCode = dto.ZipCode;
        if (dto.Address != null) profile.Address = dto.Address;
        if (dto.City != null) profile.City = dto.City;
        if (dto.State != null) profile.State = dto.State;

        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Recarregar para incluir especialidade
        await _context.Entry(profile).Reference(p => p.Specialty).LoadAsync();

        return MapToProfessionalProfileDto(profile);
    }

    // ============================================
    // Métodos de mapeamento
    // ============================================

    private static UserDto MapToUserDto(User user)
    {
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            Name = user.Name,
            LastName = user.LastName,
            Cpf = user.Cpf,
            Phone = user.Phone,
            Avatar = user.Avatar,
            Role = user.Role.ToString(),
            Status = user.Status.ToString(),
            EmailVerified = user.EmailVerified,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            PatientProfile = user.PatientProfile != null ? MapToPatientProfileDto(user.PatientProfile) : null,
            ProfessionalProfile = user.ProfessionalProfile != null ? MapToProfessionalProfileDto(user.ProfessionalProfile) : null
        };
    }

    private static PatientProfileDto MapToPatientProfileDto(PatientProfile profile)
    {
        return new PatientProfileDto
        {
            Id = profile.Id,
            Cns = profile.Cns,
            SocialName = profile.SocialName,
            Gender = profile.Gender,
            BirthDate = profile.BirthDate,
            MotherName = profile.MotherName,
            FatherName = profile.FatherName,
            Nationality = profile.Nationality,
            ZipCode = profile.ZipCode,
            Address = profile.Address,
            City = profile.City,
            State = profile.State
        };
    }

    private static ProfessionalProfileDto MapToProfessionalProfileDto(ProfessionalProfile profile)
    {
        return new ProfessionalProfileDto
        {
            Id = profile.Id,
            Crm = profile.Crm,
            Cbo = profile.Cbo,
            SpecialtyId = profile.SpecialtyId,
            SpecialtyName = profile.Specialty?.Name,
            Gender = profile.Gender,
            BirthDate = profile.BirthDate,
            Nationality = profile.Nationality,
            ZipCode = profile.ZipCode,
            Address = profile.Address,
            City = profile.City,
            State = profile.State
        };
    }
}
