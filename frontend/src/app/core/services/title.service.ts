import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TitleService {
  private readonly appName = 'TeleCuidar';
  
  private readonly titleMap: { [key: string]: string } = {
    // Root
    '': 'Home',
    
    // Auth
    '/entrar': 'Login',
    '/registrar': 'Cadastro',
    '/auth/forgot-password': 'Recuperar Senha',
    '/auth/reset-password': 'Redefinir Senha',
    '/auth/verify-email': 'Verificar Email',
    
    // Mobile Upload
    '/mobile-upload': 'Upload de Documentos',
    
    // Shared routes
    '/painel': 'Painel',
    '/notificacoes': 'Notificações',
    '/perfil': 'Perfil',
    '/consultas': 'Consultas',
    
    // Admin routes
    '/usuarios': 'Usuários',
    '/convites': 'Convites',
    '/especialidades': 'Especialidades',
    '/agendas': 'Agendas',
    '/relatorios': 'Relatórios',
    '/logs-auditoria': 'Logs de Auditoria',
    
    // Professional routes
    '/bloqueios-agenda': 'Bloqueios de Agenda',
    '/minha-agenda': 'Minha Agenda',
    
    // Patient routes
    '/agendar': 'Agendar Consulta',
    '/agendamento-sucesso': 'Agendamento Confirmado'
  };

  constructor(
    private titleService: Title,
    private router: Router
  ) {
    this.initTitleUpdates();
  }

  private initTitleUpdates(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => this.router.url)
      )
      .subscribe(url => {
        this.updateTitle(url);
      });
  }

  private updateTitle(url: string): void {
    // Remove query params and fragments
    const cleanUrl = url.split('?')[0].split('#')[0];
    
    // Handle dynamic routes
    let pageTitle = this.titleMap[cleanUrl];
    
    // If exact match not found, try to match pattern
    if (!pageTitle) {
      // Handle teleconsultation routes
      if (cleanUrl.includes('/teleconsulta/')) {
        pageTitle = 'Teleconsulta';
      }
      // Handle pre-consultation routes
      else if (cleanUrl.includes('/pre-consulta')) {
        pageTitle = 'Pré-Consulta';
      }
      // Default fallback
      else {
        pageTitle = 'Página';
      }
    }
    
    this.setTitle(pageTitle);
  }

  public setTitle(pageTitle: string): void {
    const fullTitle = `${this.appName} - ${pageTitle}`;
    this.titleService.setTitle(fullTitle);
  }
}
