using Microsoft.AspNetCore.SignalR;

namespace WebAPI.Hubs;

/// <summary>
/// SignalR Hub específico para teleconsultas em tempo real
/// Permite sincronização de dados entre paciente e profissional durante a consulta
/// </summary>
public class TeleconsultationHub : Hub
{
    private readonly ILogger<TeleconsultationHub> _logger;

    public TeleconsultationHub(ILogger<TeleconsultationHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Cliente conectado ao TeleconsultationHub: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Cliente desconectado do TeleconsultationHub: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Entra na sala da teleconsulta (appointment)
    /// </summary>
    public async Task JoinConsultation(string appointmentId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"consultation_{appointmentId}");
        _logger.LogInformation("Cliente {ConnectionId} entrou na consulta {AppointmentId}", Context.ConnectionId, appointmentId);
        
        // Notificar outros participantes
        await Clients.OthersInGroup($"consultation_{appointmentId}").SendAsync("ParticipantJoined", new
        {
            ConnectionId = Context.ConnectionId,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Sai da sala da teleconsulta
    /// </summary>
    public async Task LeaveConsultation(string appointmentId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"consultation_{appointmentId}");
        _logger.LogInformation("Cliente {ConnectionId} saiu da consulta {AppointmentId}", Context.ConnectionId, appointmentId);
        
        // Notificar outros participantes
        await Clients.OthersInGroup($"consultation_{appointmentId}").SendAsync("ParticipantLeft", new
        {
            ConnectionId = Context.ConnectionId,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Notifica que dados foram atualizados (SOAP, Anamnese, etc)
    /// </summary>
    public async Task NotifyDataUpdated(string appointmentId, string dataType, object? data = null)
    {
        await Clients.OthersInGroup($"consultation_{appointmentId}").SendAsync("DataUpdated", new
        {
            DataType = dataType,
            Data = data,
            Timestamp = DateTime.UtcNow
        });
        _logger.LogInformation("Dados {DataType} atualizados na consulta {AppointmentId}", dataType, appointmentId);
    }

    /// <summary>
    /// Notifica que um novo anexo foi adicionado
    /// </summary>
    public async Task NotifyAttachmentAdded(string appointmentId, object attachment)
    {
        await Clients.OthersInGroup($"consultation_{appointmentId}").SendAsync("AttachmentAdded", new
        {
            Attachment = attachment,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Notifica que um anexo foi removido
    /// </summary>
    public async Task NotifyAttachmentRemoved(string appointmentId, string attachmentId)
    {
        await Clients.OthersInGroup($"consultation_{appointmentId}").SendAsync("AttachmentRemoved", new
        {
            AttachmentId = attachmentId,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Notifica que a receita foi atualizada
    /// </summary>
    public async Task NotifyPrescriptionUpdated(string appointmentId, object? prescription = null)
    {
        await Clients.OthersInGroup($"consultation_{appointmentId}").SendAsync("PrescriptionUpdated", new
        {
            Prescription = prescription,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Notifica mudança de status da consulta
    /// </summary>
    public async Task NotifyStatusChanged(string appointmentId, string newStatus)
    {
        await Clients.Group($"consultation_{appointmentId}").SendAsync("StatusChanged", new
        {
            Status = newStatus,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Envia notificação de digitação (para chat)
    /// </summary>
    public async Task SendTypingIndicator(string appointmentId, bool isTyping)
    {
        await Clients.OthersInGroup($"consultation_{appointmentId}").SendAsync("TypingIndicator", new
        {
            ConnectionId = Context.ConnectionId,
            IsTyping = isTyping,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Envia uma mensagem de chat
    /// </summary>
    public async Task SendChatMessage(string appointmentId, string message, string senderRole)
    {
        await Clients.Group($"consultation_{appointmentId}").SendAsync("ChatMessage", new
        {
            Message = message,
            SenderRole = senderRole,
            ConnectionId = Context.ConnectionId,
            Timestamp = DateTime.UtcNow
        });
    }
}
