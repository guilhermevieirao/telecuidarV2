namespace Infrastructure.Services;

/// <summary>
/// Serviço para gerar templates de e-mail HTML
/// </summary>
public static class EmailTemplateService
{
    /// <summary>
    /// Gera o template HTML para notificações
    /// </summary>
    public static string GenerateNotificationEmailHtml(
        string userName, 
        string title, 
        string message, 
        string type, 
        DateTime createdAt,
        string? link = null,
        string frontendUrl = "http://localhost:4200")
    {
        var typeColor = type.ToLower() switch
        {
            "success" => "#10b981",
            "warning" => "#f59e0b", 
            "error" => "#ef4444",
            "info" => "#3b82f6",
            _ => "#6b7280"
        };

        var typeIcon = type.ToLower() switch
        {
            "success" => "✓",
            "warning" => "⚠",
            "error" => "✕",
            "info" => "ℹ",
            _ => "•"
        };

        var typeName = type.ToLower() switch
        {
            "success" => "Sucesso",
            "warning" => "Atenção",
            "error" => "Erro",
            "info" => "Informação",
            _ => "Notificação"
        };

        var linkButton = !string.IsNullOrWhiteSpace(link) 
            ? $@"
                <tr>
                    <td style=""padding: 20px 0 0 0;"">
                        <a href=""{frontendUrl}{link}"" 
                           style=""display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;"">
                            Ver Detalhes
                        </a>
                    </td>
                </tr>"
            : "";

        return $@"
<!DOCTYPE html>
<html lang=""pt-BR"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>{title} - TeleCuidar</title>
</head>
<body style=""margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;"">
    <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
        <tr>
            <td style=""padding: 40px 20px;"">
                <table role=""presentation"" style=""max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;"">
                    <!-- Header -->
                    <tr>
                        <td style=""padding: 30px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); text-align: center;"">
                            <h1 style=""margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;"">TeleCuidar</h1>
                            <p style=""margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;"">Plataforma de Telemedicina</p>
                        </td>
                    </tr>
                    
                    <!-- Greeting -->
                    <tr>
                        <td style=""padding: 30px 30px 0 30px;"">
                            <p style=""margin: 0; color: #374151; font-size: 16px;"">Olá, <strong>{userName}</strong>!</p>
                        </td>
                    </tr>
                    
                    <!-- Notification Badge -->
                    <tr>
                        <td style=""padding: 20px 30px;"">
                            <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
                                <tr>
                                    <td style=""padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid {typeColor};"">
                                        <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
                                            <tr>
                                                <td style=""width: 40px; vertical-align: top;"">
                                                    <div style=""width: 36px; height: 36px; background-color: {typeColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; line-height: 36px; text-align: center;"">
                                                        {typeIcon}
                                                    </div>
                                                </td>
                                                <td style=""padding-left: 15px;"">
                                                    <span style=""display: inline-block; padding: 2px 8px; background-color: {typeColor}; color: #ffffff; font-size: 11px; font-weight: 600; border-radius: 4px; text-transform: uppercase; margin-bottom: 8px;"">{typeName}</span>
                                                    <h2 style=""margin: 8px 0; color: #111827; font-size: 18px; font-weight: 600;"">{title}</h2>
                                                    <p style=""margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;"">{message}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Action Button -->
                    <tr>
                        <td style=""padding: 0 30px; text-align: center;"">
                            <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
                                {linkButton}
                                <tr>
                                    <td style=""padding: 20px 0 0 0;"">
                                        <a href=""{frontendUrl}/notificacoes"" 
                                           style=""display: inline-block; padding: 12px 24px; background-color: #6b7280; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;"">
                                            Ver Todas as Notificações
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Timestamp -->
                    <tr>
                        <td style=""padding: 30px; text-align: center;"">
                            <p style=""margin: 0; color: #9ca3af; font-size: 13px;"">
                                Enviado em {createdAt.ToLocalTime():dd/MM/yyyy} às {createdAt.ToLocalTime():HH:mm}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style=""padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;"">
                            <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
                                <tr>
                                    <td style=""text-align: center;"">
                                        <p style=""margin: 0 0 10px 0; color: #6b7280; font-size: 13px;"">
                                            Este e-mail foi enviado automaticamente pelo sistema TeleCuidar.
                                        </p>
                                        <p style=""margin: 0; color: #9ca3af; font-size: 12px;"">
                                            Se você não deseja receber estas notificações, acesse suas configurações na plataforma.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    /// <summary>
    /// Gera versão em texto plano para clientes de e-mail que não suportam HTML
    /// </summary>
    public static string GenerateNotificationEmailPlainText(
        string userName, 
        string title, 
        string message, 
        string type, 
        DateTime createdAt,
        string? link = null,
        string frontendUrl = "http://localhost:4200")
    {
        var typeName = type.ToLower() switch
        {
            "success" => "SUCESSO",
            "warning" => "ATENÇÃO",
            "error" => "ERRO",
            "info" => "INFORMAÇÃO",
            _ => "NOTIFICAÇÃO"
        };

        var linkText = !string.IsNullOrWhiteSpace(link) 
            ? $"\nVer detalhes: {frontendUrl}{link}\n" 
            : "";

        return $@"
TeleCuidar - Plataforma de Telemedicina
========================================

Olá, {userName}!

[{typeName}] {title}

{message}
{linkText}
----------------------------------------
Enviado em: {createdAt.ToLocalTime():dd/MM/yyyy} às {createdAt.ToLocalTime():HH:mm}

Ver todas as notificações: {frontendUrl}/notificacoes

---
Este e-mail foi enviado automaticamente pelo sistema TeleCuidar.
";
    }

    /// <summary>
    /// Gera o template HTML para recuperação de senha
    /// </summary>
    public static string GeneratePasswordResetEmailHtml(
        string userName,
        string resetToken,
        string frontendUrl = "http://localhost:4200")
    {
        var resetLink = $"{frontendUrl}/reset-password?token={resetToken}";

        return $@"
<!DOCTYPE html>
<html lang=""pt-BR"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Recuperação de Senha - TeleCuidar</title>
</head>
<body style=""margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;"">
    <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
        <tr>
            <td style=""padding: 40px 20px;"">
                <table role=""presentation"" style=""max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;"">
                    <!-- Header -->
                    <tr>
                        <td style=""padding: 30px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); text-align: center;"">
                            <h1 style=""margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;"">TeleCuidar</h1>
                            <p style=""margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;"">Recuperação de Senha</p>
                        </td>
                    </tr>
                    
                    <!-- Greeting -->
                    <tr>
                        <td style=""padding: 30px 30px 0 30px;"">
                            <p style=""margin: 0; color: #374151; font-size: 16px;"">Olá, <strong>{userName}</strong>!</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style=""padding: 20px 30px;"">
                            <p style=""margin: 0 0 20px 0; color: #4b5563; font-size: 15px; line-height: 1.6;"">
                                Recebemos uma solicitação para recuperar sua senha. Se não foi você, ignore este e-mail.
                            </p>
                            <p style=""margin: 0 0 20px 0; color: #4b5563; font-size: 15px; line-height: 1.6;"">
                                Este link de recuperação expira em <strong>1 hora</strong>.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Action Button -->
                    <tr>
                        <td style=""padding: 0 30px 20px 30px; text-align: center;"">
                            <a href=""{resetLink}"" 
                               style=""display: inline-block; padding: 14px 40px; background-color: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;"">
                                Redefinir Minha Senha
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Alternative Link -->
                    <tr>
                        <td style=""padding: 0 30px 30px 30px; text-align: center;"">
                            <p style=""margin: 0; color: #6b7280; font-size: 13px;"">
                                Ou copie este link: <br/>
                                <a href=""{resetLink}"" style=""color: #0ea5e9; text-decoration: underline; word-break: break-all;"">{resetLink}</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Security Warning -->
                    <tr>
                        <td style=""padding: 20px 30px; background-color: #fef3c7; border-left: 4px solid #f59e0b;"">
                            <p style=""margin: 0; color: #78350f; font-size: 13px;"">
                                <strong>⚠️ Aviso de Segurança:</strong> Nunca compartilhe este link com ninguém. 
                                Os administradores da TeleCuidar nunca pedirão sua senha por e-mail.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style=""padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;"">
                            <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
                                <tr>
                                    <td style=""text-align: center;"">
                                        <p style=""margin: 0 0 10px 0; color: #6b7280; font-size: 13px;"">
                                            Este e-mail foi enviado automaticamente pelo sistema TeleCuidar.
                                        </p>
                                        <p style=""margin: 0; color: #9ca3af; font-size: 12px;"">
                                            Data/Hora: {DateTime.UtcNow.ToLocalTime():dd/MM/yyyy HH:mm:ss}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    /// <summary>
    /// Gera a versão em texto plano para recuperação de senha
    /// </summary>
    public static string GeneratePasswordResetEmailPlainText(
        string userName,
        string resetToken,
        string frontendUrl = "http://localhost:4200")
    {
        var resetLink = $"{frontendUrl}/reset-password?token={resetToken}";

        return $@"
TeleCuidar - Recuperação de Senha
=================================

Olá, {userName}!

Recebemos uma solicitação para recuperar sua senha. Se não foi você, ignore este e-mail.

Este link expira em 1 hora:
{resetLink}

---
AVISO DE SEGURANÇA:
Nunca compartilhe este link com ninguém.
Os administradores nunca pedirão sua senha por e-mail.

Data/Hora: {DateTime.UtcNow.ToLocalTime():dd/MM/yyyy HH:mm:ss}

Este e-mail foi enviado automaticamente pelo sistema TeleCuidar.
";
    }

    /// <summary>
    /// Gera o template HTML para confirmação de email
    /// </summary>
    public static string GenerateEmailVerificationHtml(
        string userName,
        string verificationToken,
        string frontendUrl = "http://localhost:4200")
    {
        var verificationLink = $"{frontendUrl}/auth/verify-email?token={verificationToken}";

        return $@"
<!DOCTYPE html>
<html lang=""pt-BR"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Confirme sua Conta - TeleCuidar</title>
</head>
<body style=""margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;"">
    <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
        <tr>
            <td style=""padding: 40px 20px;"">
                <table role=""presentation"" style=""max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;"">
                    <!-- Header -->
                    <tr>
                        <td style=""padding: 30px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); text-align: center;"">
                            <h1 style=""margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;"">TeleCuidar</h1>
                            <p style=""margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;"">Bem-vindo à Plataforma</p>
                        </td>
                    </tr>
                    
                    <!-- Greeting -->
                    <tr>
                        <td style=""padding: 30px 30px 0 30px;"">
                            <p style=""margin: 0; color: #374151; font-size: 16px;"">Olá, <strong>{userName}</strong>!</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style=""padding: 20px 30px;"">
                            <p style=""margin: 0 0 20px 0; color: #4b5563; font-size: 15px; line-height: 1.6;"">
                                Obrigado por se registrar na TeleCuidar! Para ativar sua conta e começar a usar nossa plataforma, você precisa confirmar seu endereço de e-mail.
                            </p>
                            <p style=""margin: 0 0 20px 0; color: #4b5563; font-size: 15px; line-height: 1.6;"">
                                Clique no botão abaixo para verificar seu e-mail. Este link expira em <strong>24 horas</strong>.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Action Button -->
                    <tr>
                        <td style=""padding: 0 30px 20px 30px; text-align: center;"">
                            <a href=""{verificationLink}"" 
                               style=""display: inline-block; padding: 14px 40px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;"">
                                Confirmar Email
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Alternative Link -->
                    <tr>
                        <td style=""padding: 0 30px 30px 30px; text-align: center;"">
                            <p style=""margin: 0; color: #6b7280; font-size: 13px;"">
                                Ou copie este link: <br/>
                                <a href=""{verificationLink}"" style=""color: #0ea5e9; text-decoration: underline; word-break: break-all;"">{verificationLink}</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Info Box -->
                    <tr>
                        <td style=""padding: 20px 30px; background-color: #d1fae5; border-left: 4px solid #10b981;"">
                            <p style=""margin: 0; color: #065f46; font-size: 13px;"">
                                <strong>ℹ️ Informação:</strong> Se você não criou esta conta, simplesmente ignore este e-mail.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style=""padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;"">
                            <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
                                <tr>
                                    <td style=""text-align: center;"">
                                        <p style=""margin: 0 0 10px 0; color: #6b7280; font-size: 13px;"">
                                            Este e-mail foi enviado automaticamente pelo sistema TeleCuidar.
                                        </p>
                                        <p style=""margin: 0; color: #9ca3af; font-size: 12px;"">
                                            Data/Hora: {DateTime.UtcNow.ToLocalTime():dd/MM/yyyy HH:mm:ss}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    /// <summary>
    /// Gera a versão em texto plano para confirmação de email
    /// </summary>
    public static string GenerateEmailVerificationPlainText(
        string userName,
        string verificationToken,
        string frontendUrl = "http://localhost:4200")
    {
        var verificationLink = $"{frontendUrl}/auth/verify-email?token={verificationToken}";

        return $@"
TeleCuidar - Confirmação de Email
==================================

Olá, {userName}!

Obrigado por se registrar na TeleCuidar! Para ativar sua conta, você precisa confirmar seu endereço de e-mail.

Este link expira em 24 horas:
{verificationLink}

---
Se você não criou esta conta, ignore este e-mail.

Data/Hora: {DateTime.UtcNow.ToLocalTime():dd/MM/yyyy HH:mm:ss}

Este e-mail foi enviado automaticamente pelo sistema TeleCuidar.
";
    }

    /// <summary>
    /// Gera o template HTML para convite de usuário
    /// </summary>
    public static string GenerateInviteEmailHtml(
        string userName,
        string userRole,
        string inviteToken,
        DateTime expiresAt,
        string? createdByName = null,
        string frontendUrl = "http://localhost:4200")
    {
        var inviteLink = $"{frontendUrl}/registrar?token={inviteToken}";
        
        var roleDisplayName = userRole.ToUpper() switch
        {
            "PROFESSIONAL" => "Profissional de Saúde",
            "PATIENT" => "Paciente",
            "ADMIN" => "Administrador",
            _ => userRole
        };

        var createdByText = !string.IsNullOrWhiteSpace(createdByName) 
            ? $"<strong>{createdByName}</strong> convidou você para " 
            : "Você foi convidado para ";

        return $@"
<!DOCTYPE html>
<html lang=""pt-BR"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Convite para TeleCuidar</title>
</head>
<body style=""margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;"">
    <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
        <tr>
            <td style=""padding: 40px 20px;"">
                <table role=""presentation"" style=""max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;"">
                    <!-- Header -->
                    <tr>
                        <td style=""padding: 30px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); text-align: center;"">
                            <h1 style=""margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;"">TeleCuidar</h1>
                            <p style=""margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;"">Você Recebeu um Convite</p>
                        </td>
                    </tr>
                    
                    <!-- Greeting -->
                    <tr>
                        <td style=""padding: 30px 30px 0 30px;"">
                            <p style=""margin: 0; color: #374151; font-size: 16px;"">Olá{(!string.IsNullOrWhiteSpace(userName) ? $", <strong>{userName}</strong>" : "")}!</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style=""padding: 20px 30px;"">
                            <p style=""margin: 0 0 20px 0; color: #4b5563; font-size: 15px; line-height: 1.6;"">
                                {createdByText}fazer parte da plataforma <strong>TeleCuidar</strong> como <strong>{roleDisplayName}</strong>.
                            </p>
                            <p style=""margin: 0 0 20px 0; color: #4b5563; font-size: 15px; line-height: 1.6;"">
                                A TeleCuidar é uma plataforma moderna de telemedicina que conecta profissionais de saúde e pacientes de forma segura e eficiente.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Role Badge -->
                    <tr>
                        <td style=""padding: 0 30px 20px 30px; text-align: center;"">
                            <div style=""display: inline-block; padding: 12px 24px; background-color: #f3e8ff; border: 2px solid #8b5cf6; border-radius: 8px;"">
                                <p style=""margin: 0; color: #7c3aed; font-size: 14px; font-weight: 600;"">
                                    Perfil Convidado: {roleDisplayName}
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Action Button -->
                    <tr>
                        <td style=""padding: 0 30px 20px 30px; text-align: center;"">
                            <a href=""{inviteLink}"" 
                               style=""display: inline-block; padding: 14px 40px; background-color: #8b5cf6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;"">
                                Aceitar Convite e Criar Conta
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Alternative Link -->
                    <tr>
                        <td style=""padding: 0 30px 30px 30px; text-align: center;"">
                            <p style=""margin: 0; color: #6b7280; font-size: 13px;"">
                                Ou copie este link: <br/>
                                <a href=""{inviteLink}"" style=""color: #0ea5e9; text-decoration: underline; word-break: break-all;"">{inviteLink}</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Expiration Info -->
                    <tr>
                        <td style=""padding: 20px 30px; background-color: #fef3c7; border-left: 4px solid #f59e0b;"">
                            <p style=""margin: 0; color: #78350f; font-size: 13px;"">
                                <strong>⏰ Atenção:</strong> Este convite expira em <strong>{expiresAt.ToLocalTime():dd/MM/yyyy}</strong> às <strong>{expiresAt.ToLocalTime():HH:mm}</strong>.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style=""padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;"">
                            <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
                                <tr>
                                    <td style=""text-align: center;"">
                                        <p style=""margin: 0 0 10px 0; color: #6b7280; font-size: 13px;"">
                                            Este e-mail foi enviado automaticamente pelo sistema TeleCuidar.
                                        </p>
                                        <p style=""margin: 0; color: #9ca3af; font-size: 12px;"">
                                            Se você não esperava este convite, pode ignorar este e-mail.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }

    /// <summary>
    /// Gera a versão em texto plano para convite de usuário
    /// </summary>
    public static string GenerateInviteEmailPlainText(
        string userName,
        string userRole,
        string inviteToken,
        DateTime expiresAt,
        string? createdByName = null,
        string frontendUrl = "http://localhost:4200")
    {
        var inviteLink = $"{frontendUrl}/registrar?token={inviteToken}";
        
        var roleDisplayName = userRole.ToUpper() switch
        {
            "PROFESSIONAL" => "Profissional de Saúde",
            "PATIENT" => "Paciente",
            "ADMIN" => "Administrador",
            _ => userRole
        };

        var createdByText = !string.IsNullOrWhiteSpace(createdByName) 
            ? $"{createdByName} convidou você para " 
            : "Você foi convidado para ";

        var greetingText = !string.IsNullOrWhiteSpace(userName) ? $"Olá, {userName}!" : "Olá!";

        return $@"
TeleCuidar - Convite para Participar da Plataforma
===================================================

{greetingText}

{createdByText}fazer parte da plataforma TeleCuidar como {roleDisplayName}.

A TeleCuidar é uma plataforma moderna de telemedicina que conecta 
profissionais de saúde e pacientes de forma segura e eficiente.

PERFIL CONVIDADO: {roleDisplayName}

Para aceitar o convite e criar sua conta, acesse:
{inviteLink}

---
ATENÇÃO: Este convite expira em {expiresAt.ToLocalTime():dd/MM/yyyy} às {expiresAt.ToLocalTime():HH:mm}.

Se você não esperava este convite, pode ignorar este e-mail.

Este e-mail foi enviado automaticamente pelo sistema TeleCuidar.
";
    }
}
