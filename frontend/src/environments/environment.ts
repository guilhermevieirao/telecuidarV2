// ========================================
// Ambiente de DESENVOLVIMENTO LOCAL
// ========================================
// Usado quando: ng serve (tasks do VS Code)
// Jitsi: docker-compose.jitsi.yml rodando separado

// Determina dinamicamente a URL da API baseado no host atual
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Se acessando via IP ou não-localhost, usar o mesmo host para API
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:5239/api`;
    }
  }
  return 'http://localhost:5239/api';
};

// Determina dinamicamente o domínio do Jitsi Self-Hosted
const getJitsiDomain = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Em desenvolvimento local, Jitsi roda em localhost:8443
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'localhost:8443';
    }
    // Se acessando via IP da rede, usar mesmo IP para Jitsi
    return `${host}:8443`;
  }
  return 'localhost:8443';
};

export const environment = {
  production: false,
  apiUrl: getApiUrl(),
  
  // Configurações do Jitsi Meet Self-Hosted
  jitsi: {
    // Domínio do servidor Jitsi (self-hosted local)
    domain: getJitsiDomain(),
    // Se o Jitsi está habilitado
    enabled: true,
    // Self-hosted sempre requer autenticação JWT
    requiresAuth: true,
    // App ID para JWT (deve corresponder ao configurado no Prosody)
    appId: 'telecuidar'
  }
};
