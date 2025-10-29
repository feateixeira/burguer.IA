import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QrCode, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import QRCode from 'qrcode';

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  amount: number;
  onPaymentConfirmed: () => void;
}

export const PixPaymentModal = ({ open, onClose, orderId, amount, onPaymentConfirmed }: PixPaymentModalProps) => {
  const [pixKey, setPixKey] = useState<string>('');
  const [pixKeyType, setPixKeyType] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'failed'>('pending');
  const [loading, setLoading] = useState(true);
  const [pixPaymentId, setPixPaymentId] = useState<string>('');

  useEffect(() => {
    if (open) {
      loadPixKey();
    }
  }, [open]);

  const loadPixKey = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('establishment_id')
        .eq('user_id', session.user.id)
        .single();

      if (!profile) return;

      const { data: establishment } = await supabase
        .from('establishments')
        .select('pix_key_value, pix_key_type, pix_holder_name, pix_bank_name')
        .eq('id', profile.establishment_id)
        .single();

      if (!establishment?.pix_key_value) {
        toast.error('Chave PIX não configurada');
        onClose();
        return;
      }

      setPixKey(establishment.pix_key_value);
      setPixKeyType(establishment.pix_key_type);

      // Gerar QR Code PIX
      try {
        const pixPayload = generatePixPayload(
          establishment.pix_key_value,
          establishment.pix_holder_name || 'Estabelecimento',
          amount
        );
        
        const qrUrl = await QRCode.toDataURL(pixPayload);
        setQrCodeUrl(qrUrl);
        
        // Criar registro de pagamento PIX
        const { data: pixPayment, error } = await supabase
          .from('pix_payments')
          .insert({
            establishment_id: profile.establishment_id,
            order_id: orderId,
            amount,
            status: 'pending',
          })
          .select()
          .single();

        if (error) throw error;
        if (pixPayment) setPixPaymentId(pixPayment.id);
      } catch (error: any) {
        console.error('Error generating PIX:', error);
        toast.error('Erro ao gerar PIX');
        onClose();
        return;
      }

    } catch (error) {
      console.error('Error loading PIX key:', error);
      toast.error('Erro ao carregar chave PIX');
    } finally {
      setLoading(false);
    }
  };

  const validatePixKey = (key: string, type: string): boolean => {
    if (!key || !type) return false;
    
    // Remove caracteres especiais
    const cleanKey = key.replace(/[^\w@.-]/g, '');
    
    switch (type.toLowerCase()) {
      case 'cpf':
        return /^\d{11}$/.test(cleanKey);
      case 'cnpj':
        return /^\d{14}$/.test(cleanKey);
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanKey);
      case 'phone':
        return /^\d{10,11}$/.test(cleanKey);
      case 'random':
        return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(cleanKey);
      default:
        return false;
    }
  };

  const generatePixPayload = (key: string, name: string, amount: number): string => {
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
    const cleanKey = key.trim();

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

    // CRC16-CCITT (False)
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
    return payloadNoCRC + crc;
  };
  const confirmPayment = async () => {
    try {
      if (!pixPaymentId) {
        toast.error('ID de pagamento não encontrado');
        return;
      }

      const { error: pixError } = await supabase
        .from('pix_payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', pixPaymentId);

      if (pixError) throw pixError;

      // Atualizar pedido
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          payment_status: 'paid',
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      setPaymentStatus('paid');
      toast.success('Pagamento confirmado!');
      
      setTimeout(() => {
        onPaymentConfirmed();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Erro ao confirmar pagamento');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Pagamento via PIX
          </DialogTitle>
          <DialogDescription>
            Valor: R$ {amount.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : paymentStatus === 'paid' ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Pagamento confirmado com sucesso!
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex flex-col items-center space-y-4">
                {qrCodeUrl && (
                  <img src={qrCodeUrl} alt="QR Code PIX" className="w-64 h-64 border-2 border-border rounded-lg" />
                )}
                
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2 text-sm">
                      <div><strong>Chave PIX:</strong> {pixKey}</div>
                      <div><strong>Tipo:</strong> {pixKeyType?.toUpperCase()}</div>
                      <div className="text-muted-foreground mt-2">
                        Escaneie o QR Code ou use a chave PIX para realizar o pagamento
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Atenção: Não altere manualmente a chave PIX. Todas as transações são monitoradas e registradas.
                  </AlertDescription>
                </Alert>
              </div>

              <div className="flex gap-2">
                <Button onClick={confirmPayment} className="flex-1">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Pagamento
                </Button>
                <Button onClick={onClose} variant="outline" className="flex-1">
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
