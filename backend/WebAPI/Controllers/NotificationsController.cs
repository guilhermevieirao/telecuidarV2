using Application.DTOs.Notifications;
using Application.Interfaces;
using WebAPI.Services;
using WebAPI.Hubs;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly IRealTimeNotificationService _realTimeNotification;

    public NotificationsController(INotificationService notificationService, IRealTimeNotificationService realTimeNotification)
    {
        _notificationService = notificationService;
        _realTimeNotification = realTimeNotification;
    }

    [HttpGet("user/{userId}")]
    public async Task<ActionResult<PaginatedNotificationsDto>> GetNotifications(
        Guid userId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] bool? isRead = null)
    {
        var result = await _notificationService.GetNotificationsAsync(userId, page, pageSize, isRead);
        return Ok(result);
    }

    [HttpGet("user/{userId}/unread-count")]
    public async Task<ActionResult<int>> GetUnreadCount(Guid userId)
    {
        var count = await _notificationService.GetUnreadCountAsync(userId);
        return Ok(new { count });
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<NotificationDto>> CreateNotification([FromBody] CreateNotificationDto dto)
    {
        var notification = await _notificationService.CreateNotificationAsync(dto);
        
        // Real-time notification to user
        var unreadCount = await _notificationService.GetUnreadCountAsync(dto.UserId);
        await _realTimeNotification.NotifyUserAsync(dto.UserId.ToString(), new UserNotificationUpdate
        {
            NotificationId = notification.Id.ToString(),
            Title = notification.Title,
            Message = notification.Message,
            Type = notification.Type,
            IsRead = notification.IsRead,
            CreatedAt = notification.CreatedAt,
            UnreadCount = unreadCount
        });
        
        return CreatedAtAction(nameof(GetNotifications), new { userId = dto.UserId }, notification);
    }

    [HttpPatch("{id}/read")]
    public async Task<ActionResult> MarkAsRead(Guid id)
    {
        var result = await _notificationService.MarkAsReadAsync(id);
        if (!result)
            return NotFound();

        return Ok(new { message = "Notification marked as read" });
    }

    [HttpPatch("user/{userId}/read-all")]
    public async Task<ActionResult> MarkAllAsRead(Guid userId)
    {
        await _notificationService.MarkAllAsReadAsync(userId);
        
        // Notify user that all notifications are now read
        await _realTimeNotification.NotifyUserAsync(userId.ToString(), new UserNotificationUpdate
        {
            NotificationId = "",
            Title = "",
            Message = "",
            Type = "AllRead",
            IsRead = true,
            CreatedAt = DateTime.UtcNow,
            UnreadCount = 0
        });
        
        return Ok(new { message = "All notifications marked as read" });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteNotification(Guid id)
    {
        var result = await _notificationService.DeleteNotificationAsync(id);
        if (!result)
            return NotFound();

        return Ok(new { message = "Notification deleted" });
    }

    // Endpoint de teste para enviar uma notificação para o usuário autenticado
    [HttpPost("test/send-to-me")]
    public async Task<ActionResult> SendTestNotificationToCurrentUser()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim))
            return Unauthorized();

        var userId = new Guid(userIdClaim);

        var notification = new CreateNotificationDto
        {
            UserId = userId,
            Title = "Teste SignalR",
            Message = "Esta é uma notificação de teste enviada via endpoint.",
            Type = "info"
        };

        // Cria notificação persistente e notifica em tempo real
        var created = await _notificationService.CreateNotificationAsync(notification);
        var unreadCount = await _notificationService.GetUnreadCountAsync(userId);
        await _realTimeNotification.NotifyUserAsync(userId.ToString(), new UserNotificationUpdate
        {
            NotificationId = created.Id.ToString(),
            Title = created.Title,
            Message = created.Message,
            Type = created.Type,
            IsRead = created.IsRead,
            CreatedAt = created.CreatedAt,
            UnreadCount = unreadCount
        });

        return Ok(new { message = "Test notification sent" });
    }
}
