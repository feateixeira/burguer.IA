/**
 * Normaliza número de telefone brasileiro para formato E.164
 * @param phone - Número de telefone em qualquer formato
 * @returns Número no formato E.164 (ex: 5561999999999)
 */
export function normalizePhoneBRToE164(phone: string): string {
  if (!phone) return '';

  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, '');

  // Se vazio após limpar, retorna vazio
  if (!digits) return '';

  // Remove zeros iniciais
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Se começa com 55 (código do Brasil), mantém
  if (digits.startsWith('55')) {
    // Se tem menos de 12 dígitos (55 + DDD + número incompleto), pode estar faltando
    if (digits.length < 12) {
      // Se tem 55 + DDD (2 dígitos) + número (8 ou 9 dígitos)
      // 55 + 2 + 8 = 13 (mínimo) ou 55 + 2 + 9 = 14 (máximo)
      // Se tem menos de 13, pode estar faltando o 9 do celular
      if (digits.length === 11) {
        // 55 + DDD (2) + número (8) = adicionar 9
        digits = digits.substring(0, 4) + '9' + digits.substring(4);
      }
    }
    return digits;
  }

  // Se não começa com 55, precisa adicionar
  // Se tem 10 dígitos (DDD + número fixo) ou 11 dígitos (DDD + celular com 9)
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }

  // Se tem menos de 10 dígitos, pode estar incompleto
  // Tenta adicionar 55 e assumir que é um número válido
  if (digits.length >= 8 && digits.length < 10) {
    // Pode estar faltando DDD, assume DDD 11 (São Paulo) como padrão
    return '5511' + digits;
  }

  // Retorna como está se não conseguir normalizar
  return '55' + digits;
}

/**
 * Formata telefone para exibição (XX) XXXXX-XXXX
 */
export function formatPhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 11) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`;
  }
  
  if (digits.length === 10) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
  }
  
  return phone;
}

/**
 * Aplica máscara de telefone durante digitação
 */
export function phoneMask(value: string): string {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : digits;
  }
  
  if (digits.length <= 7) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2)}`;
  }
  
  if (digits.length <= 10) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
  }
  
  return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7, 11)}`;
}

