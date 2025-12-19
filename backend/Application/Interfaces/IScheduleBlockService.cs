using Application.DTOs.ScheduleBlocks;
using Domain.Entities;

namespace Application.Interfaces;

public interface IScheduleBlockService
{
    Task<(IEnumerable<ScheduleBlockDto> Data, int Total)> GetScheduleBlocksAsync(
        Guid? professionalId = null,
        ScheduleBlockStatus? status = null,
        int page = 1,
        int pageSize = 10);
    
    Task<ScheduleBlockDto?> GetScheduleBlockByIdAsync(Guid id);
    
    Task<ScheduleBlockDto> CreateScheduleBlockAsync(CreateScheduleBlockDto dto);
    
    Task<ScheduleBlockDto?> UpdateScheduleBlockAsync(Guid id, UpdateScheduleBlockDto dto);
    
    Task<bool> DeleteScheduleBlockAsync(Guid id);
    
    Task<ScheduleBlockDto?> ApproveScheduleBlockAsync(Guid id, ApproveScheduleBlockDto dto);
    
    Task<ScheduleBlockDto?> RejectScheduleBlockAsync(Guid id, RejectScheduleBlockDto dto);
    
    Task<bool> CheckScheduleBlockConflictAsync(Guid professionalId, DateTime? date, DateTime? startDate, DateTime? endDate, Guid? excludeBlockId = null);
}
