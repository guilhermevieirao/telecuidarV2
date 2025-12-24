using Application.DTOs.Appointments;

namespace Application.Interfaces;

public interface IAppointmentService
{
    Task<PaginatedAppointmentsDto> GetAppointmentsAsync(int page, int pageSize, string? search, string? status, DateTime? startDate, DateTime? endDate, Guid? patientId = null, Guid? professionalId = null);
    Task<AppointmentDto?> GetAppointmentByIdAsync(Guid id);
    Task<AppointmentDto> CreateAppointmentAsync(CreateAppointmentDto dto);
    Task<AppointmentDto?> UpdateAppointmentAsync(Guid id, UpdateAppointmentDto dto);
    Task<bool> CancelAppointmentAsync(Guid id);
    Task<bool> FinishAppointmentAsync(Guid id);
}
