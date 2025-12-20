import QRCode from 'qrcode';
import { normalizePhoneBRToE164 } from './phoneNormalizer';

/**
 * Classe utilitária para gerar payload PIX seguindo o padrão EMV QRCPS-MPM.
 * Referência: Manual de Padrões para Iniciação do PIX - Banco Central do Brasil.
 */
class PixPayload {
  private merchantName: string;
  private merchantCity: string;
  private pixKey: string;
  private amount: string;
  private txId: string;

  constructor(key: string, name: string, city: string = 'SAO PAULO', amount: number = 0, txId: string = '***') {
    this.merchantName = this.formatString(name, 25) || 'ESTABELECIMENTO';
    this.merchantCity = this.formatString(city, 15) || 'SAO PAULO';
    this.pixKey = this.normalizeKey(key);
    this.amount = amount.toFixed(2);
    this.txId = txId;
  }

  /**
   * Remove acentos e caracteres especiais, converte para maiúsculas e limita tamanho
   */
  private formatString(value: string, maxLength: number): string {
    if (!value) return '';
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .toUpperCase()
      .substring(0, maxLength)
      .trim();
  }

  /**
   * Normaliza a chave PIX, especificamente para telefones
   */
  private normalizeKey(key: string): string {
    if (!key) return '';

    let cleanKey = key.trim();

    // Tenta detectar se é telefone pelo formato (apenas dígitos ou contém +)
    // Se tiver caracteres de formatação de telefone ( ) - ou começar com +, ou ter 10-14 dígitos
    const isLikelyPhone =
      /^[0-9()-\s+]+$/.test(cleanKey) && // Apenas caracteres de telefone
      (/[()-\s]/.test(cleanKey) || cleanKey.startsWith('+') || (cleanKey.length >= 10 && cleanKey.length <= 14));

    if (isLikelyPhone) {
      // Remove tudo que não é dígito para análise
      const digits = cleanKey.replace(/\D/g, '');

      // Se parece ser um telefone (tem entre 10 e 14 dígitos, ou começa com 55 e tem tamanho ok)
      // A função normalizePhoneBRToE164 lida com a lógica de adicionar 55 e 9 dígitos
      const normalized = normalizePhoneBRToE164(cleanKey);

      // Se a normalização funcionar, retornamos sem o + (padrão do payload PIX para telefone é apenas dígitos??
      // NÃO! O padrão para telefone no Dict é +55... mas no payload EMV o campo 01 aceita string.
      // O manual diz: Key (Chave) pode ser email, CPF/CNPJ, ou telefone (com + e código país).

      // IMPORTANTE: A implementação anterior adicionava '+' manualmente. Vamos manter isso se normalizado.
      if (normalized) {
        return `+${normalized}`; // E164 completo: +5511999999999
      }
    }

    // Se não for telefone ou falhar normalização, retorna limpo básico (sem espaços)
    return cleanKey;
  }

  private generateTag(id: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  }

  private getCRC16(payload: string): string {
    let crc = 0xFFFF;
    const polynomial = 0x1021;

    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = (crc << 1) ^ polynomial;
        } else {
          crc = crc << 1;
        }
      }
    }

    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  }

  public toString(): string {
    const payload = [
      this.generateTag('00', '01'), // Payload Format Indicator
      this.generateTag('01', '11'), // Point of Initiation Method (11 = Static)
      this.generateTag('26', // Merchant Account Information
        [
          this.generateTag('00', 'br.gov.bcb.pix'), // GUI
          this.generateTag('01', this.pixKey),      // Chave
        ].join('')
      ),
      this.generateTag('52', '0000'), // Merchant Category Code
      this.generateTag('53', '986'),  // Transaction Currency (BRL)
      this.generateTag('54', this.amount), // Transaction Amount
      this.generateTag('58', 'BR'),   // Country Code
      this.generateTag('59', this.merchantName), // Merchant Name
      this.generateTag('60', this.merchantCity), // Merchant City
      this.generateTag('62', // Additional Data Field Template
        this.generateTag('05', this.txId) // Reference Label
      ),
      '6304' // CRC16 (ID + Length)
    ].join('');

    return `${payload}${this.getCRC16(payload)}`;
  }
}

/**
 * Função exportada para manter compatibilidade com o código existente.
 */
export const generatePixPayload = (key: string, name: string, amount: number): string => {
  const pix = new PixPayload(key, name, 'SAO PAULO', amount);
  const payload = pix.toString();

  if (process.env.NODE_ENV === 'development') {
    console.log('--- PIX GENERATED ---');
    console.log('Input Key:', key);
    console.log('Result Key:', (pix as any).pixKey); // Hack to view private for debug
    console.log('Payload:', payload);
  }

  return payload;
};

/**
 * Gera o QR code PIX como data URL (imagem base64)
 */
export const generatePixQrCode = async (key: string, name: string, amount: number): Promise<string> => {
  try {
    const pixPayload = generatePixPayload(key, name, amount);

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
    throw new Error(`Erro ao gerar QR code PIX: ${error?.message || 'Erro desconhecido'}`);
  }
};
