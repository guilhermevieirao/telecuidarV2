using Application.DTOs.Auth;
using Application.DTOs.Users;
using Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using WebAPI.Extensions;

namespace WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IAuditLogService _auditLogService;
    private readonly IUserService _userService;

    public AuthController(IAuthService authService, IAuditLogService auditLogService, IUserService userService)
    {
        _authService = authService;
        _auditLogService = auditLogService;
        _userService = userService;
    }

    [HttpPost("register")]
    public async Task<ActionResult<RegisterResponseDto>> Register([FromBody] RegisterRequestDto request)
    {
        try
        {
            if (request.Password != request.ConfirmPassword)
            {
                return BadRequest(new { message = "Passwords do not match" });
            }

            if (!request.AcceptTerms)
            {
                return BadRequest(new { message = "You must accept terms and conditions" });
            }

            var user = await _authService.RegisterAsync(
                request.Name,
                request.LastName,
                request.Email,
                request.Cpf,
                request.Phone,
                request.Password
            );

            // Buscar usuário completo com perfis
            var userDto = await _userService.GetUserByIdAsync(user.Id);

            var response = new RegisterResponseDto
            {
                User = userDto ?? new UserDto
                {
                    Id = user.Id,
                    Email = user.Email,
                    Name = user.Name,
                    LastName = user.LastName,
                    Cpf = user.Cpf,
                    Phone = user.Phone,
                    Avatar = user.Avatar,
                    Role = user.Role.ToString(),
                    EmailVerified = user.EmailVerified,
                    CreatedAt = user.CreatedAt,
                    UpdatedAt = user.UpdatedAt
                },
                Message = "User registered successfully. Please verify your email."
            };

            // Audit log
            await _auditLogService.CreateAuditLogAsync(
                user.Id,
                "create",
                "User",
                user.Id.ToString(),
                null,
                HttpContextExtensions.SerializeToJson(new { user.Email, user.Name, user.LastName, user.Role }),
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );

            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred during registration", error = ex.Message });
        }
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginRequestDto request)
    {
        try
        {
            var (user, accessToken, refreshToken) = await _authService.LoginAsync(
                request.Email,
                request.Password,
                request.RememberMe
            );

            if (user == null)
            {
                return Unauthorized(new { message = "Email ou senha incorretos" });
            }

            // Buscar usuário completo com perfis
            var userDto = await _userService.GetUserByIdAsync(user.Id);

            var response = new LoginResponseDto
            {
                User = userDto ?? new UserDto
                {
                    Id = user.Id,
                    Email = user.Email,
                    Name = user.Name,
                    LastName = user.LastName,
                    Cpf = user.Cpf,
                    Phone = user.Phone,
                    Avatar = user.Avatar,
                    Role = user.Role.ToString(),
                    EmailVerified = user.EmailVerified,
                    CreatedAt = user.CreatedAt,
                    UpdatedAt = user.UpdatedAt
                },
                AccessToken = accessToken,
                RefreshToken = refreshToken
            };

            // Audit log
            await _auditLogService.CreateAuditLogAsync(
                user.Id,
                "login",
                "User",
                user.Id.ToString(),
                null,
                HttpContextExtensions.SerializeToJson(new { user.Email, LoginTime = DateTime.UtcNow }),
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );

            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred during login", error = ex.Message });
        }
    }

    [HttpPost("refresh-token")]
    public async Task<ActionResult<LoginResponseDto>> RefreshToken([FromBody] RefreshTokenRequestDto request)
    {
        try
        {
            var result = await _authService.RefreshTokenAsync(request.RefreshToken);

            if (result == null)
            {
                return Unauthorized(new { message = "Invalid or expired refresh token" });
            }

            return Ok(new
            {
                accessToken = result.Value.AccessToken,
                refreshToken = result.Value.RefreshToken
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequestDto request)
    {
        try
        {
            await _authService.ForgotPasswordAsync(request.Email);
            return Ok(new { message = "If the email exists, a password reset link has been sent" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequestDto request)
    {
        try
        {
            if (request.Password != request.ConfirmPassword)
            {
                return BadRequest(new { message = "Passwords do not match" });
            }

            var result = await _authService.ResetPasswordAsync(request.Token, request.Password);

            if (!result)
            {
                return BadRequest(new { message = "Invalid or expired token" });
            }

            return Ok(new { message = "Password reset successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromQuery] string token)
    {
        try
        {
            var result = await _authService.VerifyEmailAsync(token);

            if (!result)
            {
                return BadRequest(new { message = "Invalid or expired token" });
            }

            return Ok(new { message = "Email verified successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost("change-password")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequestDto request)
    {
        try
        {
            if (request.NewPassword != request.ConfirmPassword)
            {
                return BadRequest(new { message = "As senhas não coincidem" });
            }

            // Extrair userId do token JWT - tentar várias formas de claim
            var userIdClaim = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub) 
                ?? User.FindFirst("sub") 
                ?? User.FindFirst("userId")
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            
            if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
            {
                // Log dos claims disponíveis para debug
                var availableClaims = string.Join(", ", User.Claims.Select(c => $"{c.Type}={c.Value}"));
                return Unauthorized(new { message = "Token de usuário inválido ou ausente", debug = availableClaims });
            }

            var result = await _authService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword);

            if (!result)
            {
                return BadRequest(new { message = "Falha ao trocar senha" });
            }

            // Audit log
            await _auditLogService.CreateAuditLogAsync(
                userId,
                "update",
                "User",
                userId.ToString(),
                null,
                HttpContextExtensions.SerializeToJson(new { Action = "Password Changed" }),
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );

            return Ok(new { message = "Senha alterada com sucesso" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpGet("check-email/{email}")]
    public async Task<ActionResult<object>> CheckEmailAvailability(string email)
    {
        try
        {
            var isAvailable = await _authService.IsEmailAvailableAsync(email);
            return Ok(new { available = isAvailable });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpGet("check-cpf/{cpf}")]
    public async Task<ActionResult<object>> CheckCpfAvailability(string cpf)
    {
        try
        {
            var isAvailable = await _authService.IsCpfAvailableAsync(cpf);
            return Ok(new { available = isAvailable });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpGet("check-phone/{phone}")]
    public async Task<ActionResult<object>> CheckPhoneAvailability(string phone)
    {
        try
        {
            var isAvailable = await _authService.IsPhoneAvailableAsync(phone);
            return Ok(new { available = isAvailable });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }
}
