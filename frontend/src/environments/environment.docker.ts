// ========================================
// Ambiente de DESENVOLVIMENTO COM DOCKER
// ========================================
// Usado quando: docker-compose.dev.yml
// Jitsi: Integrado no mesmo docker-compose

// Determina dinamicamente a URL da API baseado no host atual
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    // Em Docker dev, API está no mesmo host via Nginx proxy
    return `${protocol}//${host}/api`;
  }
  return '/api';
};

// Determina dinamicamente o domínio do Jitsi Self-Hosted
const getJitsiDomain = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Em Docker dev local, Jitsi está na porta 8443
    return `${host}:8443`;
  }
  return 'localhost:8443';
};

export const environment = {
  production: false,
  apiUrl: getApiUrl(),
  
  // Configurações do Jitsi Meet Self-Hosted
  jitsi: {
    // Domínio do servidor Jitsi (self-hosted Docker)
    domain: getJitsiDomain(),
    // Se o Jitsi está habilitado
    enabled: true,
    // Self-hosted sempre requer autenticação JWT
    requiresAuth: true,
    // App ID para JWT (deve corresponder ao configurado no Prosody)
    appId: 'telecuidar'
  }
};
