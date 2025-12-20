/**
 * Normaliza número de telefone brasileiro para formato E.164
 * @param phone - Número de telefone em qualquer formato
 * @returns Número no formato E.164 (ex: 5511999999999) - SEM o sinal +
 */
export function normalizePhoneBRToE164(phone: string): string {
  if (!phone) return '';

  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, '');

  // Se vazio após limpar, retorna vazio
  if (!digits) return '';

  // Remove zeros iniciais (pode ter zeros extras)
  while (digits.startsWith('0') && digits.length > 1) {
    digits = digits.substring(1);
  }

  // Se começa com 55 (código do Brasil), verifica se está completo
  if (digits.startsWith('55')) {
    // Número completo: 55 + DDD (2) + número (9 ou 10 dígitos)
    // Mínimo: 55 + 2 + 8 = 13 dígitos (fixo)
    // Máximo: 55 + 2 + 9 = 14 dígitos (celular)
    
    if (digits.length === 13) {
      // 55 + DDD + 8 dígitos (fixo) - OK
      return digits;
    } else if (digits.length === 14) {
      // 55 + DDD + 9 dígitos (celular) - OK
      return digits;
    } else if (digits.length === 12) {
      // 55 + DDD (2) + 8 dígitos sem o 9 inicial do celular
      // Adiciona o 9 após o DDD
      return digits.substring(0, 4) + '9' + digits.substring(4);
    } else if (digits.length === 11) {
      // 55 + DDD (2) + 8 dígitos (fixo) - pode estar faltando um dígito
      // Ou pode ser 55 + DDD (2) + número incompleto
      // Tenta adicionar o 9 do celular
      if (digits.substring(2, 3) !== '9') {
        return digits.substring(0, 4) + '9' + digits.substring(4);
      }
      return digits;
    } else if (digits.length < 12) {
      // Muito curto, pode estar incompleto
      // Retorna como está, mas pode não ser válido
      return digits;
    }
    
    // Se tem mais de 14 dígitos, pode ter zeros extras ou formatação incorreta
    // Retorna os primeiros 14 dígitos
    return digits.substring(0, 14);
  }

  // Se não começa com 55, precisa adicionar
  // Se tem 10 dígitos (DDD + número fixo)
  if (digits.length === 10) {
    return '55' + digits;
  }
  
  // Se tem 11 dígitos (DDD + celular com 9)
  if (digits.length === 11) {
    // Verifica se o terceiro dígito é 9 (indicando celular)
    if (digits[2] === '9') {
      return '55' + digits;
    } else {
      // Pode ser um número fixo com formatação diferente
      return '55' + digits;
    }
  }

  // Se tem 8 ou 9 dígitos, pode estar faltando o DDD
  // Assume DDD 11 (São Paulo) como padrão
  if (digits.length >= 8 && digits.length <= 9) {
    // Se tem 8 dígitos, adiciona 9 no início (celular)
    if (digits.length === 8) {
      return '55119' + digits;
    }
    // Se tem 9 dígitos, já tem o 9 do celular
    return '5511' + digits;
  }

  // Se tem menos de 8 dígitos, número muito curto
  if (digits.length < 8) {
    return '';
  }

  // Para outros casos, adiciona 55 e retorna
  // Mas valida o tamanho mínimo
  if (digits.length >= 10) {
    return '55' + digits;
  }

  // Se chegou aqui, número inválido ou incompleto
  return '';
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

