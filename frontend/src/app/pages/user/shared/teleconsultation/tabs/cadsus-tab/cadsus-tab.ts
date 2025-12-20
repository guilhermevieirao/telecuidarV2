import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/atoms/icon/icon';
import { CadsusService, CadsusCidadao, CadsusTokenStatus } from '@core/services/cadsus.service';
import { Appointment } from '@core/services/appointments.service';
import { Subject, takeUntil, interval } from 'rxjs';

@Component({
  selector: 'app-cadsus-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './cadsus-tab.html',
  styleUrls: ['./cadsus-tab.scss']
})
export class CadsusTabComponent implements OnInit, OnDestroy {
  @Input() appointmentId: string | null = null;
  @Input() appointment: Appointment | null = null;

  // Estado do formulário
  cpf = '';
  loading = false;
  error: string | null = null;
  
  // Dados do cidadão
  cidadao: CadsusCidadao | null = null;
  
  // Status do token
  tokenStatus: CadsusTokenStatus | null = null;
  tokenLoading = false;
  
  private destroy$ = new Subject<void>();
  private tokenCheckInterval$ = new Subject<void>();

  constructor(private cadsusService: CadsusService) {}

  ngOnInit() {
    // Carregar status do token ao iniciar
    this.checkTokenStatus();
    
    // Verificar status do token a cada 60 segundos
    interval(60000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.checkTokenStatus());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Formata CPF durante digitação
   */
  formatCpfInput(value: string): string {
    const cleaned = value.replace(/\D/g, '');
    let formatted = '';
    
    for (let i = 0; i < cleaned.length && i < 11; i++) {
      if (i === 3 || i === 6) formatted += '.';
      if (i === 9) formatted += '-';
      formatted += cleaned[i];
    }
    
    return formatted;
  }

  /**
   * Handler para input do CPF
   */
  onCpfInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.cpf = this.formatCpfInput(input.value);
    input.value = this.cpf;
    this.error = null;
  }

  /**
   * Verifica se o CPF é válido para consulta
   */
  get isValidCpf(): boolean {
    return this.cadsusService.isValidCpfFormat(this.cpf);
  }

  /**
   * Consulta o CPF no CADSUS
   */
  consultarCpf() {
    if (!this.isValidCpf) {
      this.error = 'Digite um CPF válido com 11 dígitos';
      return;
    }

    this.loading = true;
    this.error = null;
    this.cidadao = null;

    this.cadsusService.consultarCpf(this.cpf)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.cidadao = data;
          this.loading = false;
        },
        error: (err) => {
          console.error('Erro ao consultar CADSUS:', err);
          this.error = err.error?.message || err.error?.error || 'Erro ao consultar CADSUS. Verifique se o serviço está configurado.';
          this.loading = false;
        }
      });
  }

  /**
   * Verifica status do token
   */
  checkTokenStatus() {
    this.cadsusService.getTokenStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.tokenStatus = status;
        },
        error: (err) => {
          console.error('Erro ao verificar status do token:', err);
        }
      });
  }

  /**
   * Força renovação do token
   */
  renewToken() {
    this.tokenLoading = true;
    
    this.cadsusService.renewToken()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.tokenStatus = {
            hasToken: response.hasToken,
            isValid: response.isValid,
            expiresAt: response.expiresAt,
            expiresIn: response.expiresIn,
            expiresInMs: 0
          };
          this.tokenLoading = false;
        },
        error: (err) => {
          console.error('Erro ao renovar token:', err);
          this.tokenLoading = false;
        }
      });
  }

  /**
   * Limpa os dados da consulta
   */
  limparDados() {
    this.cidadao = null;
    this.error = null;
  }

  /**
   * Retorna classe CSS para status do cadastro
   */
  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'ativo':
        return 'status-active';
      case 'inativo':
        return 'status-inactive';
      case 'pendente':
        return 'status-pending';
      default:
        return '';
    }
  }
}
