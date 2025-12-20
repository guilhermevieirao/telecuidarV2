namespace Application.DTOs.Cadsus;

/// <summary>
/// DTO para requisição de consulta CPF no CADSUS
/// </summary>
public class CadsusConsultaRequestDto
{
    public string Cpf { get; set; } = string.Empty;
}

/// <summary>
/// DTO com dados do cidadão retornados pelo CADSUS
/// </summary>
public class CadsusCidadaoDto
{
    // Identificação Principal
    public string Cns { get; set; } = string.Empty;
    public string Cpf { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string DataNascimento { get; set; } = string.Empty;
    public string StatusCadastro { get; set; } = string.Empty;
    
    // Filiação
    public string NomeMae { get; set; } = string.Empty;
    public string NomePai { get; set; } = string.Empty;
    
    // Características
    public string Sexo { get; set; } = string.Empty;
    public string RacaCor { get; set; } = string.Empty;
    
    // Endereço
    public string TipoLogradouro { get; set; } = string.Empty;
    public string Logradouro { get; set; } = string.Empty;
    public string Numero { get; set; } = string.Empty;
    public string Complemento { get; set; } = string.Empty;
    public string Cidade { get; set; } = string.Empty;
    public string CodigoCidade { get; set; } = string.Empty;
    public string PaisEnderecoAtual { get; set; } = string.Empty;
    public string Cep { get; set; } = string.Empty;
    public string EnderecoCompleto { get; set; } = string.Empty;
    
    // Naturalidade
    public string CidadeNascimento { get; set; } = string.Empty;
    public string CodigoCidadeNascimento { get; set; } = string.Empty;
    public string PaisNascimento { get; set; } = string.Empty;
    public string CodigoPaisNascimento { get; set; } = string.Empty;
    
    // Contato
    public List<string> Telefones { get; set; } = new();
    public List<string> Emails { get; set; } = new();
}

/// <summary>
/// DTO para status do token CADSUS
/// </summary>
public class CadsusTokenStatusDto
{
    public bool HasToken { get; set; }
    public bool IsValid { get; set; }
    public string? ExpiresAt { get; set; }
    public string? ExpiresIn { get; set; }
    public long ExpiresInMs { get; set; }
    public string? Message { get; set; }
}

/// <summary>
/// DTO para resposta de renovação de token
/// </summary>
public class CadsusTokenRenewResponseDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool HasToken { get; set; }
    public bool IsValid { get; set; }
    public string? ExpiresAt { get; set; }
    public string? ExpiresIn { get; set; }
}
