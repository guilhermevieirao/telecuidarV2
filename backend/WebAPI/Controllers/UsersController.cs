using Application.DTOs.Users;
using Application.Interfaces;
using WebAPI.Services;
using WebAPI.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WebAPI.Extensions;

namespace WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IAuditLogService _auditLogService;
    private readonly IFileUploadService _fileUploadService;
    private readonly IRealTimeNotificationService _realTimeNotification;

    public UsersController(
        IUserService userService, 
        IAuditLogService auditLogService, 
        IFileUploadService fileUploadService,
        IRealTimeNotificationService realTimeNotification)
    {
        _userService = userService;
        _auditLogService = auditLogService;
        _fileUploadService = fileUploadService;
        _realTimeNotification = realTimeNotification;
    }
    
    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return userIdClaim != null ? Guid.Parse(userIdClaim) : null;
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedUsersDto>> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? role = null,
        [FromQuery] string? status = null,
        [FromQuery] Guid? specialtyId = null)
    {
        try
        {
            var result = await _userService.GetUsersAsync(page, pageSize, search, role, status, specialtyId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserDto>> GetUser(Guid id)
    {
        try
        {
            var user = await _userService.GetUserByIdAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }
            return Ok(user);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserDto dto)
    {
        try
        {
            var user = await _userService.CreateUserAsync(dto);
            
            // Audit log
            await _auditLogService.CreateAuditLogAsync(
                GetCurrentUserId(),
                "create",
                "User",
                user.Id.ToString(),
                null,
                HttpContextExtensions.SerializeToJson(new { user.Email, user.Name, user.LastName, user.Role, user.Status }),
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityCreatedAsync("User", user.Id.ToString(), user, GetCurrentUserId()?.ToString());
            await _realTimeNotification.NotifyDashboardUpdateAsync(new DashboardUpdateNotification
            {
                StatType = "TotalUsers",
                Value = null // Frontend will refetch
            });
            
            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
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

    [HttpPut("{id}")]
    public async Task<ActionResult<UserDto>> UpdateUser(Guid id, [FromBody] UpdateUserDto dto)
    {
        try
        {
            var oldUser = await _userService.GetUserByIdAsync(id);
            if (oldUser == null)
            {
                return NotFound(new { message = "User not found" });
            }
            
            var user = await _userService.UpdateUserAsync(id, dto);
            
            // Audit log with differences
            var oldValues = oldUser != null ? HttpContextExtensions.SerializeToJson(new { oldUser.Name, oldUser.LastName, oldUser.Email, oldUser.Phone, oldUser.Role, oldUser.Status }) : null;
            var newValues = HttpContextExtensions.SerializeToJson(new { user?.Name, user?.LastName, user?.Email, user?.Phone, user?.Role, user?.Status });
            
            await _auditLogService.CreateAuditLogAsync(
                GetCurrentUserId(),
                "update",
                "User",
                id.ToString(),
                oldValues,
                newValues,
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityUpdatedAsync("User", id.ToString(), user!, GetCurrentUserId()?.ToString());
            
            // Notify if status changed
            if (user != null && oldUser != null && oldUser.Status != user.Status)
            {
                await _realTimeNotification.NotifyDashboardUpdateAsync(new DashboardUpdateNotification
                {
                    StatType = "UserStatusChanged",
                    Value = new { UserId = id, OldStatus = oldUser.Status, NewStatus = user.Status }
                });
            }
            
            return Ok(user);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        try
        {
            var user = await _userService.GetUserByIdAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }
            
            var result = await _userService.DeleteUserAsync(id);
            
            // Audit log
            await _auditLogService.CreateAuditLogAsync(
                GetCurrentUserId(),
                "delete",
                "User",
                id.ToString(),
                HttpContextExtensions.SerializeToJson(new { user.Email, user.Name, user.LastName, user.Role }),
                null,
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );
            
            // Real-time notification
            await _realTimeNotification.NotifyEntityDeletedAsync("User", id.ToString(), GetCurrentUserId()?.ToString());
            await _realTimeNotification.NotifyDashboardUpdateAsync(new DashboardUpdateNotification
            {
                StatType = "TotalUsers",
                Value = null
            });
            
            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPost("{id}/avatar")]
    public async Task<ActionResult<UserDto>> UploadAvatar(Guid id, IFormFile file)
    {
        try
        {
            // Validate file
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file provided" });
            }

            const long maxFileSize = 5 * 1024 * 1024; // 5 MB
            if (file.Length > maxFileSize)
            {
                return BadRequest(new { message = "File size exceeds 5 MB limit" });
            }

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var fileExtension = Path.GetExtension(file.FileName).ToLower();
            if (!allowedExtensions.Contains(fileExtension))
            {
                return BadRequest(new { message = "Invalid file type. Only images are allowed" });
            }

            // Get user to delete old avatar if exists
            var existingUser = await _userService.GetUserByIdAsync(id);
            if (existingUser == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Delete old avatar if exists
            if (!string.IsNullOrEmpty(existingUser.Avatar))
            {
                _fileUploadService.DeleteAvatar(existingUser.Avatar);
            }

            // Upload new avatar
            using (var stream = file.OpenReadStream())
            {
                var avatarPath = await _fileUploadService.UploadAvatarAsync(stream, file.FileName, id);

                // Update user with new avatar path
                var updateDto = new UpdateUserDto { Avatar = avatarPath };
                var updatedUser = await _userService.UpdateUserAsync(id, updateDto);

                // Audit log
                await _auditLogService.CreateAuditLogAsync(
                    GetCurrentUserId(),
                    "update",
                    "User",
                    id.ToString(),
                    null,
                    HttpContextExtensions.SerializeToJson(new { avatarPath }),
                    HttpContext.GetIpAddress(),
                    HttpContext.GetUserAgent()
                );

                return Ok(updatedUser);
            }
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

    // ============================================
    // Endpoints de Perfil de Paciente
    // ============================================

    [HttpGet("{id}/patient-profile")]
    public async Task<ActionResult<PatientProfileDto>> GetPatientProfile(Guid id)
    {
        try
        {
            var profile = await _userService.GetPatientProfileAsync(id);
            if (profile == null)
            {
                return NotFound(new { message = "Patient profile not found" });
            }
            return Ok(profile);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPut("{id}/patient-profile")]
    public async Task<ActionResult<PatientProfileDto>> UpdatePatientProfile(Guid id, [FromBody] CreateUpdatePatientProfileDto dto)
    {
        try
        {
            var user = await _userService.GetUserByIdAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var profile = await _userService.CreateOrUpdatePatientProfileAsync(id, dto);

            // Audit log
            await _auditLogService.CreateAuditLogAsync(
                GetCurrentUserId(),
                "update",
                "PatientProfile",
                id.ToString(),
                null,
                HttpContextExtensions.SerializeToJson(dto),
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );

            return Ok(profile);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    // ============================================
    // Endpoints de Perfil de Profissional
    // ============================================

    [HttpGet("{id}/professional-profile")]
    public async Task<ActionResult<ProfessionalProfileDto>> GetProfessionalProfile(Guid id)
    {
        try
        {
            var profile = await _userService.GetProfessionalProfileAsync(id);
            if (profile == null)
            {
                return NotFound(new { message = "Professional profile not found" });
            }
            return Ok(profile);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }

    [HttpPut("{id}/professional-profile")]
    [Authorize(Roles = "ADMIN,PROFESSIONAL")]
    public async Task<ActionResult<ProfessionalProfileDto>> UpdateProfessionalProfile(Guid id, [FromBody] CreateUpdateProfessionalProfileDto dto)
    {
        try
        {
            var user = await _userService.GetUserByIdAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var profile = await _userService.CreateOrUpdateProfessionalProfileAsync(id, dto);

            // Audit log
            await _auditLogService.CreateAuditLogAsync(
                GetCurrentUserId(),
                "update",
                "ProfessionalProfile",
                id.ToString(),
                null,
                HttpContextExtensions.SerializeToJson(dto),
                HttpContext.GetIpAddress(),
                HttpContext.GetUserAgent()
            );

            return Ok(profile);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred", error = ex.Message });
        }
    }
}
