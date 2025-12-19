using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace WebAPI.Data;

public static class DataSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        // Verificar se já existem usuários
        if (await context.Users.AnyAsync())
        {
            Console.WriteLine("[SEEDER] Usuários já existem. Pulando seed.");
            return;
        }

        Console.WriteLine("[SEEDER] Iniciando seed de dados...");

        var passwordHasher = new PasswordHasher();
        var adminEmail = Environment.GetEnvironmentVariable("SEED_ADMIN_EMAIL") ?? "adm@adm.com";
        var adminPassword = Environment.GetEnvironmentVariable("SEED_ADMIN_PASSWORD") ?? "zxcasd12";
        var adminName = Environment.GetEnvironmentVariable("SEED_ADMIN_NAME") ?? "Admin";
        var adminLastName = Environment.GetEnvironmentVariable("SEED_ADMIN_LASTNAME") ?? "Sistema";
        var adminCpf = Environment.GetEnvironmentVariable("SEED_ADMIN_CPF") ?? "11111111111";
        const string defaultPassword = "zxcasd12";

        // Criar especialidade de Cardiologia com campos personalizados
        var cardiologiaFieldsJson = @"[
            {""name"":""Histórico de Infarto"",""type"":""checkbox"",""required"":true,""description"":""Paciente já teve infarto do miocárdio?"",""order"":1},
            {""name"":""Pressão Arterial Sistólica"",""type"":""number"",""required"":true,""description"":""Pressão arterial sistólica em mmHg"",""defaultValue"":""120"",""order"":2},
            {""name"":""Pressão Arterial Diastólica"",""type"":""number"",""required"":true,""description"":""Pressão arterial diastólica em mmHg"",""defaultValue"":""80"",""order"":3},
            {""name"":""Frequência Cardíaca"",""type"":""number"",""required"":true,""description"":""Batimentos por minuto em repouso"",""order"":4},
            {""name"":""Uso de Marca-passo"",""type"":""radio"",""required"":true,""description"":""Paciente faz uso de marca-passo?"",""options"":[""Sim"",""Não""],""order"":5},
            {""name"":""Tipo de Dor Torácica"",""type"":""select"",""required"":false,""description"":""Caso apresente dor torácica, qual o tipo?"",""options"":[""Não apresenta"",""Dor em aperto"",""Dor em queimação"",""Dor em pontada"",""Dor irradiada""],""order"":6},
            {""name"":""Medicamentos Cardiovasculares"",""type"":""textarea"",""required"":false,""description"":""Liste os medicamentos em uso para o coração"",""order"":7},
            {""name"":""Data Último ECG"",""type"":""date"",""required"":false,""description"":""Data do último eletrocardiograma realizado"",""order"":8},
            {""name"":""Histórico Familiar"",""type"":""textarea"",""required"":false,""description"":""Histórico familiar de doenças cardiovasculares"",""order"":9},
            {""name"":""Nível de Colesterol"",""type"":""select"",""required"":false,""description"":""Último exame de colesterol"",""options"":[""Normal"",""Borderline"",""Alto"",""Não sabe""],""order"":10}
        ]";

        var cardiologiaSpecialty = new Specialty
        {
            Name = "Cardiologia",
            Description = "Especialidade médica dedicada ao diagnóstico e tratamento de doenças do coração e do sistema circulatório, incluindo hipertensão, insuficiência cardíaca, arritmias e doenças coronarianas.",
            Status = SpecialtyStatus.Active,
            CustomFieldsJson = cardiologiaFieldsJson
        };

        context.Specialties.Add(cardiologiaSpecialty);
        await context.SaveChangesAsync();

        Console.WriteLine("[SEEDER] Especialidade criada:");
        Console.WriteLine("  - Cardiologia (com 10 campos personalizados)");

        var users = new List<User>
        {
            new User
            {
                Name = adminName,
                LastName = adminLastName,
                Email = adminEmail,
                Cpf = adminCpf,
                Phone = "11911111111",
                PasswordHash = passwordHasher.HashPassword(adminPassword),
                Role = UserRole.ADMIN,
                Status = UserStatus.Active,
                EmailVerified = true
            },
            new User
            {
                Name = "Médico",
                LastName = "Profissional",
                Email = "med@med.com",
                Cpf = "22222222222",
                Phone = "11922222222",
                PasswordHash = passwordHasher.HashPassword(defaultPassword),
                Role = UserRole.PROFESSIONAL,
                Status = UserStatus.Active,
                EmailVerified = true,
                SpecialtyId = cardiologiaSpecialty.Id
            },
            new User
            {
                Name = "Paciente",
                LastName = "Teste",
                Email = "pac@pac.com",
                Cpf = "33333333333",
                Phone = "11933333333",
                PasswordHash = passwordHasher.HashPassword(defaultPassword),
                Role = UserRole.PATIENT,
                Status = UserStatus.Active,
                EmailVerified = true
            }
        };

        context.Users.AddRange(users);
        await context.SaveChangesAsync();

        // Criar agenda para o profissional
        var professional = users.First(u => u.Role == UserRole.PROFESSIONAL);
        
        var globalConfigJson = @"{
            ""TimeRange"": {
                ""StartTime"": ""00:00"",
                ""EndTime"": ""23:00""
            },
            ""ConsultationDuration"": 30,
            ""IntervalBetweenConsultations"": 0
        }";

        var daysConfigJson = @"[
            {""Day"": ""Monday"", ""IsWorking"": true, ""Customized"": false},
            {""Day"": ""Tuesday"", ""IsWorking"": true, ""Customized"": false},
            {""Day"": ""Wednesday"", ""IsWorking"": true, ""Customized"": false},
            {""Day"": ""Thursday"", ""IsWorking"": true, ""Customized"": false},
            {""Day"": ""Friday"", ""IsWorking"": true, ""Customized"": false},
            {""Day"": ""Saturday"", ""IsWorking"": true, ""Customized"": false},
            {""Day"": ""Sunday"", ""IsWorking"": true, ""Customized"": false}
        ]";

        var schedule = new Schedule
        {
            ProfessionalId = professional.Id,
            GlobalConfigJson = globalConfigJson,
            DaysConfigJson = daysConfigJson,
            ValidityStartDate = DateTime.Now.AddDays(-2).Date,
            ValidityEndDate = null,
            IsActive = true
        };

        context.Schedules.Add(schedule);
        await context.SaveChangesAsync();

        // Criar consulta para o próximo horário disponível
        var patient = users.First(u => u.Role == UserRole.PATIENT);
        var now = DateTime.Now;
        
        // Calcular o próximo horário disponível (arredondar para a próxima meia hora)
        var minutes = now.Minute;
        var nextSlotMinutes = minutes < 30 ? 30 : 60;
        var appointmentDateTime = now.AddMinutes(nextSlotMinutes - minutes);
        if (nextSlotMinutes == 60)
        {
            appointmentDateTime = appointmentDateTime.AddHours(1);
            appointmentDateTime = new DateTime(
                appointmentDateTime.Year,
                appointmentDateTime.Month,
                appointmentDateTime.Day,
                appointmentDateTime.Hour,
                0,
                0
            );
        }
        else
        {
            appointmentDateTime = new DateTime(
                appointmentDateTime.Year,
                appointmentDateTime.Month,
                appointmentDateTime.Day,
                appointmentDateTime.Hour,
                30,
                0
            );
        }

        var appointment = new Appointment
        {
            PatientId = patient.Id,
            ProfessionalId = professional.Id,
            SpecialtyId = cardiologiaSpecialty.Id,
            Date = appointmentDateTime.Date,
            Time = appointmentDateTime.TimeOfDay,
            EndTime = appointmentDateTime.AddMinutes(30).TimeOfDay,
            Type = AppointmentType.Common,
            Status = AppointmentStatus.Scheduled,
            Observation = "Consulta de exemplo criada pelo seeder"
        };

        context.Appointments.Add(appointment);
        await context.SaveChangesAsync();

        Console.WriteLine("[SEEDER] Seed concluído!");
        Console.WriteLine("[SEEDER] Usuários criados:");
        Console.WriteLine($"  - {adminEmail} (ADMIN) - senha: {adminPassword}");
        Console.WriteLine("  - med@med.com (PROFESSIONAL) - senha: zxcasd12");
        Console.WriteLine("  - pac@pac.com (PATIENT) - senha: zxcasd12");
        Console.WriteLine("[SEEDER] Agenda criada:");
        Console.WriteLine($"  - Profissional: {professional.Name} {professional.LastName}");
        Console.WriteLine("  - Horário: 00:00 - 23:00 (todos os dias)");
        Console.WriteLine("  - Consultas: 30min, sem intervalo, sem pausa");
        Console.WriteLine($"  - Validade: {schedule.ValidityStartDate:dd/MM/yyyy} - indeterminado");
        Console.WriteLine("[SEEDER] Consulta criada:");
        Console.WriteLine($"  - Paciente: {patient.Name} {patient.LastName}");
        Console.WriteLine($"  - Profissional: {professional.Name} {professional.LastName}");
        Console.WriteLine($"  - Especialidade: {cardiologiaSpecialty.Name}");
        Console.WriteLine($"  - Data/Hora: {appointmentDateTime:dd/MM/yyyy HH:mm}");
        Console.WriteLine($"  - Tipo: Videochamada");
        Console.WriteLine($"  - Status: Agendada");
    }
}
