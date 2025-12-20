import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QrCode, CheckCircle, AlertCircle, Loader2, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import QRCode from 'qrcode';
import { useNavigate } from 'react-router-dom';
import { normalizePhoneBRToE164 } from '@/utils/phoneNormalizer';
import { generatePixPayload } from '@/utils/pixQrCode';

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  amount: number;
  onPaymentConfirmed: () => void;
}

export const PixPaymentModal = ({ open, onClose, orderId, amount, onPaymentConfirmed }: PixPaymentModalProps) => {
  const navigate = useNavigate();
  const [pixKey, setPixKey] = useState<string>('');
  const [pixKeyType, setPixKeyType] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'failed'>('pending');
  const [loading, setLoading] = useState(true);
  const [pixPaymentId, setPixPaymentId] = useState<string>('');
  const [pixNotConfigured, setPixNotConfigured] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset states when modal opens
      setPixNotConfigured(false);
      setLoading(true);
      setPaymentStatus('pending');
      setQrCodeUrl('');
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
        setPixNotConfigured(true);
        setLoading(false);
        return;
      }

      setPixNotConfigured(false);

      // Normalizar chave PIX se for telefone
      let normalizedPixKey = establishment.pix_key_value;
      const type = establishment.pix_key_type?.toLowerCase().trim() || '';
      if (['phone', 'celular', 'telefone', 'tel'].includes(type) && normalizedPixKey) {
        // Sempre normalizar para garantir apenas dígitos (remove formatação e garante +55)
        const normalized = normalizePhoneBRToE164(normalizedPixKey);
        if (normalized) {
          normalizedPixKey = `+${normalized}`;
        }
      }

      setPixKey(normalizedPixKey);
      setPixKeyType(establishment.pix_key_type);

      // Gerar QR Code PIX
      try {
        const pixPayload = generatePixPayload(
          normalizedPixKey,
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

    switch (type.toLowerCase()) {
      case 'cpf': {
        const cleanKey = key.replace(/\D/g, '');
        return /^\d{11}$/.test(cleanKey);
      }
      case 'cnpj': {
        const cleanKey = key.replace(/\D/g, '');
        return /^\d{14}$/.test(cleanKey);
      }
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key.trim());
      case 'phone': {
        // Aceita telefone no formato E.164 (+55XXXXXXXXXXX) ou formato brasileiro (XX) XXXXX-XXXX
        // Remove caracteres não numéricos exceto +
        const cleanKey = key.replace(/[^\d+]/g, '');
        // Se começa com +, deve ter +55 seguido de 11 dígitos (total 13 dígitos após +55)
        if (cleanKey.startsWith('+')) {
          const digits = cleanKey.substring(1).replace(/\D/g, '');
          return digits.startsWith('55') && (digits.length === 13 || digits.length === 12);
        }
        // Se não começa com +, aceita 10 ou 11 dígitos (será normalizado depois)
        const digits = cleanKey.replace(/\D/g, '');
        return digits.length === 10 || digits.length === 11;
      }
      case 'random':
        return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key);
      default:
        return false;
    }
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
          ) : pixNotConfigured ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium mb-1">Configure a chave PIX por segurança</p>
                    <p className="text-sm">
                      Para processar pagamentos via PIX, é necessário configurar uma chave PIX nas configurações do estabelecimento.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      navigate('/settings?tab=pix');
                      onClose();
                    }}
                    className="w-full"
                    variant="default"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Ir para Configurações
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
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
