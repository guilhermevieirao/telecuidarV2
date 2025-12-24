using System.Net;
using System.Net.Http.Json;
using Domain.Entities;
using Domain.Enums;
using FluentAssertions;
using Infrastructure.Data;
using Microsoft.Extensions.DependencyInjection;
using Tests.Helpers;
using Xunit;

namespace Tests.Integration.WebAPI.Controllers;

public class AppointmentsControllerTests : IClassFixture<TestWebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private User _adminUser = null!;
    private User _professional = null!;
    private User _patient = null!;
    private Specialty _specialty = null!;
    private string _adminToken = string.Empty;

    public AppointmentsControllerTests(TestWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public async Task InitializeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var jwtService = scope.ServiceProvider.GetRequiredService<Application.Interfaces.IJwtService>();
        var rand = new Random();

        // Cria especialidade
        _specialty = new Specialty
        {
            Name = $"Especialidade-{Guid.NewGuid()}",
            Description = "Descrição da especialidade",
            Status = SpecialtyStatus.Active
        };
        context.Specialties.Add(_specialty);

        // Cria admin
        _adminUser = new User
        {
            Email = $"admin.appt.{Guid.NewGuid()}@test.com",
            PasswordHash = "$2a$11$K7TqZWL3dIZ.fP3nzSYzZ.wLX8HE5LCB2xvGm3v3Q6YQxNvK1ZS6y",
            Name = "Admin",
            LastName = "Appointments",
            Cpf = $"{rand.Next(100, 999)}{rand.Next(100, 999)}{rand.Next(100, 999)}{rand.Next(10, 99)}",
            Role = UserRole.ADMIN,
            Status = UserStatus.Active,
            EmailVerified = true
        };
        context.Users.Add(_adminUser);

        // Cria profissional
        _professional = new User
        {
            Email = $"prof.appt.{Guid.NewGuid()}@test.com",
            PasswordHash = "$2a$11$K7TqZWL3dIZ.fP3nzSYzZ.wLX8HE5LCB2xvGm3v3Q6YQxNvK1ZS6y",
            Name = "Dr. Médico",
            LastName = "Teste",
            Cpf = $"{rand.Next(100, 999)}{rand.Next(100, 999)}{rand.Next(100, 999)}{rand.Next(10, 99)}",
            Role = UserRole.PROFESSIONAL,
            Status = UserStatus.Active,
            EmailVerified = true
        };
        context.Users.Add(_professional);

        // Cria paciente
        _patient = new User
        {
            Email = $"pac.appt.{Guid.NewGuid()}@test.com",
            PasswordHash = "$2a$11$K7TqZWL3dIZ.fP3nzSYzZ.wLX8HE5LCB2xvGm3v3Q6YQxNvK1ZS6y",
            Name = "Paciente",
            LastName = "Teste",
            Cpf = $"{rand.Next(100, 999)}{rand.Next(100, 999)}{rand.Next(100, 999)}{rand.Next(10, 99)}",
            Role = UserRole.PATIENT,
            Status = UserStatus.Active,
            EmailVerified = true
        };
        context.Users.Add(_patient);

        await context.SaveChangesAsync();

        // Cria perfil profissional
        var professionalProfile = new ProfessionalProfile
        {
            UserId = _professional.Id,
            SpecialtyId = _specialty.Id
        };
        context.ProfessionalProfiles.Add(professionalProfile);

        // Cria perfil paciente
        var patientProfile = new PatientProfile
        {
            UserId = _patient.Id
        };
        context.PatientProfiles.Add(patientProfile);

        await context.SaveChangesAsync();

        _adminToken = jwtService.GenerateAccessToken(_adminUser.Id, _adminUser.Email, "ADMIN");
        _client.SetBearerToken(_adminToken);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task GetAppointments_ShouldReturnOk_WhenAuthenticated()
    {
        // Act
        var response = await _client.GetAsync("/api/Appointments?page=1&pageSize=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("data");
    }

    [Fact]
    public async Task GetAppointments_ShouldReturnUnauthorized_WithoutAuth()
    {
        // Arrange
        var clientWithoutAuth = _factory.CreateClient();

        // Act
        var response = await clientWithoutAuth.GetAsync("/api/Appointments?page=1&pageSize=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateAppointment_ShouldReturnCreated_WithValidData()
    {
        // Arrange
        var request = new
        {
            PatientId = _patient.Id,
            ProfessionalId = _professional.Id,
            SpecialtyId = _specialty.Id,
            Date = DateTime.UtcNow.AddDays(7).Date.ToString("yyyy-MM-dd"),
            Time = "10:00",
            Type = "Common"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/Appointments", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task GetAppointmentById_ShouldReturnNotFound_WithInvalidId()
    {
        // Arrange
        var invalidId = Guid.NewGuid();

        // Act
        var response = await _client.GetAsync($"/api/Appointments/{invalidId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetAppointments_ShouldFilterByStatus()
    {
        // Act
        var response = await _client.GetAsync("/api/Appointments?page=1&pageSize=10&status=Scheduled");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetAppointments_ShouldFilterByDateRange()
    {
        // Arrange
        var startDate = DateTime.UtcNow.AddDays(-30).ToString("yyyy-MM-dd");
        var endDate = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd");

        // Act
        var response = await _client.GetAsync($"/api/Appointments?page=1&pageSize=10&startDate={startDate}&endDate={endDate}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task UpdateAppointment_ShouldReturnNotFound_WithInvalidId()
    {
        // Arrange
        var invalidId = Guid.NewGuid();
        var request = new
        {
            Status = "Confirmed"
        };

        // Act - Usa PATCH ao invés de PUT
        var response = await _client.PatchAsJsonAsync($"/api/Appointments/{invalidId}", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetAppointments_ShouldReturnOk_WhenAuthenticatedAsPatient()
    {
        // Arrange - Autentica como paciente
        using var scope = _factory.Services.CreateScope();
        var jwtService = scope.ServiceProvider.GetRequiredService<Application.Interfaces.IJwtService>();
        var patientToken = jwtService.GenerateAccessToken(_patient.Id, _patient.Email, "PATIENT");
        _client.SetBearerToken(patientToken);

        // Act
        var response = await _client.GetAsync("/api/Appointments?page=1&pageSize=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var result = await response.Content.ReadFromJsonAsync<Application.DTOs.Appointments.PaginatedAppointmentsDto>();
        result.Should().NotBeNull();
        // Verifica que todas as consultas retornadas são do paciente autenticado
        result!.Data.Should().OnlyContain(a => a.PatientId == _patient.Id);
    }
}
