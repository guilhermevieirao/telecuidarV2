import type { IconName } from '@shared/components/atoms/icon/icon';

export interface TabConfig {
  id: string;
  label: string;
  icon: IconName;
  roles: ('PATIENT' | 'PROFESSIONAL' | 'ADMIN')[];
  /** Se a tab deve aparecer na teleconsulta (modo de atendimento) */
  showInTeleconsultation: boolean;
  /** Se a tab deve aparecer nos detalhes da consulta (modo de visualização) */
  showInDetails: boolean;
  /** Ordem de exibição */
  order: number;
}

/**
 * Configuração centralizada de todas as tabs disponíveis.
 * Ao adicionar uma nova tab, adicione-a aqui e ela será automaticamente
 * incluída tanto na teleconsulta quanto nos detalhes da consulta.
 */
export const TELECONSULTATION_TABS: TabConfig[] = [
  {
    id: 'basic',
    label: 'Informações Básicas',
    icon: 'file',
    roles: ['PATIENT', 'PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: false, // Não mostra na teleconsulta, apenas nos detalhes
    showInDetails: true,
    order: 0
  },
  {
    id: 'patient-data',
    label: 'Dados do Paciente',
    icon: 'user',
    roles: ['PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: true,
    showInDetails: true,
    order: 1
  },
  {
    id: 'pre-consultation',
    label: 'Dados da Pré Consulta',
    icon: 'file',
    roles: ['PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: true,
    showInDetails: true,
    order: 2
  },
  {
    id: 'anamnesis',
    label: 'Anamnese',
    icon: 'book',
    roles: ['PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: true,
    showInDetails: true,
    order: 3
  },
  {
    id: 'specialty',
    label: 'Campos da Especialidade',
    icon: 'stethoscope',
    roles: ['PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: true,
    showInDetails: true,
    order: 4
  },
  {
    id: 'iot',
    label: 'IOT',
    icon: 'activity',
    roles: ['PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: false, // Aparece apenas nos detalhes
    showInDetails: true,
    order: 5
  },
  {
    id: 'biometrics',
    label: 'Biométricos',
    icon: 'heart',
    roles: ['PATIENT', 'PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: true,
    showInDetails: true,
    order: 6
  },
  {
    id: 'attachments',
    label: 'Chat Anexos',
    icon: 'camera',
    roles: ['PATIENT', 'PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: true,
    showInDetails: true,
    order: 7
  },
  {
    id: 'soap',
    label: 'SOAP',
    icon: 'book',
    roles: ['PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: true,
    showInDetails: true,
    order: 8
  },
  {
    id: 'receita',
    label: 'Receita',
    icon: 'file',
    roles: ['PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: true,
    showInDetails: true,
    order: 9
  },
  {
    id: 'ai',
    label: 'IA',
    icon: 'activity',
    roles: ['PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: true,
    showInDetails: true,
    order: 10
  },
  {
    id: 'return',
    label: 'Retorno',
    icon: 'calendar',
    roles: ['PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: true,
    showInDetails: false,
    order: 11
  },
  {
    id: 'conclusion',
    label: 'Concluir',
    icon: 'check',
    roles: ['PROFESSIONAL', 'ADMIN'],
    showInTeleconsultation: true,
    showInDetails: true,
    order: 12
  }
];

/**
 * Retorna as tabs disponíveis para a teleconsulta, filtradas por role
 */
export function getTeleconsultationTabs(role: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN'): TabConfig[] {
  return TELECONSULTATION_TABS
    .filter(tab => tab.showInTeleconsultation && tab.roles.includes(role))
    .sort((a, b) => a.order - b.order);
}

/**
 * Retorna as tabs disponíveis para a página de detalhes, filtradas por role
 */
export function getDetailsTabs(role: 'PATIENT' | 'PROFESSIONAL' | 'ADMIN'): TabConfig[] {
  return TELECONSULTATION_TABS
    .filter(tab => tab.showInDetails && tab.roles.includes(role))
    .sort((a, b) => a.order - b.order);
}

/**
 * Retorna todas as tabs disponíveis para a página de detalhes (sem filtro de role)
 */
export function getAllDetailsTabs(): TabConfig[] {
  return TELECONSULTATION_TABS
    .filter(tab => tab.showInDetails)
    .sort((a, b) => a.order - b.order);
}

/**
 * Mapeamento de id da tab para o nome usado na teleconsulta antiga
 */
export const TAB_ID_TO_LEGACY_NAME: Record<string, string> = {
  'patient-data': 'Dados do Paciente',
  'pre-consultation': 'Dados da Pré Consulta',
  'anamnesis': 'Anamnese',
  'specialty': 'Campos da Especialidade',
  'biometrics': 'Biométricos',
  'attachments': 'Chat Anexos',
  'soap': 'SOAP',
  'receita': 'Receita',
  'ai': 'IA',
  'return': 'Retorno',
  'conclusion': 'Concluir'
};

/**
 * Mapeamento inverso: nome legacy para id
 */
export const LEGACY_NAME_TO_TAB_ID: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_ID_TO_LEGACY_NAME).map(([id, name]) => [name, id])
);
