import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:5239/api';

/**
 * Interface para dados do cidadão retornados pelo CADSUS
 */
export interface CadsusCidadao {
  // Identificação Principal
  cns: string;
  cpf: string;
  nome: string;
  dataNascimento: string;
  statusCadastro: string;
  
  // Filiação
  nomeMae: string;
  nomePai: string;
  
  // Características
  sexo: string;
  racaCor: string;
  
  // Endereço
  tipoLogradouro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  cidade: string;
  codigoCidade: string;
  paisEnderecoAtual: string;
  cep: string;
  enderecoCompleto: string;
  
  // Naturalidade
  cidadeNascimento: string;
  codigoCidadeNascimento: string;
  paisNascimento: string;
  codigoPaisNascimento: string;
  
  // Contato
  telefones: string[];
  emails: string[];
}

/**
 * Interface para status do token CADSUS
 */
export interface CadsusTokenStatus {
  hasToken: boolean;
  isValid: boolean;
  expiresAt?: string;
  expiresIn?: string;
  expiresInMs: number;
  message?: string;
}

/**
 * Interface para resposta de renovação de token
 */
export interface CadsusTokenRenewResponse {
  success: boolean;
  message: string;
  hasToken: boolean;
  isValid: boolean;
  expiresAt?: string;
  expiresIn?: string;
}

/**
 * Serviço de integração com CADSUS
 */
@Injectable({
  providedIn: 'root'
})
export class CadsusService {
  private readonly apiUrl = `${API_BASE_URL}/cadsus`;

  constructor(private http: HttpClient) {}

  /**
   * Consulta dados de um cidadão no CADSUS pelo CPF
   * @param cpf CPF do cidadão (com ou sem formatação)
   */
  consultarCpf(cpf: string): Observable<CadsusCidadao> {
    const cleanCpf = cpf.replace(/\D/g, '');
    return this.http.post<CadsusCidadao>(`${this.apiUrl}/consultar-cpf`, { cpf: cleanCpf });
  }

  /**
   * Obtém o status do token de autenticação
   */
  getTokenStatus(): Observable<CadsusTokenStatus> {
    return this.http.get<CadsusTokenStatus>(`${this.apiUrl}/token/status`);
  }

  /**
   * Força a renovação do token de autenticação
   */
  renewToken(): Observable<CadsusTokenRenewResponse> {
    return this.http.post<CadsusTokenRenewResponse>(`${this.apiUrl}/token/renew`, {});
  }

  /**
   * Formata CPF para exibição (XXX.XXX.XXX-XX)
   */
  formatCpf(cpf: string): string {
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return `${cleaned.substring(0, 3)}.${cleaned.substring(3, 6)}.${cleaned.substring(6, 9)}-${cleaned.substring(9)}`;
  }

  /**
   * Remove formatação do CPF
   */
  cleanCpf(cpf: string): string {
    return cpf.replace(/\D/g, '');
  }

  /**
   * Valida se o CPF tem 11 dígitos
   */
  isValidCpfFormat(cpf: string): boolean {
    return cpf.replace(/\D/g, '').length === 11;
  }
}
