using System.Diagnostics;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Xml;
using Application.DTOs.Cadsus;
using Application.Interfaces;

namespace Infrastructure.Services;

/// <summary>
/// Serviço de integração com o CADSUS (Cadastro Nacional de Usuários do SUS)
/// Implementa autenticação via certificado digital A1 e consulta de dados de cidadãos
/// </summary>
public class CadsusService : ICadsusService
{
    private string? _token;
    private DateTime? _tokenExpiry;
    private readonly object _tokenLock = new();
    
    // Configurações
    private readonly string? _certPath;
    private readonly string? _certPassword;
    private readonly string _authUrl;
    private readonly string _queryUrl;
    private readonly bool _isProduction;
    
    // URLs do CADSUS
    private const string AUTH_URL_HMG = "https://ehr-auth-hmg.saude.gov.br/api/osb/token";
    private const string AUTH_URL_PROD = "https://ehr-auth.saude.gov.br/api/osb/token";
    private const string QUERY_URL_HMG = "https://servicoshm.saude.gov.br/cadsus/v2/PDQSupplierJWT";
    private const string QUERY_URL_PROD = "https://servicos.saude.gov.br/cadsus/v2/PDQSupplierJWT";
    
    // Mapas de códigos
    private static readonly Dictionary<string, string> RacaMap = new()
    {
        { "01", "Branca" },
        { "02", "Preta" },
        { "03", "Parda" },
        { "04", "Amarela" },
        { "05", "Indígena" },
        { "99", "Sem informação" }
    };
    
    private static readonly Dictionary<string, string> PaisMap = new()
    {
        { "010", "Brasil" }, { "020", "Argentina" }, { "023", "Bolívia" }, { "031", "Chile" },
        { "035", "Colômbia" }, { "039", "Equador" }, { "045", "Guiana Francesa" }, { "047", "Guiana" },
        { "053", "Paraguai" }, { "055", "Peru" }, { "063", "Suriname" }, { "067", "Uruguai" },
        { "071", "Venezuela" }, { "077", "Antígua e Barbuda" }, { "081", "Bahamas" }, { "085", "Barbados" },
        { "088", "Belize" }, { "090", "Bermudas" }, { "093", "Canadá" }, { "097", "Costa Rica" },
        { "098", "Cuba" }, { "101", "Dominica" }, { "109", "El Salvador" }, { "110", "Estados Unidos" },
        { "114", "Granada" }, { "118", "Groelândia" }, { "121", "Guadalupe" }, { "124", "Guatemala" },
        { "127", "Haiti" }, { "130", "Honduras" }, { "133", "Ilhas Cayman" }, { "136", "Ilhas Malvinas" },
        { "137", "Ilhas Virgens Americanas" }, { "138", "Ilhas Virgens Britânicas" }, { "140", "Jamaica" },
        { "143", "Martinica" }, { "145", "México" }, { "147", "Montserrat" }, { "149", "Nicarágua" },
        { "152", "Panamá" }, { "155", "Porto Rico" }, { "160", "República Dominicana" }, { "163", "Santa Lúcia" },
        { "166", "São Vicente e Granadinas" }, { "169", "Trinidad e Tobago" }, { "190", "Alemanha" },
        { "193", "Áustria" }, { "195", "Bélgica" }, { "198", "Bulgária" }, { "201", "Dinamarca" },
        { "203", "Eslováquia" }, { "204", "Eslovênia" }, { "205", "Espanha" }, { "207", "Finlândia" },
        { "208", "França" }, { "210", "Grécia" }, { "213", "Hungria" }, { "215", "Irlanda" },
        { "217", "Islândia" }, { "218", "Itália" }, { "221", "Letônia" }, { "224", "Lituânia" },
        { "225", "Luxemburgo" }, { "229", "Malta" }, { "232", "Noruega" }, { "235", "Países Baixos" },
        { "238", "Polônia" }, { "239", "Portugal" }, { "240", "Reino Unido" }, { "243", "República Tcheca" },
        { "245", "Romênia" }, { "246", "Rússia" }, { "248", "Suécia" }, { "250", "Suíça" },
        { "253", "Ucrânia" }, { "255", "Croácia" }, { "256", "Bósnia-Herzegovina" }, { "259", "Macedônia do Norte" },
        { "267", "Albânia" }, { "275", "Angola" }, { "281", "Cabo Verde" }, { "289", "Egito" },
        { "291", "Etiópia" }, { "297", "Gana" }, { "299", "Guiné" }, { "310", "Marrocos" },
        { "313", "Moçambique" }, { "318", "Nigéria" }, { "323", "Quênia" }, { "334", "África do Sul" },
        { "337", "Tunísia" }, { "341", "Zimbábue" }, { "351", "Arábia Saudita" }, { "355", "China" },
        { "358", "Coreia do Norte" }, { "361", "Coreia do Sul" }, { "363", "Emirados Árabes Unidos" },
        { "370", "Filipinas" }, { "373", "Índia" }, { "376", "Indonésia" }, { "379", "Iraque" },
        { "381", "Irã" }, { "382", "Israel" }, { "385", "Japão" }, { "391", "Líbano" },
        { "394", "Malásia" }, { "397", "Paquistão" }, { "400", "Palestina" }, { "404", "Singapura" },
        { "407", "Síria" }, { "410", "Tailândia" }, { "413", "Turquia" }, { "416", "Vietnã" },
        { "419", "Austrália" }, { "425", "Nova Zelândia" }
    };
    
    private static readonly Dictionary<string, string> TiposLogradouro = new()
    {
        { "001", "Rua" }, { "002", "Avenida" }, { "003", "Travessa" }, { "004", "Alameda" },
        { "005", "Praça" }, { "006", "Largo" }, { "007", "Rodovia" }, { "008", "Estrada" },
        { "081", "Rua" }
    };
    
    public CadsusService()
    {
        // Carregar configurações das variáveis de ambiente
        _certPath = Environment.GetEnvironmentVariable("CADSUS_CERT_PATH");
        _certPassword = Environment.GetEnvironmentVariable("CADSUS_CERT_PASSWORD");
        _isProduction = Environment.GetEnvironmentVariable("CADSUS_AMBIENTE")?.ToLower() == "producao";
        
        _authUrl = _isProduction ? AUTH_URL_PROD : AUTH_URL_HMG;
        _queryUrl = _isProduction ? QUERY_URL_PROD : QUERY_URL_HMG;
        
        Console.WriteLine($"🏥 CADSUS Service initialized - Ambiente: {(_isProduction ? "Produção" : "Homologação")}");
        if (!string.IsNullOrEmpty(_certPath))
        {
            Console.WriteLine($"📜 Certificado: {_certPath}");
        }
    }
    
    /// <summary>
    /// Obtém ou renova o token de autenticação usando certificado digital
    /// </summary>
    private async Task<string> GetTokenAsync()
    {
        // Verificar se token ainda é válido (com buffer de 5 minutos)
        lock (_tokenLock)
        {
            if (_token != null && _tokenExpiry.HasValue && DateTime.UtcNow < _tokenExpiry.Value.AddMinutes(-5))
            {
                Console.WriteLine("✅ Usando token em cache");
                return _token;
            }
        }
        
        if (string.IsNullOrEmpty(_certPath) || string.IsNullOrEmpty(_certPassword))
        {
            throw new InvalidOperationException("Certificado CADSUS não configurado. Configure CADSUS_CERT_PATH e CADSUS_CERT_PASSWORD.");
        }
        
        if (!File.Exists(_certPath))
        {
            throw new FileNotFoundException($"Arquivo de certificado não encontrado: {_certPath}");
        }
        
        Console.WriteLine("🔑 Obtendo novo token via PowerShell...");
        Console.WriteLine($"📜 URL: {_authUrl}");
        
        try
        {
            // Usar PowerShell para fazer requisição com certificado
            var psCommand = $"$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('{_certPath}', '{_certPassword}'); $response = Invoke-WebRequest -Uri '{_authUrl}' -Certificate $cert -UseBasicParsing; $response.Content";
            
            var output = await ExecutePowerShellAsync(psCommand, 30000);
            
            var jsonResponse = JsonSerializer.Deserialize<JsonElement>(output.Trim());
            
            if (!jsonResponse.TryGetProperty("access_token", out var accessTokenElement))
            {
                throw new InvalidOperationException("Resposta não contém access_token");
            }
            
            var newToken = accessTokenElement.GetString() ?? throw new InvalidOperationException("access_token é nulo");
            var newExpiry = DateTime.UtcNow.AddMinutes(30); // Tokens expiram em 30 minutos
            
            lock (_tokenLock)
            {
                _token = newToken;
                _tokenExpiry = newExpiry;
            }
            
            Console.WriteLine("✅ Token obtido com sucesso");
            Console.WriteLine($"⏰ Token expira em: {_tokenExpiry?.ToLocalTime():dd/MM/yyyy HH:mm:ss}");
            
            return newToken;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Erro ao obter token: {ex.Message}");
            throw new InvalidOperationException($"Falha ao obter token de autenticação: {ex.Message}", ex);
        }
    }
    
    /// <summary>
    /// Consulta dados de um cidadão no CADSUS pelo CPF
    /// </summary>
    public async Task<CadsusCidadaoDto> ConsultarCpfAsync(string cpf)
    {
        var token = await GetTokenAsync();
        
        // Limpar CPF (remover formatação)
        var cleanCpf = new string(cpf.Where(char.IsDigit).ToArray());
        
        if (cleanCpf.Length != 11)
        {
            throw new ArgumentException("CPF inválido. Deve conter 11 dígitos.");
        }
        
        var soapRequest = BuildSoapRequest(cleanCpf);
        
        Console.WriteLine($"🔍 Consultando CADSUS para CPF: {cleanCpf.Substring(0, 3)}***{cleanCpf.Substring(9)}");
        
        try
        {
            // Salvar requisição SOAP em arquivo temporário
            var tempSoapFile = Path.Combine(Path.GetTempPath(), $"cadsus_soap_{DateTime.Now.Ticks}.xml");
            await File.WriteAllTextAsync(tempSoapFile, soapRequest, Encoding.UTF8);
            
            // Criar script PowerShell para a requisição
            var psScript = $@"
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('{_certPath}', '{_certPassword}')
$headers = @{{
  'Content-Type' = 'application/soap+xml; charset=utf-8'
  'Authorization' = 'jwt {token}'
}}
$body = Get-Content -Path '{tempSoapFile}' -Raw -Encoding UTF8

try {{
  $response = Invoke-WebRequest -Uri '{_queryUrl}' -Method POST -Headers $headers -Body $body -Certificate $cert -UseBasicParsing
  Write-Output $response.Content
}} catch {{
  $errorDetails = @{{
    StatusCode = $_.Exception.Response.StatusCode.value__
    StatusDescription = $_.Exception.Response.StatusDescription
    ErrorMessage = $_.Exception.Message
  }}
  Write-Output ($errorDetails | ConvertTo-Json -Compress)
  exit 1
}}
";
            
            var tempPsFile = Path.Combine(Path.GetTempPath(), $"cadsus_ps_{DateTime.Now.Ticks}.ps1");
            await File.WriteAllTextAsync(tempPsFile, psScript, Encoding.UTF8);
            
            Console.WriteLine("📡 Executando requisição SOAP...");
            
            string output;
            try
            {
                output = await ExecutePowerShellFileAsync(tempPsFile, 30000);
            }
            finally
            {
                // Limpar arquivos temporários
                try { File.Delete(tempSoapFile); } catch { }
                try { File.Delete(tempPsFile); } catch { }
            }
            
            Console.WriteLine("✅ Resposta SOAP recebida");
            
            return await ParseSoapResponseAsync(output);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Erro ao consultar CADSUS: {ex.Message}");
            throw new InvalidOperationException($"Falha ao consultar CADSUS: {ex.Message}", ex);
        }
    }
    
    /// <summary>
    /// Obtém o status do token de autenticação
    /// </summary>
    public CadsusTokenStatusDto GetTokenStatus()
    {
        lock (_tokenLock)
        {
            if (_token == null || !_tokenExpiry.HasValue)
            {
                return new CadsusTokenStatusDto
                {
                    HasToken = false,
                    IsValid = false,
                    Message = "Nenhum token disponível"
                };
            }
            
            var now = DateTime.UtcNow;
            var isValid = now < _tokenExpiry.Value;
            var expiresIn = _tokenExpiry.Value - now;
            var expiresInMinutes = Math.Max(0, (int)expiresIn.TotalMinutes);
            
            return new CadsusTokenStatusDto
            {
                HasToken = true,
                IsValid = isValid,
                ExpiresAt = _tokenExpiry.Value.ToLocalTime().ToString("dd/MM/yyyy HH:mm:ss"),
                ExpiresIn = $"{expiresInMinutes} minutos",
                ExpiresInMs = Math.Max(0, (long)expiresIn.TotalMilliseconds)
            };
        }
    }
    
    /// <summary>
    /// Força a renovação do token de autenticação
    /// </summary>
    public async Task<CadsusTokenStatusDto> ForceTokenRenewalAsync()
    {
        Console.WriteLine("🔄 Forçando renovação do token...");
        
        lock (_tokenLock)
        {
            _token = null;
            _tokenExpiry = null;
        }
        
        await GetTokenAsync();
        return GetTokenStatus();
    }
    
    /// <summary>
    /// Constrói o envelope SOAP para consulta de CPF
    /// </summary>
    private static string BuildSoapRequest(string cpf)
    {
        return $@"<soap:Envelope xmlns:soap=""http://www.w3.org/2003/05/soap-envelope"" xmlns:urn=""urn:ihe:iti:xds-b:2007"" xmlns:urn1=""urn:oasis:names:tc:ebxml-regrep:xsd:lcm:3.0"" xmlns:urn2=""urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0"" xmlns:urn3=""urn:ihe:iti:xds-b:2007"">
  <soap:Body>
    <PRPA_IN201305UV02 xsi:schemaLocation=""urn:hl7-org:v3 ./schema/HL7V3/NE2008/multicacheschemas/PRPA_IN201305UV02.xsd"" ITSVersion=""XML_1.0"" xmlns:xsi=""http://www.w3.org/2001/XMLSchema-instance"" xmlns=""urn:hl7-org:v3"">
      <id root=""2.16.840.1.113883.4.714"" extension=""123456""/>
      <creationTime value=""{DateTime.Now:yyyyMMddHHmmss}""/>
      <interactionId root=""2.16.840.1.113883.1.6"" extension=""PRPA_IN201305UV02""/>
      <processingCode code=""T""/>
      <processingModeCode code=""T""/>
      <acceptAckCode code=""AL""/>
      <receiver typeCode=""RCV"">
        <device classCode=""DEV"" determinerCode=""INSTANCE"">
          <id root=""2.16.840.1.113883.3.72.6.5.100.85""/>
        </device>
      </receiver>
      <sender typeCode=""SND"">
        <device classCode=""DEV"" determinerCode=""INSTANCE"">
          <id root=""2.16.840.1.113883.3.72.6.2""/>
          <name>TELECUIDAR</name>
        </device>
      </sender>
      <controlActProcess classCode=""CACT"" moodCode=""EVN"">
        <code code=""PRPA_TE201305UV02"" codeSystem=""2.16.840.1.113883.1.6""/>
        <queryByParameter>
          <queryId root=""1.2.840.114350.1.13.28.1.18.5.999"" extension=""{DateTime.Now.Ticks}""/>
          <statusCode code=""new""/>
          <responseModalityCode code=""R""/>
          <responsePriorityCode code=""I""/>
          <parameterList>
            <livingSubjectId>
              <value root=""2.16.840.1.113883.13.237"" extension=""{cpf}""/>
              <semanticsText>LivingSubject.id</semanticsText>
            </livingSubjectId>
          </parameterList>
        </queryByParameter>
      </controlActProcess>
    </PRPA_IN201305UV02>
  </soap:Body>
</soap:Envelope>";
    }
    
    /// <summary>
    /// Parseia a resposta SOAP do CADSUS
    /// </summary>
    private async Task<CadsusCidadaoDto> ParseSoapResponseAsync(string xml)
    {
        var doc = new XmlDocument();
        doc.LoadXml(xml);
        
        var nsmgr = new XmlNamespaceManager(doc.NameTable);
        nsmgr.AddNamespace("hl7", "urn:hl7-org:v3");
        nsmgr.AddNamespace("soap", "http://www.w3.org/2003/05/soap-envelope");
        
        var result = new CadsusCidadaoDto();
        
        // Extrair CPF
        var cpfNode = doc.SelectSingleNode("//hl7:id[@root='2.16.840.1.113883.13.237']/@extension", nsmgr)
                     ?? doc.SelectSingleNode("//hl7:id[@root='2.16.840.1.113883.3.4594.100.4']/@extension", nsmgr);
        if (cpfNode != null)
        {
            var cpfRaw = cpfNode.Value ?? "";
            result.Cpf = cpfRaw.Length == 11 
                ? $"{cpfRaw.Substring(0, 3)}.{cpfRaw.Substring(3, 3)}.{cpfRaw.Substring(6, 3)}-{cpfRaw.Substring(9)}"
                : cpfRaw;
        }
        
        // Extrair CNS (pode ter múltiplos)
        var cnsList = new List<string>();
        var asOtherIdsNodes = doc.SelectNodes("//hl7:asOtherIDs", nsmgr);
        if (asOtherIdsNodes != null)
        {
            foreach (XmlNode node in asOtherIdsNodes)
            {
                var cnsId = node.SelectSingleNode("hl7:id[@root='2.16.840.1.113883.13.236']/@extension", nsmgr);
                var cnsType = node.SelectSingleNode("hl7:id[@root='2.16.840.1.113883.13.236.1']/@extension", nsmgr);
                
                if (cnsId != null)
                {
                    var cnsNumber = cnsId.Value ?? "";
                    var typeLabel = cnsType?.Value switch
                    {
                        "P" => " (Principal)",
                        "D" => " (Definitivo)",
                        _ => cnsType?.Value != null ? $" ({cnsType.Value})" : ""
                    };
                    cnsList.Add(cnsNumber + typeLabel);
                }
            }
        }
        result.Cns = string.Join(", ", cnsList);
        
        // Extrair Nome
        var nameNode = doc.SelectSingleNode("//hl7:name[@use='L']/hl7:given/text()", nsmgr);
        result.Nome = nameNode?.Value?.Trim() ?? "";
        
        // Extrair Data de Nascimento
        var birthTimeNode = doc.SelectSingleNode("//hl7:birthTime/@value", nsmgr);
        if (birthTimeNode != null)
        {
            var rawDate = birthTimeNode.Value ?? "";
            if (rawDate.Length >= 8)
            {
                result.DataNascimento = $"{rawDate.Substring(6, 2)}/{rawDate.Substring(4, 2)}/{rawDate.Substring(0, 4)}";
            }
        }
        
        // Extrair Sexo
        var genderNode = doc.SelectSingleNode("//hl7:administrativeGenderCode/@code", nsmgr);
        if (genderNode != null)
        {
            result.Sexo = genderNode.Value switch
            {
                "M" => "Masculino",
                "F" => "Feminino",
                _ => genderNode.Value ?? ""
            };
        }
        
        // Extrair Raça/Cor
        var raceNode = doc.SelectSingleNode("//hl7:raceCode/@code", nsmgr);
        if (raceNode != null)
        {
            result.RacaCor = RacaMap.GetValueOrDefault(raceNode.Value ?? "", raceNode.Value ?? "");
        }
        
        // Extrair Filiação (pais)
        var relationNodes = doc.SelectNodes("//hl7:personalRelationship", nsmgr);
        if (relationNodes != null)
        {
            foreach (XmlNode node in relationNodes)
            {
                var codeNode = node.SelectSingleNode("hl7:code/@code", nsmgr);
                var givenNode = node.SelectSingleNode("hl7:relationshipHolder1/hl7:name/hl7:given/text()", nsmgr);
                
                if (codeNode != null && givenNode != null)
                {
                    var code = codeNode.Value;
                    var name = givenNode.Value?.Trim() ?? "";
                    
                    if (code == "PRN") result.NomeMae = name;
                    else if (code == "NPRN") result.NomePai = name;
                }
            }
        }
        
        // Extrair Endereço (addr com use='H')
        var addrNode = doc.SelectSingleNode("//hl7:addr[@use='H']", nsmgr);
        if (addrNode != null)
        {
            var streetNameType = addrNode.SelectSingleNode("hl7:streetNameType/text()", nsmgr)?.Value?.Trim() ?? "";
            result.TipoLogradouro = TiposLogradouro.GetValueOrDefault(streetNameType, streetNameType);
            
            result.Logradouro = addrNode.SelectSingleNode("hl7:streetName/text()", nsmgr)?.Value?.Trim() ?? "";
            result.Numero = addrNode.SelectSingleNode("hl7:houseNumber/text()", nsmgr)?.Value?.Trim() ?? "";
            result.Complemento = addrNode.SelectSingleNode("hl7:additionalLocator/text()", nsmgr)?.Value?.Trim() ?? "";
            
            var cityCode = addrNode.SelectSingleNode("hl7:city/text()", nsmgr)?.Value?.Trim() ?? "";
            result.CodigoCidade = cityCode;
            result.Cidade = await GetCityNameAsync(cityCode);
            
            var cepRaw = addrNode.SelectSingleNode("hl7:postalCode/text()", nsmgr)?.Value?.Trim() ?? "";
            result.Cep = cepRaw.Length == 8 ? $"{cepRaw.Substring(0, 5)}-{cepRaw.Substring(5)}" : cepRaw;
            
            var countryCode = addrNode.SelectSingleNode("hl7:country/text()", nsmgr)?.Value?.Trim() ?? "";
            result.PaisEnderecoAtual = PaisMap.GetValueOrDefault(countryCode, countryCode);
        }
        
        // Construir endereço completo
        var addressParts = new List<string> { result.TipoLogradouro, result.Logradouro, result.Numero, result.Complemento, result.Cidade, result.Cep };
        result.EnderecoCompleto = string.Join(", ", addressParts.Where(p => !string.IsNullOrWhiteSpace(p)));
        
        // Extrair Local de Nascimento
        var birthPlaceAddr = doc.SelectSingleNode("//hl7:birthPlace/hl7:addr", nsmgr);
        if (birthPlaceAddr != null)
        {
            var birthCityCode = birthPlaceAddr.SelectSingleNode("hl7:city/text()", nsmgr)?.Value?.Trim() ?? "";
            result.CodigoCidadeNascimento = birthCityCode;
            result.CidadeNascimento = await GetCityNameAsync(birthCityCode);
            
            var birthCountryCode = birthPlaceAddr.SelectSingleNode("hl7:country/text()", nsmgr)?.Value?.Trim() ?? "";
            result.CodigoPaisNascimento = birthCountryCode;
            result.PaisNascimento = PaisMap.GetValueOrDefault(birthCountryCode, birthCountryCode);
        }
        
        // Extrair Telefones e E-mails
        var telecomNodes = doc.SelectNodes("//hl7:telecom/@value", nsmgr);
        if (telecomNodes != null)
        {
            foreach (XmlNode node in telecomNodes)
            {
                var value = node.Value ?? "";
                if (value.StartsWith("+") || value.StartsWith("tel:"))
                {
                    var phone = FormatPhone(value.Replace("tel:", ""));
                    if (!string.IsNullOrEmpty(phone))
                        result.Telefones.Add(phone);
                }
                else if (value.Contains("@") || value.StartsWith("mailto:"))
                {
                    result.Emails.Add(value.Replace("mailto:", ""));
                }
            }
        }
        
        // Extrair Status
        var statusNode = doc.SelectSingleNode("//hl7:patient/hl7:statusCode/@code", nsmgr);
        if (statusNode != null)
        {
            result.StatusCadastro = statusNode.Value?.ToLower() switch
            {
                "active" => "Ativo",
                "inactive" => "Inativo",
                _ => statusNode.Value ?? ""
            };
        }
        
        Console.WriteLine("✅ Dados parseados com sucesso");
        
        return result;
    }
    
    /// <summary>
    /// Consulta o nome da cidade via API do IBGE
    /// </summary>
    private static async Task<string> GetCityNameAsync(string codigoIBGE)
    {
        if (string.IsNullOrEmpty(codigoIBGE)) return "";
        
        try
        {
            // A API do IBGE precisa do código com 7 dígitos
            var codigoCompleto = codigoIBGE.Length == 6 ? codigoIBGE + "0" : codigoIBGE;
            
            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromSeconds(5);
            
            var url = $"https://servicodados.ibge.gov.br/api/v1/localidades/municipios/{codigoCompleto}";
            var response = await httpClient.GetStringAsync(url);
            
            var json = JsonSerializer.Deserialize<JsonElement>(response);
            
            var cidade = json.GetProperty("nome").GetString() ?? "";
            var uf = "";
            
            if (json.TryGetProperty("microrregiao", out var micro) &&
                micro.TryGetProperty("mesorregiao", out var meso) &&
                meso.TryGetProperty("UF", out var ufObj) &&
                ufObj.TryGetProperty("sigla", out var sigla))
            {
                uf = sigla.GetString() ?? "";
            }
            
            return !string.IsNullOrEmpty(uf) ? $"{cidade}/{uf}" : cidade;
        }
        catch
        {
            return $"Código IBGE: {codigoIBGE}";
        }
    }
    
    /// <summary>
    /// Formata número de telefone
    /// </summary>
    private static string FormatPhone(string phone)
    {
        if (string.IsNullOrEmpty(phone)) return phone;
        
        // Remover +55 e não-dígitos
        var cleaned = new string(phone.Replace("+55", "").Replace("-", "").Where(char.IsDigit).ToArray());
        
        if (cleaned.Length == 11)
        {
            // Celular: (XX) 9XXXX-XXXX
            return $"({cleaned.Substring(0, 2)}) {cleaned.Substring(2, 5)}-{cleaned.Substring(7)}";
        }
        else if (cleaned.Length == 10)
        {
            // Fixo: (XX) XXXX-XXXX
            return $"({cleaned.Substring(0, 2)}) {cleaned.Substring(2, 4)}-{cleaned.Substring(6)}";
        }
        
        return phone;
    }
    
    /// <summary>
    /// Executa comando PowerShell e retorna saída
    /// </summary>
    private static async Task<string> ExecutePowerShellAsync(string command, int timeout)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "powershell",
            Arguments = $"-Command \"{command.Replace("\"", "\\\"")}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        
        using var process = new Process { StartInfo = psi };
        process.Start();
        
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        
        var completed = await Task.Run(() => process.WaitForExit(timeout));
        
        if (!completed)
        {
            process.Kill();
            throw new TimeoutException("Comando PowerShell excedeu o tempo limite");
        }
        
        var output = await outputTask;
        var error = await errorTask;
        
        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException($"PowerShell retornou código {process.ExitCode}: {error}");
        }
        
        return output;
    }
    
    /// <summary>
    /// Executa arquivo de script PowerShell e retorna saída
    /// </summary>
    private static async Task<string> ExecutePowerShellFileAsync(string scriptPath, int timeout)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "powershell",
            Arguments = $"-ExecutionPolicy Bypass -File \"{scriptPath}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        
        using var process = new Process { StartInfo = psi };
        process.Start();
        
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        
        var completed = await Task.Run(() => process.WaitForExit(timeout));
        
        if (!completed)
        {
            process.Kill();
            throw new TimeoutException("Script PowerShell excedeu o tempo limite");
        }
        
        var output = await outputTask;
        var error = await errorTask;
        
        if (process.ExitCode != 0)
        {
            // Tentar parsear erro como JSON
            try
            {
                var errorJson = JsonSerializer.Deserialize<JsonElement>(output.Trim());
                if (errorJson.TryGetProperty("StatusCode", out var statusCode))
                {
                    throw new InvalidOperationException($"CADSUS API retornou {statusCode}: {errorJson.GetProperty("StatusDescription").GetString()}");
                }
            }
            catch (JsonException) { }
            
            throw new InvalidOperationException($"PowerShell retornou código {process.ExitCode}: {error}");
        }
        
        return output;
    }
}
