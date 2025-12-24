using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Application.DTOs.Email;
using DotNetEnv;
using WebAPI.Hubs;
using WebAPI.Services;

// Load .env file from project root (two levels up from WebAPI folder)
var projectRoot = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", ".."));
var envPath = Path.Combine(projectRoot, ".env");
if (File.Exists(envPath))
{
    Env.Load(envPath);
}

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Serialize enums as strings instead of numbers
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database Configuration
var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING") 
    ?? builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Data Source=telecuidar.db";
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(connectionString));

// Email Configuration
var emailSettings = new EmailSettings
{
    Enabled = Environment.GetEnvironmentVariable("EMAIL_ENABLED")?.ToLower() == "true" 
        || builder.Configuration.GetValue<bool>("EmailSettings:Enabled", false),
    SmtpHost = Environment.GetEnvironmentVariable("EMAIL_SMTP_HOST") 
        ?? builder.Configuration.GetValue<string>("EmailSettings:SmtpHost", "smtp.gmail.com"),
    SmtpPort = int.TryParse(Environment.GetEnvironmentVariable("EMAIL_SMTP_PORT"), out var port) 
        ? port 
        : builder.Configuration.GetValue<int>("EmailSettings:SmtpPort", 587),
    SmtpUser = Environment.GetEnvironmentVariable("EMAIL_SMTP_USER") 
        ?? builder.Configuration.GetValue<string>("EmailSettings:SmtpUser", string.Empty),
    SmtpPassword = Environment.GetEnvironmentVariable("EMAIL_SMTP_PASSWORD") 
        ?? builder.Configuration.GetValue<string>("EmailSettings:SmtpPassword", string.Empty),
    FromName = Environment.GetEnvironmentVariable("EMAIL_FROM_NAME") 
        ?? builder.Configuration.GetValue<string>("EmailSettings:FromName", "TeleCuidar"),
    FromAddress = Environment.GetEnvironmentVariable("EMAIL_FROM_ADDRESS") 
        ?? builder.Configuration.GetValue<string>("EmailSettings:FromAddress", string.Empty),
    UseSsl = (Environment.GetEnvironmentVariable("EMAIL_USE_SSL")?.ToLower() != "false")
        || builder.Configuration.GetValue<bool>("EmailSettings:UseSsl", true)
};
builder.Services.AddSingleton(emailSettings);
builder.Services.AddScoped<Application.Interfaces.IEmailService, Infrastructure.Services.EmailService>();

// Services
builder.Services.AddScoped<Application.Interfaces.IJwtService, Infrastructure.Services.JwtService>();
builder.Services.AddScoped<Application.Interfaces.IPasswordHasher, Infrastructure.Services.PasswordHasher>();
builder.Services.AddScoped<Application.Interfaces.IAuthService, Infrastructure.Services.AuthService>();
builder.Services.AddScoped<Application.Interfaces.IUserService, Infrastructure.Services.UserService>();
builder.Services.AddScoped<Application.Interfaces.ISpecialtyService, Infrastructure.Services.SpecialtyService>();
builder.Services.AddScoped<Application.Interfaces.IAppointmentService, Infrastructure.Services.AppointmentService>();
builder.Services.AddScoped<Application.Interfaces.INotificationService, Infrastructure.Services.NotificationService>();
builder.Services.AddScoped<Application.Interfaces.IScheduleService, Infrastructure.Services.ScheduleService>();
builder.Services.AddScoped<Application.Interfaces.IScheduleBlockService, Infrastructure.Services.ScheduleBlockService>();
builder.Services.AddScoped<Application.Interfaces.IReportService, Infrastructure.Services.ReportService>();
builder.Services.AddScoped<Application.Interfaces.IAuditLogService, Infrastructure.Services.AuditLogService>();
builder.Services.AddScoped<Application.Interfaces.IAttachmentService, Infrastructure.Services.AttachmentService>();
builder.Services.AddScoped<Application.Interfaces.IInviteService, Infrastructure.Services.InviteService>();
builder.Services.AddScoped<Application.Interfaces.IAIService, Infrastructure.Services.AIService>();
builder.Services.AddScoped<Application.Interfaces.IPrescriptionService, Infrastructure.Services.PrescriptionService>();
builder.Services.AddScoped<Application.Interfaces.ICertificateStorageService, Infrastructure.Services.CertificateStorageService>();

builder.Services.AddSingleton<Application.Interfaces.ICadsusService, Infrastructure.Services.CadsusService>();
builder.Services.AddScoped<Application.Interfaces.IJitsiService, Infrastructure.Services.JitsiService>();
builder.Services.AddScoped<WebAPI.Services.IFileUploadService, WebAPI.Services.FileUploadService>();

// SignalR for real-time updates
builder.Services.AddSignalR();
builder.Services.AddSingleton<IUserConnectionService, UserConnectionService>();
builder.Services.AddSingleton<ITemporarySlotReservationService, TemporarySlotReservationService>();
builder.Services.AddSingleton<ISchedulingNotificationService, SchedulingNotificationService>();
builder.Services.AddSingleton<IRealTimeNotificationService, RealTimeNotificationService>();

// JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    var secretKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY") 
        ?? builder.Configuration["JwtSettings:SecretKey"]
        ?? throw new InvalidOperationException("JWT Secret Key not configured");
    
    var issuer = Environment.GetEnvironmentVariable("JWT_ISSUER") 
        ?? builder.Configuration["JwtSettings:Issuer"]
        ?? "TelecuidarAPI";
    
    var audience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") 
        ?? builder.Configuration["JwtSettings:Audience"]
        ?? "TelecuidarClient";
    
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
            System.Text.Encoding.UTF8.GetBytes(secretKey)),
        ValidateIssuer = true,
        ValidIssuer = issuer,
        ValidateAudience = true,
        ValidAudience = audience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero,
        NameClaimType = System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub
    };
});

// Memory Cache for temporary uploads
builder.Services.AddMemoryCache();

// CORS Configuration
var corsOrigins = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS")
    ?? "http://localhost:4200,http://192.168.15.2:4200";
var allowedOrigins = corsOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries)
    .Select(o => o.Trim())
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
    
    // SignalR specific CORS policy
    options.AddPolicy("SignalRPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Seed database
var seedEnabled = Environment.GetEnvironmentVariable("SEED_DATA_ENABLED")?.ToLower() != "false";
if (seedEnabled)
{
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();
        await WebAPI.Data.DataSeeder.SeedAsync(context);
    }
}

// Configure the HTTP request pipeline.
var swaggerEnabled = Environment.GetEnvironmentVariable("SWAGGER_ENABLED")?.ToLower() != "false";
if (app.Environment.IsDevelopment() || swaggerEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

var httpsRedirect = Environment.GetEnvironmentVariable("ENABLE_HTTPS_REDIRECT")?.ToLower() == "true";
if (!app.Environment.IsDevelopment() && httpsRedirect)
{
    app.UseHttpsRedirection();
}

app.UseCors("AllowFrontend");

// Use static files for uploads
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Map SignalR Hubs
app.MapHub<SchedulingHub>("/hubs/scheduling");
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<TeleconsultationHub>("/hubs/teleconsultation");

app.Run();
