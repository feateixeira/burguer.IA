import QRCode from 'qrcode';

/**
 * Gera o payload PIX no formato EMV (padrão brasileiro)
 * Implementação idêntica à que funcionava no PixPaymentModal
 * 
 * IMPORTANTE: Para chaves de telefone, o padrão PIX requer apenas dígitos (sem o +)
 * Formato E.164 para armazenamento: +5511999999999
 * Formato para payload PIX: 5511999999999 (sem o +)
 */
export const generatePixPayload = (key: string, name: string, amount: number): string => {
  if (!key || !key.trim()) {
    throw new Error('Chave PIX não pode estar vazia');
  }

  // Sanitizar nome (máximo 25 caracteres, apenas alfanuméricos e espaços)
  const sanitizedName = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove caracteres especiais
    .slice(0, 25)
    .trim()
    .toUpperCase();

  if (!sanitizedName) {
    throw new Error('Nome do estabelecimento inválido');
  }

  if (amount <= 0 || amount > 999999.99) {
    throw new Error('Valor inválido');
  }

  const amountStr = amount.toFixed(2);
  // Para chaves de telefone, remover o + do formato E.164 (o padrão PIX requer apenas dígitos)
  // Exemplo: +5511999999999 -> 5511999999999
  let cleanKey = key.trim();
  if (cleanKey.startsWith('+')) {
    cleanKey = cleanKey.substring(1);
  }
  
  // Validar que a chave não está vazia após limpeza
  if (!cleanKey) {
    throw new Error('Chave PIX inválida após normalização');
  }

  const tag = (id: string, value: string) => `${id}${value.length.toString().padStart(2, '0')}${value}`;

  // Merchant Account Information (ID 26)
  const gui = tag('00', 'br.gov.bcb.pix');
  const keyField = tag('01', cleanKey);
  const mai = tag('26', `${gui}${keyField}`);

  // Additional Data (ID 62) - Reference label
  const additional = tag('62', tag('05', '***'));

  // Build payload without CRC (ID 63)
  const payloadNoCRC = [
    tag('00', '01'), // Payload format indicator
    tag('01', '11'), // POI Method (static)
    mai,
    tag('52', '0000'), // Merchant Category Code
    tag('53', '986'), // Currency BRL
    tag('54', amountStr), // Amount
    tag('58', 'BR'), // Country Code
    tag('59', sanitizedName), // Merchant Name
    tag('60', 'SAO PAULO'), // Merchant City (fallback)
    additional,
    '6304', // CRC placeholder
  ].join('');

  // CRC16-CCITT (False) - EXATAMENTE como estava no código que funcionava
  const crc16 = (str: string) => {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
        else crc <<= 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  };

  const crc = crc16(payloadNoCRC);
  // EXATAMENTE como estava: adiciona o CRC no final (não substitui o placeholder)
  return payloadNoCRC + crc;
};

/**
 * Gera o QR code PIX como data URL (imagem base64)
 */
export const generatePixQrCode = async (key: string, name: string, amount: number): Promise<string> => {
  try {
    // Log para debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      console.log('Gerando QR code PIX:', { key: key.substring(0, 5) + '...', name, amount });
    }
    
    const pixPayload = generatePixPayload(key, name, amount);
    
    // Log do payload (apenas primeiros caracteres para não expor dados sensíveis)
    if (process.env.NODE_ENV === 'development') {
      console.log('Payload PIX gerado (primeiros 50 chars):', pixPayload.substring(0, 50) + '...');
    }
    
    const qrUrl = await QRCode.toDataURL(pixPayload, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrUrl;
  } catch (error: any) {
    console.error('Error generating PIX QR code:', error);
    console.error('Detalhes:', { key: key?.substring(0, 10) + '...', name, amount, message: error?.message });
    throw new Error(`Erro ao gerar QR code PIX: ${error?.message || 'Erro desconhecido'}`);
  }
};

