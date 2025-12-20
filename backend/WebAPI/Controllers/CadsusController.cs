using Application.DTOs.Cadsus;
using Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebAPI.Controllers;

/// <summary>
/// Controller para integração com CADSUS (Cadastro Nacional de Usuários do SUS)
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CadsusController : ControllerBase
{
    private readonly ICadsusService _cadsusService;

    public CadsusController(ICadsusService cadsusService)
    {
        _cadsusService = cadsusService;
    }

    /// <summary>
    /// Consulta dados de um cidadão no CADSUS pelo CPF
    /// </summary>
    /// <param name="request">CPF do cidadão a ser consultado</param>
    /// <returns>Dados do cidadão cadastrado no CADSUS</returns>
    [HttpPost("consultar-cpf")]
    public async Task<ActionResult<CadsusCidadaoDto>> ConsultarCpf([FromBody] CadsusConsultaRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Cpf))
            {
                return BadRequest(new { error = "CPF é obrigatório" });
            }

            var resultado = await _cadsusService.ConsultarCpfAsync(request.Cpf);
            return Ok(resultado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (FileNotFoundException ex)
        {
            return StatusCode(503, new { error = "Serviço CADSUS não configurado", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(500, new { error = "Erro ao consultar CADSUS", message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Erro interno ao consultar CADSUS", message = ex.Message });
        }
    }

    /// <summary>
    /// Obtém o status do token de autenticação do CADSUS
    /// </summary>
    [HttpGet("token/status")]
    public ActionResult<CadsusTokenStatusDto> GetTokenStatus()
    {
        try
        {
            var status = _cadsusService.GetTokenStatus();
            return Ok(status);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Erro ao verificar status do token", message = ex.Message });
        }
    }

    /// <summary>
    /// Força a renovação do token de autenticação do CADSUS
    /// </summary>
    [HttpPost("token/renew")]
    public async Task<ActionResult<CadsusTokenRenewResponseDto>> RenewToken()
    {
        try
        {
            var status = await _cadsusService.ForceTokenRenewalAsync();
            return Ok(new CadsusTokenRenewResponseDto
            {
                Success = true,
                Message = "Token renovado com sucesso",
                HasToken = status.HasToken,
                IsValid = status.IsValid,
                ExpiresAt = status.ExpiresAt,
                ExpiresIn = status.ExpiresIn
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new CadsusTokenRenewResponseDto
            {
                Success = false,
                Message = $"Erro ao renovar token: {ex.Message}"
            });
        }
    }
}
