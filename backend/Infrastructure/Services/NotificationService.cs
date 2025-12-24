using Application.DTOs.Notifications;
using Application.Interfaces;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly IEmailService _emailService;
    private readonly ILogger<NotificationService> _logger;
    private readonly string _frontendUrl;

    public NotificationService(
        ApplicationDbContext context, 
        IEmailService emailService,
        ILogger<NotificationService> logger)
    {
        _context = context;
        _emailService = emailService;
        _logger = logger;
        _frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:4200";
    }

    public async Task<PaginatedNotificationsDto> GetNotificationsAsync(Guid userId, int page, int pageSize, bool? isRead)
    {
        var query = _context.Notifications
            .Where(n => n.UserId == userId)
            .AsQueryable();

        if (isRead.HasValue)
        {
            query = query.Where(n => n.IsRead == isRead.Value);
        }

        var total = await query.CountAsync();
        var unreadCount = await _context.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);
        var totalPages = (int)Math.Ceiling(total / (double)pageSize);

        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new NotificationDto
            {
                Id = n.Id,
                UserId = n.UserId,
                Title = n.Title,
                Message = n.Message,
                Type = n.Type,
                IsRead = n.IsRead,
                Link = n.Link,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync();

        return new PaginatedNotificationsDto
        {
            Data = notifications,
            Total = total,
            UnreadCount = unreadCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };
    }

    public async Task<NotificationDto> CreateNotificationAsync(CreateNotificationDto dto)
    {
        // Busca o usuário para obter dados de e-mail
        var user = await _context.Users.FindAsync(dto.UserId);
        
        var notification = new Notification
        {
            UserId = dto.UserId,
            Title = dto.Title,
            Message = dto.Message,
            Type = dto.Type,
            Link = dto.Link,
            IsRead = false
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        // Envia e-mail automaticamente para todas as notificações
        if (user != null && !string.IsNullOrWhiteSpace(user.Email))
        {
            await SendNotificationEmailAsync(user, notification);
        }

        return new NotificationDto
        {
            Id = notification.Id,
            UserId = notification.UserId,
            Title = notification.Title,
            Message = notification.Message,
            Type = notification.Type,
            IsRead = notification.IsRead,
            Link = notification.Link,
            CreatedAt = notification.CreatedAt
        };
    }

    /// <summary>
    /// Envia o e-mail de notificação de forma assíncrona (fire and forget)
    /// O envio de e-mail não deve bloquear a criação da notificação
    /// </summary>
    private async Task SendNotificationEmailAsync(User user, Notification notification)
    {
        try
        {
            var userName = $"{user.Name} {user.LastName}".Trim();
            if (string.IsNullOrWhiteSpace(userName))
            {
                userName = user.Email;
            }

            var htmlBody = EmailTemplateService.GenerateNotificationEmailHtml(
                userName,
                notification.Title,
                notification.Message,
                notification.Type,
                notification.CreatedAt,
                notification.Link,
                _frontendUrl
            );

            var textBody = EmailTemplateService.GenerateNotificationEmailPlainText(
                userName,
                notification.Title,
                notification.Message,
                notification.Type,
                notification.CreatedAt,
                notification.Link,
                _frontendUrl
            );

            var subject = $"[TeleCuidar] {notification.Title}";

            // Envia o e-mail de forma assíncrona
            // Não esperamos pelo resultado para não bloquear a resposta
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendEmailAsync(user.Email, userName, subject, htmlBody, textBody);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Erro ao enviar e-mail de notificação para {Email}", user.Email);
                }
            });

            _logger.LogInformation("E-mail de notificação agendado para {Email}. Título: {Title}", user.Email, notification.Title);
        }
        catch (Exception ex)
        {
            // Log do erro mas não impede a criação da notificação
            _logger.LogError(ex, "Erro ao preparar e-mail de notificação para usuário {UserId}", user.Id);
        }
    }

    public async Task<bool> MarkAsReadAsync(Guid id)
    {
        var notification = await _context.Notifications.FindAsync(id);
        if (notification == null) return false;

        notification.IsRead = true;
        notification.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> MarkAllAsReadAsync(Guid userId)
    {
        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var notification in notifications)
        {
            notification.IsRead = true;
            notification.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<int> GetUnreadCountAsync(Guid userId)
    {
        return await _context.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);
    }

    public async Task<bool> DeleteNotificationAsync(Guid id)
    {
        var notification = await _context.Notifications.FindAsync(id);
        if (notification == null) return false;

        _context.Notifications.Remove(notification);
        await _context.SaveChangesAsync();

        return true;
    }
}
