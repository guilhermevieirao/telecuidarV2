import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Serviço para detectar o tipo de dispositivo com alta precisão.
 * Utiliza múltiplos critérios em vez de apenas regex de User Agent.
 * 
 * Critérios de detecção:
 * 1. User Agent (menos confiável, mas um indicador)
 * 2. Touch capabilities (mais confiável para detectar dispositivos reais)
 * 3. Viewport width (móvel típico: < 768px, tablet: 768px-1024px, desktop: > 1024px)
 * 4. Device pixel ratio (dispositivos móveis costumam ter dpi mais alto)
 * 5. Orientação (suporte a orientação é típico de móvel/tablet)
 * 6. Pointer capabilities (touch vs mouse precision)
 */
@Injectable({
  providedIn: 'root'
})
export class DeviceDetectorService {
  private cachedIsMobile: boolean | null = null;
  private cachedIsTablet: boolean | null = null;
  private cachedIsDesktop: boolean | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Limpar cache quando mudar tamanho da tela
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('orientationchange', () => {
        this.clearCache();
      });
      
      window.addEventListener('resize', () => {
        this.clearCache();
      });
    }
  }

  /**
   * Detecta se é um dispositivo móvel
   */
  isMobile(): boolean {
    if (this.cachedIsMobile !== null) {
      return this.cachedIsMobile;
    }

    if (!isPlatformBrowser(this.platformId)) {
      this.cachedIsMobile = false;
      return false;
    }

    // Combinar múltiplos critérios
    const hasRealTouchSupport = this.hasRealTouchSupport();
    const hasMobileUserAgent = this.hasMobileUserAgent();
    const viewportWidth = window.innerWidth;
    const hasOrientationSupport = this.hasOrientationSupport();
    const hasHighDpi = this.hasHighDpi();

    /**
     * Lógica de decisão:
     * - Se tem touch REAL (não simulado) E viewport pequeno: é móvel
     * - Se tem user agent móvel E touch real E viewport < 768px: é móvel
     * - Se viewport é MUITO pequeno (< 480px) E tem qualquer touch: é móvel
     * - Caso contrário: não é móvel
     */

    const isMobileByViewport = viewportWidth < 480; // Definitivamente móvel
    const isMobileByTouch = hasRealTouchSupport && viewportWidth < 768;
    const isMobileByUserAgent = hasMobileUserAgent && hasRealTouchSupport && viewportWidth < 768;

    this.cachedIsMobile = isMobileByViewport || isMobileByTouch || isMobileByUserAgent;
    return this.cachedIsMobile;
  }

  /**
   * Detecta se é um dispositivo tablet
   */
  isTablet(): boolean {
    if (this.cachedIsTablet !== null) {
      return this.cachedIsTablet;
    }

    if (!isPlatformBrowser(this.platformId)) {
      this.cachedIsTablet = false;
      return false;
    }

    const hasRealTouchSupport = this.hasRealTouchSupport();
    const hasMobileUserAgent = this.hasMobileUserAgent();
    const viewportWidth = window.innerWidth;

    // Tablet: tem touch, user agent de móvel, mas viewport maior (768-1024px)
    this.cachedIsTablet = 
      hasRealTouchSupport &&
      hasMobileUserAgent &&
      viewportWidth >= 768 &&
      viewportWidth < 1025;

    return this.cachedIsTablet;
  }

  /**
   * Detecta se é um dispositivo desktop
   */
  isDesktop(): boolean {
    if (this.cachedIsDesktop !== null) {
      return this.cachedIsDesktop;
    }

    if (!isPlatformBrowser(this.platformId)) {
      this.cachedIsDesktop = true;
      return true;
    }

    const isMobileDevice = this.isMobile();
    const isTabletDevice = this.isTablet();

    this.cachedIsDesktop = !isMobileDevice && !isTabletDevice;
    return this.cachedIsDesktop;
  }

  /**
   * Retorna informações detalhadas sobre o dispositivo
   */
  getDeviceInfo() {
    return {
      isMobile: this.isMobile(),
      isTablet: this.isTablet(),
      isDesktop: this.isDesktop(),
      viewportWidth: isPlatformBrowser(this.platformId) ? window.innerWidth : 0,
      viewportHeight: isPlatformBrowser(this.platformId) ? window.innerHeight : 0,
      devicePixelRatio: isPlatformBrowser(this.platformId) ? window.devicePixelRatio : 1,
      userAgent: isPlatformBrowser(this.platformId) ? navigator.userAgent : '',
      orientation: isPlatformBrowser(this.platformId) ? this.getOrientation() : 'unknown'
    };
  }

  // ===== MÉTODOS PRIVADOS =====

  /**
   * Verifica se o dispositivo tem suporte a REAL touch (não simulado em desktop)
   */
  private hasRealTouchSupport(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    // Verificações múltiplas para detectar touch REAL
    const hasTouch = 
      'ontouchstart' in window ||
      ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) ||
      ('msMaxTouchPoints' in navigator && (navigator as any).msMaxTouchPoints > 0);

    if (!hasTouch) {
      return false;
    }

    // Verificação adicional: em desktops com resolução baixa, às vezes existe falso "touch"
    // Combinar com User Agent para ter mais certeza
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

    // Se tem touch mas User Agent não é móvel, provavelmente é desktop com suporte a touch
    if (!isMobileUA) {
      return false;
    }

    return true;
  }

  /**
   * Verifica o User Agent para sinais de dispositivo móvel
   */
  private hasMobileUserAgent(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const userAgent = navigator.userAgent.toLowerCase();
    const mobilePatterns = [
      'android',
      'webos',
      'iphone',
      'ipad',
      'ipod',
      'blackberry',
      'iemobile',
      'opera mini',
      'windows phone',
      'firefox.*mobile'
    ];

    return mobilePatterns.some(pattern => new RegExp(pattern).test(userAgent));
  }

  /**
   * Verifica se o dispositivo suporta orientação (móvel/tablet típico)
   */
  private hasOrientationSupport(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    return 'orientation' in window && 'onorientationchange' in window;
  }

  /**
   * Verifica se o dispositivo tem alta densidade de pixels
   */
  private hasHighDpi(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    return window.devicePixelRatio > 1.5;
  }

  /**
   * Retorna a orientação atual do dispositivo
   */
  private getOrientation(): string {
    if (!isPlatformBrowser(this.platformId)) {
      return 'unknown';
    }

    if ('orientation' in window) {
      return (window as any).orientation === 0 || (window as any).orientation === 180
        ? 'portrait'
        : 'landscape';
    }

    return 'unknown';
  }

  /**
   * Limpa o cache de detecção
   */
  private clearCache(): void {
    this.cachedIsMobile = null;
    this.cachedIsTablet = null;
    this.cachedIsDesktop = null;
  }
}
