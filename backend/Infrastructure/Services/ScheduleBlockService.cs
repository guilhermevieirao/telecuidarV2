using Application.DTOs.ScheduleBlocks;
using Application.DTOs.Notifications;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services;

public class ScheduleBlockService : IScheduleBlockService
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notificationService;

    public ScheduleBlockService(ApplicationDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<(IEnumerable<ScheduleBlockDto> Data, int Total)> GetScheduleBlocksAsync(
        Guid? professionalId = null,
        ScheduleBlockStatus? status = null,
        int page = 1,
        int pageSize = 10)
    {
        var query = _context.ScheduleBlocks
            .Include(sb => sb.Professional)
            .Include(sb => sb.Approver)
            .AsQueryable();

        if (professionalId.HasValue)
        {
            query = query.Where(sb => sb.ProfessionalId == professionalId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(sb => sb.Status == status.Value);
        }

        // Auto-update expired blocks
        var today = DateTime.UtcNow.Date;
        var expiredBlocks = await query
            .Where(sb => sb.Status == ScheduleBlockStatus.Approved &&
                        ((sb.Type == ScheduleBlockType.Single && sb.Date < today) ||
                         (sb.Type == ScheduleBlockType.Range && sb.EndDate < today)))
            .ToListAsync();

        foreach (var block in expiredBlocks)
        {
            block.Status = ScheduleBlockStatus.Expired;
        }

        if (expiredBlocks.Any())
        {
            await _context.SaveChangesAsync();
        }

        var total = await query.CountAsync();

        var blocks = await query
            .OrderByDescending(sb => sb.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(sb => new ScheduleBlockDto
            {
                Id = sb.Id,
                ProfessionalId = sb.ProfessionalId,
                ProfessionalName = sb.Professional.Name + " " + sb.Professional.LastName,
                Type = sb.Type,
                Date = sb.Date,
                StartDate = sb.StartDate,
                EndDate = sb.EndDate,
                Reason = sb.Reason,
                Status = sb.Status,
                ApprovedBy = sb.ApprovedBy,
                ApprovedByName = sb.Approver != null ? sb.Approver.Name + " " + sb.Approver.LastName : null,
                ApprovedAt = sb.ApprovedAt,
                RejectionReason = sb.RejectionReason,
                CreatedAt = sb.CreatedAt,
                UpdatedAt = sb.UpdatedAt
            })
            .ToListAsync();

        return (blocks, total);
    }

    public async Task<ScheduleBlockDto?> GetScheduleBlockByIdAsync(Guid id)
    {
        var block = await _context.ScheduleBlocks
            .Include(sb => sb.Professional)
            .Include(sb => sb.Approver)
            .FirstOrDefaultAsync(sb => sb.Id == id);

        if (block == null) return null;

        return new ScheduleBlockDto
        {
            Id = block.Id,
            ProfessionalId = block.ProfessionalId,
            ProfessionalName = block.Professional.Name + " " + block.Professional.LastName,
            Type = block.Type,
            Date = block.Date,
            StartDate = block.StartDate,
            EndDate = block.EndDate,
            Reason = block.Reason,
            Status = block.Status,
            ApprovedBy = block.ApprovedBy,
            ApprovedByName = block.Approver != null ? block.Approver.Name + " " + block.Approver.LastName : null,
            ApprovedAt = block.ApprovedAt,
            RejectionReason = block.RejectionReason,
            CreatedAt = block.CreatedAt,
            UpdatedAt = block.UpdatedAt
        };
    }

    public async Task<ScheduleBlockDto> CreateScheduleBlockAsync(CreateScheduleBlockDto dto)
    {
        // Validate dates
        if (dto.Type == ScheduleBlockType.Single && !dto.Date.HasValue)
        {
            throw new ArgumentException("Date is required for single day blocks");
        }

        if (dto.Type == ScheduleBlockType.Range && (!dto.StartDate.HasValue || !dto.EndDate.HasValue))
        {
            throw new ArgumentException("Start date and end date are required for range blocks");
        }

        if (dto.Type == ScheduleBlockType.Range && dto.StartDate >= dto.EndDate)
        {
            throw new ArgumentException("End date must be after start date");
        }

        // Check for conflicts
        var hasConflict = await CheckScheduleBlockConflictAsync(
            dto.ProfessionalId, 
            dto.Date, 
            dto.StartDate, 
            dto.EndDate);

        if (hasConflict)
        {
            throw new InvalidOperationException("There is already a block for this period");
        }

        var block = new ScheduleBlock
        {
            ProfessionalId = dto.ProfessionalId,
            Type = dto.Type,
            Date = dto.Date,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            Reason = dto.Reason,
            Status = ScheduleBlockStatus.Pending
        };

        _context.ScheduleBlocks.Add(block);
        await _context.SaveChangesAsync();
        
        // Notificar todos os admins sobre nova solicitação de bloqueio
        try
        {
            var professional = await _context.Users.FindAsync(dto.ProfessionalId);
            var admins = await _context.Users.Where(u => u.Role == UserRole.ADMIN).ToListAsync();
            
            foreach (var admin in admins)
            {
                await _notificationService.CreateNotificationAsync(new CreateNotificationDto
                {
                    UserId = admin.Id,
                    Title = "Nova Solicitação de Bloqueio",
                    Message = $"{professional?.Name} {professional?.LastName} solicitou um bloqueio de agenda.",
                    Type = "Info"
                });
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Erro ao criar notificação de bloqueio: {ex.Message}");
        }

        return (await GetScheduleBlockByIdAsync(block.Id))!;
    }

    public async Task<ScheduleBlockDto?> UpdateScheduleBlockAsync(Guid id, UpdateScheduleBlockDto dto)
    {
        var block = await _context.ScheduleBlocks.FindAsync(id);
        if (block == null) return null;

        if (block.Status != ScheduleBlockStatus.Pending)
        {
            throw new InvalidOperationException("Only pending blocks can be updated");
        }

        if (dto.Type.HasValue)
        {
            block.Type = dto.Type.Value;
        }

        if (dto.Date.HasValue)
        {
            block.Date = dto.Date.Value;
        }

        if (dto.StartDate.HasValue)
        {
            block.StartDate = dto.StartDate.Value;
        }

        if (dto.EndDate.HasValue)
        {
            block.EndDate = dto.EndDate.Value;
        }

        if (!string.IsNullOrEmpty(dto.Reason))
        {
            block.Reason = dto.Reason;
        }

        // Validate dates
        if (block.Type == ScheduleBlockType.Single && !block.Date.HasValue)
        {
            throw new ArgumentException("Date is required for single day blocks");
        }

        if (block.Type == ScheduleBlockType.Range && (!block.StartDate.HasValue || !block.EndDate.HasValue))
        {
            throw new ArgumentException("Start date and end date are required for range blocks");
        }

        if (block.Type == ScheduleBlockType.Range && block.StartDate >= block.EndDate)
        {
            throw new ArgumentException("End date must be after start date");
        }

        // Check for conflicts
        var hasConflict = await CheckScheduleBlockConflictAsync(
            block.ProfessionalId, 
            block.Date, 
            block.StartDate, 
            block.EndDate, 
            id);

        if (hasConflict)
        {
            throw new InvalidOperationException("There is already a block for this period");
        }

        await _context.SaveChangesAsync();

        return await GetScheduleBlockByIdAsync(id);
    }

    public async Task<bool> DeleteScheduleBlockAsync(Guid id)
    {
        var block = await _context.ScheduleBlocks
            .Include(sb => sb.Professional)
            .FirstOrDefaultAsync(sb => sb.Id == id);
        if (block == null) return false;

        if (block.Status != ScheduleBlockStatus.Pending)
        {
            throw new InvalidOperationException("Only pending blocks can be deleted");
        }

        _context.ScheduleBlocks.Remove(block);
        await _context.SaveChangesAsync();
        
        // Notificar todos os admins sobre cancelamento
        try
        {
            var admins = await _context.Users.Where(u => u.Role == UserRole.ADMIN).ToListAsync();
            
            foreach (var admin in admins)
            {
                await _notificationService.CreateNotificationAsync(new CreateNotificationDto
                {
                    UserId = admin.Id,
                    Title = "Solicitação de Bloqueio Cancelada",
                    Message = $"{block.Professional.Name} {block.Professional.LastName} cancelou uma solicitação de bloqueio de agenda.",
                    Type = "Warning"
                });
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Erro ao criar notificação de cancelamento de bloqueio: {ex.Message}");
        }

        return true;
    }

    public async Task<ScheduleBlockDto?> ApproveScheduleBlockAsync(Guid id, ApproveScheduleBlockDto dto)
    {
        var block = await _context.ScheduleBlocks.FindAsync(id);
        if (block == null) return null;

        if (block.Status != ScheduleBlockStatus.Pending)
        {
            throw new InvalidOperationException("Only pending blocks can be approved");
        }

        block.Status = ScheduleBlockStatus.Approved;
        block.ApprovedBy = dto.ApprovedBy;
        block.ApprovedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return await GetScheduleBlockByIdAsync(id);
    }

    public async Task<ScheduleBlockDto?> RejectScheduleBlockAsync(Guid id, RejectScheduleBlockDto dto)
    {
        var block = await _context.ScheduleBlocks.FindAsync(id);
        if (block == null) return null;

        if (block.Status != ScheduleBlockStatus.Pending)
        {
            throw new InvalidOperationException("Only pending blocks can be rejected");
        }

        block.Status = ScheduleBlockStatus.Rejected;
        block.ApprovedBy = dto.RejectedBy;
        block.ApprovedAt = DateTime.UtcNow;
        block.RejectionReason = dto.RejectionReason;

        await _context.SaveChangesAsync();

        return await GetScheduleBlockByIdAsync(id);
    }

    public async Task<bool> CheckScheduleBlockConflictAsync(
        Guid professionalId, 
        DateTime? date, 
        DateTime? startDate, 
        DateTime? endDate, 
        Guid? excludeBlockId = null)
    {
        var query = _context.ScheduleBlocks
            .Where(sb => sb.ProfessionalId == professionalId &&
                        (sb.Status == ScheduleBlockStatus.Pending || sb.Status == ScheduleBlockStatus.Approved));

        if (excludeBlockId.HasValue)
        {
            query = query.Where(sb => sb.Id != excludeBlockId.Value);
        }

        if (date.HasValue)
        {
            // Check if single date conflicts with any existing block
            return await query.AnyAsync(sb =>
                (sb.Type == ScheduleBlockType.Single && sb.Date == date.Value) ||
                (sb.Type == ScheduleBlockType.Range && sb.StartDate <= date.Value && sb.EndDate >= date.Value));
        }
        else if (startDate.HasValue && endDate.HasValue)
        {
            // Check if date range conflicts with any existing block
            return await query.AnyAsync(sb =>
                (sb.Type == ScheduleBlockType.Single && sb.Date >= startDate.Value && sb.Date <= endDate.Value) ||
                (sb.Type == ScheduleBlockType.Range && 
                    ((sb.StartDate <= endDate.Value && sb.EndDate >= startDate.Value))));
        }

        return false;
    }
}
