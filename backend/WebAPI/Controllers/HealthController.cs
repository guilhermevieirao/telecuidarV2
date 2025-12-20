using Microsoft.AspNetCore.Mvc;

namespace WebAPI.Controllers;

/// <summary>
/// Controller para verificação de saúde da aplicação
/// Usado por Docker, Kubernetes, Load Balancers, etc.
/// </summary>
[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    private readonly ILogger<HealthController> _logger;

    public HealthController(ILogger<HealthController> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Endpoint básico de health check
    /// </summary>
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new 
        { 
            status = "healthy",
            timestamp = DateTime.UtcNow,
            service = "TeleCuidar API",
            version = "1.0.0"
        });
    }

    /// <summary>
    /// Health check detalhado (para debug)
    /// </summary>
    [HttpGet("detailed")]
    public IActionResult GetDetailed()
    {
        var healthInfo = new
        {
            status = "healthy",
            timestamp = DateTime.UtcNow,
            service = "TeleCuidar API",
            version = "1.0.0",
            environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Unknown",
            runtime = new
            {
                dotnetVersion = Environment.Version.ToString(),
                osDescription = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
                processArchitecture = System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture.ToString()
            },
            memory = new
            {
                workingSet = $"{Environment.WorkingSet / 1024 / 1024} MB",
                gcTotalMemory = $"{GC.GetTotalMemory(false) / 1024 / 1024} MB"
            }
        };

        return Ok(healthInfo);
    }

    /// <summary>
    /// Endpoint de liveness (está rodando?)
    /// </summary>
    [HttpGet("live")]
    public IActionResult GetLive()
    {
        return Ok(new { status = "alive" });
    }

    /// <summary>
    /// Endpoint de readiness (pronto para receber tráfego?)
    /// </summary>
    [HttpGet("ready")]
    public IActionResult GetReady()
    {
        // Aqui poderia verificar conexão com banco, serviços externos, etc.
        return Ok(new { status = "ready" });
    }
}
