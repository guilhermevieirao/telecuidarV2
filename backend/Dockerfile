# ========================================
# TeleCuidar Backend - Dockerfile
# Multi-stage build para .NET 10
# ========================================

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

# Copiar arquivos de projeto primeiro para cache de restore
COPY ["WebAPI/WebAPI.csproj", "WebAPI/"]
COPY ["Application/Application.csproj", "Application/"]
COPY ["Domain/Domain.csproj", "Domain/"]
COPY ["Infrastructure/Infrastructure.csproj", "Infrastructure/"]

# Restore de dependências
RUN dotnet restore "WebAPI/WebAPI.csproj"

# Copiar todo o código fonte
COPY . .

# Build da aplicação
WORKDIR "/src/WebAPI"
RUN dotnet build "WebAPI.csproj" -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish "WebAPI.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS runtime
WORKDIR /app

# Instalar curl para healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Criar usuário não-root para segurança (sintaxe Debian)
RUN useradd --create-home --shell /bin/bash appuser

# Criar diretórios necessários
RUN mkdir -p /app/uploads /app/data /app/logs && \
    chown -R appuser:appuser /app

# Copiar aplicação publicada
COPY --from=publish /app/publish .
RUN chown -R appuser:appuser /app

# Mudar para usuário não-root
USER appuser

# Variáveis de ambiente padrão
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_RUNNING_IN_CONTAINER=true

# Expor porta
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Entrypoint
ENTRYPOINT ["dotnet", "WebAPI.dll"]
