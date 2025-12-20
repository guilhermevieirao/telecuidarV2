using Application.DTOs.Cadsus;

namespace Application.Interfaces;

/// <summary>
/// Interface para serviço de integração com CADSUS
/// </summary>
public interface ICadsusService
{
    /// <summary>
    /// Consulta dados de um cidadão no CADSUS pelo CPF
    /// </summary>
    Task<CadsusCidadaoDto> ConsultarCpfAsync(string cpf);
    
    /// <summary>
    /// Obtém o status do token de autenticação
    /// </summary>
    CadsusTokenStatusDto GetTokenStatus();
    
    /// <summary>
    /// Força a renovação do token de autenticação
    /// </summary>
    Task<CadsusTokenStatusDto> ForceTokenRenewalAsync();
}
