// TeleCuidar - Configuração Customizada do Jitsi Meet
// Este arquivo configura o Jitsi para funcionar apenas via autenticação JWT

var config = {
    // ========================================
    // SEGURANÇA - JWT OBRIGATÓRIO
    // ========================================
    // Hosts e domínios
    hosts: {
        domain: 'meet.jitsi',
        muc: 'muc.meet.jitsi',
        focus: 'focus.meet.jitsi',
    },
    
    // Desabilitar completamente a página inicial
    enableWelcomePage: false,
    enableClosePage: false,
    
    // Desabilitar criação de salas aleatórias
    disableDeepLinking: true,
    
    // Requer autenticação JWT
    requireDisplayName: true,
    
    // ========================================
    // FUNCIONALIDADES
    // ========================================
    // Desabilitar recursos desnecessários
    disableInviteFunctions: true,
    doNotStoreRoom: true,
    
    // Gravação
    fileRecordingsEnabled: false,
    liveStreamingEnabled: false,
    
    // Recursos de moderação
    disableRemoteMute: false,
    
    // ========================================
    // INTERFACE
    // ========================================
    // Configurações de localização
    defaultLanguage: 'pt',
    
    // Prejoin page (sala de espera)
    prejoinConfig: {
        enabled: true,
        hideDisplayName: false,
        hideExtraJoinButtons: ['no-audio', 'by-phone']
    },
    
    // Notificações
    disableJoinLeaveSounds: false,
    
    // ========================================
    // PERFORMANCE
    // ========================================
    // Qualidade de vídeo
    constraints: {
        video: {
            height: {
                ideal: 720,
                max: 720,
                min: 240
            }
        }
    },
    
    // Resolução de vídeo
    resolution: 720,
    
    // Desabilitar P2P para força uso do servidor
    p2p: {
        enabled: false
    },
    
    // ========================================
    // BRANDING
    // ========================================
    // Remover todos os brandings do Jitsi
    defaultLogoUrl: '',
    defaultWelcomePageLogoUrl: '',
    
    // ========================================
    // OUTROS
    // ========================================
    // Desabilitar analytics
    disableThirdPartyRequests: true,
    
    // Desabilitar feedback
    feedbackPercentage: 0,
    
    // Desabilitar estatísticas de conexão
    connectionIndicators: {
        disabled: false,
        disableDetails: true
    }
};
