// Regex patterns for validation
export const VALIDATION_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  CPF: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  PHONE: /^\(\d{2}\)\s\d{4,5}-\d{4}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  NAME: /^[a-zA-ZÀ-ÿ\s]{2,}$/,
} as const;

// Validation messages
export const VALIDATION_MESSAGES = {
  REQUIRED: 'Este campo é obrigatório',
  EMAIL: 'Email inválido',
  CPF: 'CPF inválido',
  PHONE: 'Telefone inválido',
  PASSWORD_WEAK: 'A senha deve ter no mínimo 8 caracteres, incluindo maiúsculas, minúsculas, números e caracteres especiais',
  PASSWORD_MIN_LENGTH: 'A senha deve ter no mínimo 8 caracteres',
  PASSWORD_MATCH: 'As senhas não coincidem',
  NAME: 'Nome deve conter apenas letras',
  NAME_MIN_LENGTH: 'Nome deve ter no mínimo 2 caracteres',
  TERMS_REQUIRED: 'Você deve aceitar os termos de uso',
  MIN_LENGTH: (length: number) => `Mínimo de ${length} caracteres`,
  MAX_LENGTH: (length: number) => `Máximo de ${length} caracteres`,
} as const;

// API endpoints
const API_BASE_URL = (typeof process !== 'undefined' && process.env?.['API_URL']) 
  ? process.env['API_URL']
  : 'http://localhost:5239/api';

export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  LOGOUT: `${API_BASE_URL}/auth/logout`,
  REFRESH_TOKEN: `${API_BASE_URL}/auth/refresh-token`,
  FORGOT_PASSWORD: `${API_BASE_URL}/auth/forgot-password`,
  RESET_PASSWORD: `${API_BASE_URL}/auth/reset-password`,
  VERIFY_EMAIL: `${API_BASE_URL}/auth/verify-email`,
  RESEND_VERIFICATION: `${API_BASE_URL}/auth/resend-verification`,
  CHANGE_PASSWORD: `${API_BASE_URL}/auth/change-password`,
  GOOGLE_LOGIN: `${API_BASE_URL}/auth/google`,
  CHECK_EMAIL: `${API_BASE_URL}/auth/check-email`,
  CHECK_CPF: `${API_BASE_URL}/auth/check-cpf`,
  CHECK_PHONE: `${API_BASE_URL}/auth/check-phone`,
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  REMEMBER_ME: 'remember_me',
} as const;

// Form field lengths
export const FIELD_LENGTHS = {
  NAME: { min: 2, max: 50 },
  EMAIL: { min: 5, max: 100 },
  PASSWORD: { min: 8, max: 50 },
  CPF: { exact: 14 }, // with mask: 000.000.000-00
  PHONE: { exact: 15 }, // with mask: (00) 00000-0000
} as const;

// Export as single object for easier importing
export const AUTH_CONSTANTS = {
  VALIDATION_PATTERNS,
  VALIDATION_MESSAGES,
  AUTH_ENDPOINTS,
  STORAGE_KEYS,
  FIELD_LENGTHS
} as const;
