using Application.DTOs.Notifications;

namespace Application.Interfaces;

public interface INotificationService
{
    Task<PaginatedNotificationsDto> GetNotificationsAsync(Guid userId, int page, int pageSize, bool? isRead);
    Task<NotificationDto> CreateNotificationAsync(CreateNotificationDto dto);
    Task<bool> MarkAsReadAsync(Guid id);
    Task<bool> MarkAllAsReadAsync(Guid userId);
    Task<int> GetUnreadCountAsync(Guid userId);
    Task<bool> DeleteNotificationAsync(Guid id);
}
