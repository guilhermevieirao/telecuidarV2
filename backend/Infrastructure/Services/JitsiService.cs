using Application.DTOs.Jitsi;
using Application.Interfaces;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace Infrastructure.Services;

/// <summary>
/// Serviço para gerenciamento de tokens JWT do Jitsi Meet
/// Implementa autenticação segura para videochamadas self-hosted
/// </summary>
public class JitsiService : IJitsiService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    
    // Configurações do Jitsi carregadas de variáveis de ambiente
    private readonly bool _enabled;
    private readonly string _domain;
    private readonly string _appId;
    private readonly string _appSecret;
    private readonly int _tokenExpirationMinutes;
    private readonly bool _requiresAuth;

    public JitsiService(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
        
        // Carregar configurações do Jitsi (prioridade: variáveis de ambiente > appsettings)
        _enabled = GetConfigValue("JITSI_ENABLED", "JitsiSettings:Enabled", "true").ToLower() == "true";
        _domain = GetConfigValue("JITSI_DOMAIN", "JitsiSettings:Domain", "meet.jit.si");
        _appId = GetConfigValue("JITSI_APP_ID", "JitsiSettings:AppId", "telecuidar");
        _appSecret = GetConfigValue("JITSI_APP_SECRET", "JitsiSettings:AppSecret", "");
        _tokenExpirationMinutes = int.TryParse(
            GetConfigValue("JITSI_TOKEN_EXPIRATION_MINUTES", "JitsiSettings:TokenExpirationMinutes", "120"),
            out var expMin) ? expMin : 120;
        _requiresAuth = GetConfigValue("JITSI_REQUIRES_AUTH", "JitsiSettings:RequiresAuth", "true").ToLower() == "true";
    }

    private string GetConfigValue(string envKey, string configKey, string defaultValue)
    {
        return Environment.GetEnvironmentVariable(envKey)
            ?? _configuration[configKey]
            ?? defaultValue;
    }

    /// <summary>
    /// Gera um token JWT para autenticação no Jitsi Meet
    /// O token inclui informações do usuário e permissões baseadas no papel
    /// </summary>
    public async Task<JitsiTokenResponseDto?> GenerateTokenAsync(Guid userId, Guid appointmentId)
    {
        if (!_enabled)
            return null;

        // Buscar dados da consulta
        var appointment = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Professional)
            .Include(a => a.Specialty)
            .FirstOrDefaultAsync(a => a.Id == appointmentId);

        if (appointment == null)
            return null;

        // Buscar dados do usuário
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return null;

        // Validar acesso: apenas paciente ou profissional da consulta
        var isPatient = appointment.PatientId == userId;
        var isProfessional = appointment.ProfessionalId == userId;
        var isAdmin = user.Role == UserRole.ADMIN;
        
        if (!isPatient && !isProfessional && !isAdmin)
            return null;

        // Profissional e Admin são moderadores, paciente é convidado
        var isModerator = isProfessional || isAdmin;

        // Nome da sala baseado no ID da consulta (único e previsível)
        var roomName = $"telecuidar-{appointmentId:N}";

        // Nome de exibição (Nome + Sobrenome)
        var displayName = $"{user.Name} {user.LastName}".Trim();
        
        // URL do avatar (se existir no usuário)
        string? avatarUrl = user.Avatar;

        // Gerar token JWT para o Jitsi
        var token = GenerateJitsiJwt(
            userId: userId.ToString(),
            email: user.Email,
            displayName: displayName,
            avatarUrl: avatarUrl,
            roomName: roomName,
            isModerator: isModerator
        );

        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(_tokenExpirationMinutes).ToUnixTimeSeconds();

        return new JitsiTokenResponseDto
        {
            Token = token,
            RoomName = roomName,
            Domain = _domain,
            DisplayName = displayName,
            Email = user.Email,
            AvatarUrl = avatarUrl,
            IsModerator = isModerator,
            ExpiresAt = expiresAt
        };
    }

    /// <summary>
    /// Obtém as configurações do Jitsi para o frontend
    /// </summary>
    public JitsiConfigDto GetConfig()
    {
        return new JitsiConfigDto
        {
            Enabled = _enabled,
            Domain = _domain,
            RequiresAuth = _requiresAuth
        };
    }

    /// <summary>
    /// Valida se um usuário tem acesso a uma sala de consulta
    /// </summary>
    public async Task<bool> ValidateAccessAsync(Guid userId, Guid appointmentId)
    {
        var appointment = await _context.Appointments
            .FirstOrDefaultAsync(a => a.Id == appointmentId);

        if (appointment == null)
            return false;

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return false;

        // Verificar se é participante da consulta ou admin
        return appointment.PatientId == userId 
            || appointment.ProfessionalId == userId 
            || user.Role == UserRole.ADMIN;
    }

    /// <summary>
    /// Gera o token JWT no formato esperado pelo Jitsi Meet
    /// Compatível com prosody-jwt-auth e jitsi-meet-web
    /// </summary>
    private string GenerateJitsiJwt(
        string userId,
        string email,
        string displayName,
        string? avatarUrl,
        string roomName,
        bool isModerator)
    {
        if (string.IsNullOrEmpty(_appSecret))
        {
            // Se não há secret configurado, retornar token vazio (Jitsi público)
            return "";
        }

        var now = DateTimeOffset.UtcNow;
        var expires = now.AddMinutes(_tokenExpirationMinutes);

        // Claims padrão do Jitsi JWT
        var claims = new List<Claim>
        {
            // Claims de autenticação
            new Claim(JwtRegisteredClaimNames.Iss, _appId),
            new Claim(JwtRegisteredClaimNames.Sub, _domain),
            new Claim(JwtRegisteredClaimNames.Aud, _appId),
            new Claim(JwtRegisteredClaimNames.Iat, now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new Claim(JwtRegisteredClaimNames.Exp, expires.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new Claim(JwtRegisteredClaimNames.Nbf, now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            
            // Room claim - restringe o token a uma sala específica
            new Claim("room", roomName),
        };

        // Criar o payload do token com a estrutura do Jitsi
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_appSecret));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        // Criar payload customizado com context (formato Jitsi)
        var header = new JwtHeader(credentials);
        var payload = new JwtPayload
        {
            { "iss", _appId },
            { "sub", _domain },
            { "aud", _appId },
            { "iat", now.ToUnixTimeSeconds() },
            { "exp", expires.ToUnixTimeSeconds() },
            { "nbf", now.ToUnixTimeSeconds() },
            { "room", roomName },
            { "context", new Dictionary<string, object>
                {
                    { "user", new Dictionary<string, object>
                        {
                            { "id", userId },
                            { "name", displayName },
                            { "email", email },
                            { "avatar", avatarUrl ?? "" },
                            { "moderator", isModerator }
                        }
                    },
                    { "features", new Dictionary<string, object>
                        {
                            { "livestreaming", false },
                            { "recording", false },
                            { "transcription", false },
                            { "outbound-call", false }
                        }
                    }
                }
            },
            { "moderator", isModerator }
        };

        var token = new JwtSecurityToken(header, payload);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
