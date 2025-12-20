using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IConfiguration _configuration;

    public AuthService(
        ApplicationDbContext context,
        IJwtService jwtService,
        IPasswordHasher passwordHasher,
        IConfiguration configuration)
    {
        _context = context;
        _jwtService = jwtService;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
    }

    public async Task<(User? User, string AccessToken, string RefreshToken)> LoginAsync(string email, string password, bool rememberMe)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        
        if (user == null || !_passwordHasher.VerifyPassword(password, user.PasswordHash))
        {
            return (null, string.Empty, string.Empty);
        }

        if (user.Status == UserStatus.Inactive)
        {
            throw new InvalidOperationException("User account is inactive");
        }

        var accessToken = _jwtService.GenerateAccessToken(user.Id, user.Email, user.Role.ToString());
        var refreshToken = _jwtService.GenerateRefreshToken();

        var refreshTokenDaysStr = Environment.GetEnvironmentVariable("JWT_REFRESH_TOKEN_EXPIRATION_DAYS") 
            ?? _configuration["JwtSettings:RefreshTokenExpirationDays"] 
            ?? "7";
        var refreshTokenDays = int.Parse(refreshTokenDaysStr);
        
        var refreshTokenExpiry = rememberMe 
            ? DateTime.UtcNow.AddDays(refreshTokenDays)
            : DateTime.UtcNow.AddDays(1);

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = refreshTokenExpiry;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return (user, accessToken, refreshToken);
    }

    public async Task<User> RegisterAsync(string name, string lastName, string email, string cpf, string? phone, string password)
    {
        // Validar senha forte
        if (!Application.Validators.CustomValidators.IsValidPassword(password))
        {
            var requirements = Application.Validators.CustomValidators.GetPasswordMissingRequirements(password);
            throw new InvalidOperationException($"Password does not meet security requirements. Missing: {string.Join(", ", requirements)}");
        }

        // Verificar se email já existe
        if (await _context.Users.AnyAsync(u => u.Email == email))
        {
            throw new InvalidOperationException("Email already in use");
        }

        // Verificar se CPF já existe
        if (await _context.Users.AnyAsync(u => u.Cpf == cpf))
        {
            throw new InvalidOperationException("CPF already in use");
        }

        // Verificar se telefone já existe
        if (!string.IsNullOrEmpty(phone) && await _context.Users.AnyAsync(u => u.Phone == phone))
        {
            throw new InvalidOperationException("Phone already in use");
        }

        // Se é o primeiro usuário do sistema, torná-lo ADMIN
        var isFirstUser = !await _context.Users.AnyAsync();
        var userRole = isFirstUser ? UserRole.ADMIN : UserRole.PATIENT;

        var user = new User
        {
            Name = name,
            LastName = lastName,
            Email = email,
            Cpf = cpf,
            Phone = phone,
            PasswordHash = _passwordHasher.HashPassword(password),
            Role = userRole, // Primeiro usuário é ADMIN, demais são PATIENT por padrão
            Status = UserStatus.Active,
            EmailVerified = false,
            EmailVerificationToken = Guid.NewGuid().ToString(),
            EmailVerificationTokenExpiry = DateTime.UtcNow.AddHours(24)
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return user;
    }

    public async Task<(string AccessToken, string RefreshToken)?> RefreshTokenAsync(string refreshToken)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.RefreshToken == refreshToken);

        if (user == null || user.RefreshTokenExpiry == null || user.RefreshTokenExpiry < DateTime.UtcNow)
        {
            return null;
        }

        var newAccessToken = _jwtService.GenerateAccessToken(user.Id, user.Email, user.Role.ToString());
        var newRefreshToken = _jwtService.GenerateRefreshToken();

        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return (newAccessToken, newRefreshToken);
    }

    public async Task<bool> ForgotPasswordAsync(string email)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            // Por segurança, retorna true mesmo se usuário não existe
            return true;
        }

        user.PasswordResetToken = Guid.NewGuid().ToString();
        user.PasswordResetTokenExpiry = DateTime.UtcNow.AddHours(1);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // TODO: Enviar email com token
        // Aqui você implementaria o envio do email

        return true;
    }

    public async Task<bool> ResetPasswordAsync(string token, string newPassword)
    {
        // Validar senha forte
        if (!Application.Validators.CustomValidators.IsValidPassword(newPassword))
        {
            var requirements = Application.Validators.CustomValidators.GetPasswordMissingRequirements(newPassword);
            throw new InvalidOperationException($"Password does not meet security requirements. Missing: {string.Join(", ", requirements)}");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == token);

        if (user == null || user.PasswordResetTokenExpiry == null || user.PasswordResetTokenExpiry < DateTime.UtcNow)
        {
            return false;
        }

        user.PasswordHash = _passwordHasher.HashPassword(newPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiry = null;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> VerifyEmailAsync(string token)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.EmailVerificationToken == token);

        if (user == null || user.EmailVerificationTokenExpiry == null || user.EmailVerificationTokenExpiry < DateTime.UtcNow)
        {
            return false;
        }

        user.EmailVerified = true;
        user.EmailVerificationToken = null;
        user.EmailVerificationTokenExpiry = null;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword)
    {
        var user = await _context.Users.FindAsync(userId);

        if (user == null)
        {
            return false;
        }

        // Verificar senha atual
        if (!_passwordHasher.VerifyPassword(currentPassword, user.PasswordHash))
        {
            throw new InvalidOperationException("Senha atual está incorreta");
        }

        // Validar nova senha
        if (!Application.Validators.CustomValidators.IsValidPassword(newPassword))
        {
            var requirements = Application.Validators.CustomValidators.GetPasswordMissingRequirements(newPassword);
            throw new InvalidOperationException($"A nova senha não atende aos requisitos de segurança. Faltam: {string.Join(", ", requirements)}");
        }

        // Atualizar senha
        user.PasswordHash = _passwordHasher.HashPassword(newPassword);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> IsEmailAvailableAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;

        return !await _context.Users.AnyAsync(u => u.Email == email);
    }

    public async Task<bool> IsCpfAvailableAsync(string cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf))
            return false;

        // Remover formatação do CPF para comparação
        var cleanCpf = cpf.Replace(".", "").Replace("-", "");
        return !await _context.Users.AnyAsync(u => u.Cpf.Replace(".", "").Replace("-", "") == cleanCpf);
    }

    public async Task<bool> IsPhoneAvailableAsync(string phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return true; // Telefone vazio é considerado disponível

        // Remover formatação do telefone para comparação
        var cleanPhone = phone.Replace("(", "").Replace(")", "").Replace("-", "").Replace(" ", "");
        return !await _context.Users.AnyAsync(u => u.Phone != null && 
            u.Phone.Replace("(", "").Replace(")", "").Replace("-", "").Replace(" ", "") == cleanPhone);
    }
}
