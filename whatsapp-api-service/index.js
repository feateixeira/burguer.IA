import express from 'express';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Carregar variáveis de ambiente
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Armazenamento de sessões em memória
// Estrutura: { clientId: { client: Client, qrCode: string, status: 'connecting' | 'ready' | 'disconnected' } }
const sessions = {};

/**
 * Formata o número de telefone para o formato do WhatsApp
 * @param {string} phone - Número de telefone (ex: "5511999999999" ou "11999999999")
 * @returns {string} - Número formatado com @c.us
 */
function formatPhoneNumber(phone) {
  // Remove caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Se não começar com código do país, assume Brasil (55)
  if (!cleaned.startsWith('55') && cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  
  // Adiciona sufixo @c.us se não tiver
  if (!cleaned.includes('@')) {
    cleaned = cleaned + '@c.us';
  }
  
  return cleaned;
}

/**
 * Inicializa uma sessão do WhatsApp para um clientId específico
 * @param {string} clientId - ID único do cliente (ex: 'loja_01')
 * @returns {Promise<{qrCode?: string, status: string, message: string}>}
 */
async function initializeSession(clientId) {
  return new Promise((resolve, reject) => {
    // Se já existe uma sessão ativa, retorna status
    if (sessions[clientId] && sessions[clientId].status === 'ready') {
      console.log(`[${clientId}] Sessão já está pronta`);
      return resolve({
        status: 'ready',
        message: 'Sessão pronta'
      });
    }

    // Se já está conectando, retorna status de conexão
    if (sessions[clientId] && sessions[clientId].status === 'connecting') {
      console.log(`[${clientId}] Sessão já está em processo de conexão`);
      return resolve({
        status: 'connecting',
        message: 'Sessão em processo de conexão',
        qrCode: sessions[clientId].qrCode
      });
    }

    console.log(`[${clientId}] Inicializando nova sessão...`);

    // Cria o diretório de sessão baseado no clientId
    const sessionPath = join(__dirname, '.wwebjs_auth', clientId);

    // Cria nova instância do cliente
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: clientId,
        dataPath: sessionPath
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    // Armazena a sessão com status 'connecting'
    sessions[clientId] = {
      client: client,
      qrCode: null,
      status: 'connecting'
    };

    // Evento: QR Code gerado
    client.on('qr', async (qr) => {
      console.log(`[${clientId}] QR Code gerado`);
      
      try {
        // Gera QR Code em base64
        const qrCodeBase64 = await qrcode.toDataURL(qr);
        sessions[clientId].qrCode = qrCodeBase64;
        console.log(`[${clientId}] QR Code convertido para base64`);
      } catch (error) {
        console.error(`[${clientId}] Erro ao gerar QR Code em base64:`, error);
        sessions[clientId].qrCode = qr; // Fallback: retorna QR como string
      }
    });

    // Evento: Cliente autenticado e pronto
    client.on('ready', () => {
      console.log(`[${clientId}] ✅ Cliente conectado e pronto!`);
      sessions[clientId].status = 'ready';
      sessions[clientId].qrCode = null; // Limpa QR Code após conexão
    });

    // Evento: Cliente desconectado
    client.on('disconnected', (reason) => {
      console.log(`[${clientId}] ❌ Cliente desconectado. Motivo: ${reason}`);
      sessions[clientId].status = 'disconnected';
      
      // Limpa a sessão após desconexão
      delete sessions[clientId];
    });

    // Evento: Erro de autenticação
    client.on('auth_failure', (msg) => {
      console.error(`[${clientId}] ❌ Falha na autenticação:`, msg);
      sessions[clientId].status = 'disconnected';
      delete sessions[clientId];
      reject(new Error(`Falha na autenticação: ${msg}`));
    });

    // Evento: Erro geral
    client.on('error', (error) => {
      console.error(`[${clientId}] ❌ Erro no cliente:`, error);
    });

    // Inicializa o cliente
    client.initialize().catch((error) => {
      console.error(`[${clientId}] ❌ Erro ao inicializar cliente:`, error);
      delete sessions[clientId];
      reject(error);
    });

    // Resolve após um pequeno delay para permitir que o QR seja gerado
    setTimeout(() => {
      if (sessions[clientId] && sessions[clientId].qrCode) {
        resolve({
          status: 'qr',
          message: 'QR Code gerado. Escaneie com o WhatsApp.',
          qrCode: sessions[clientId].qrCode
        });
      } else if (sessions[clientId] && sessions[clientId].status === 'ready') {
        resolve({
          status: 'ready',
          message: 'Sessão pronta'
        });
      } else {
        resolve({
          status: 'connecting',
          message: 'Aguardando conexão...'
        });
      }
    }, 2000);
  });
}

/**
 * Envia uma mensagem via WhatsApp
 * @param {string} clientId - ID do cliente
 * @param {string} phone - Número de telefone
 * @param {string} message - Mensagem a ser enviada
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendMessage(clientId, phone, message) {
  // Verifica se a sessão existe
  if (!sessions[clientId]) {
    throw new Error(`Sessão não encontrada para o clientId: ${clientId}`);
  }

  // Verifica se a sessão está pronta
  if (sessions[clientId].status !== 'ready') {
    throw new Error(`Sessão não está pronta. Status atual: ${sessions[clientId].status}`);
  }

  const client = sessions[clientId].client;
  const formattedPhone = formatPhoneNumber(phone);

  try {
    console.log(`[${clientId}] Enviando mensagem para ${formattedPhone}`);
    const result = await client.sendMessage(formattedPhone, message);
    console.log(`[${clientId}] ✅ Mensagem enviada com sucesso. ID: ${result.id._serialized}`);
    
    return {
      success: true,
      messageId: result.id._serialized,
      message: 'Mensagem enviada com sucesso'
    };
  } catch (error) {
    console.error(`[${clientId}] ❌ Erro ao enviar mensagem:`, error);
    throw new Error(`Erro ao enviar mensagem: ${error.message}`);
  }
}

// ==================== ENDPOINTS DA API ====================

/**
 * POST /start-session
 * Inicia uma sessão do WhatsApp para um clientId
 */
app.post('/start-session', async (req, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'clientId é obrigatório e deve ser uma string'
      });
    }

    console.log(`[API] Iniciando sessão para clientId: ${clientId}`);
    const result = await initializeSession(clientId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[API] Erro ao iniciar sessão:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao iniciar sessão'
    });
  }
});

/**
 * POST /send-message
 * Envia uma mensagem via WhatsApp
 */
app.post('/send-message', async (req, res) => {
  try {
    const { clientId, phone, message } = req.body;

    // Validações
    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'clientId é obrigatório e deve ser uma string'
      });
    }

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'phone é obrigatório e deve ser uma string'
      });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'message é obrigatório e deve ser uma string'
      });
    }

    console.log(`[API] Enviando mensagem - clientId: ${clientId}, phone: ${phone}`);
    const result = await sendMessage(clientId, phone, message);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[API] Erro ao enviar mensagem:', error);
    
    // Erro 400 para sessão não encontrada ou não pronta
    if (error.message.includes('não encontrada') || error.message.includes('não está pronta')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Erro 500 para outros erros
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar mensagem'
    });
  }
});

/**
 * GET /status/:clientId
 * Retorna o status da sessão de um clientId específico
 */
app.get('/status/:clientId', (req, res) => {
  const { clientId } = req.params;

  if (!sessions[clientId]) {
    return res.json({
      success: true,
      clientId: clientId,
      status: 'not_found',
      message: 'Sessão não encontrada. Use POST /start-session para iniciar.'
    });
  }

  const session = sessions[clientId];
  const response = {
    success: true,
    clientId: clientId,
    status: session.status,
    message: session.status === 'ready' 
      ? 'Sessão conectada e pronta para enviar mensagens'
      : session.status === 'connecting'
      ? 'Sessão em processo de conexão'
      : 'Sessão desconectada'
  };

  // Se está aguardando QR Code, inclui o QR Code na resposta
  if (session.status === 'connecting' && session.qrCode) {
    response.qrCode = session.qrCode;
  }

  res.json(response);
});

/**
 * GET /sessions
 * Lista todas as sessões ativas (útil para debug)
 */
app.get('/sessions', (req, res) => {
  const activeSessions = Object.keys(sessions).map(clientId => ({
    clientId: clientId,
    status: sessions[clientId].status
  }));

  res.json({
    success: true,
    total: activeSessions.length,
    sessions: activeSessions
  });
});

/**
 * DELETE /session/:clientId
 * Encerra e remove uma sessão específica
 */
app.delete('/session/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!sessions[clientId]) {
      return res.status(404).json({
        success: false,
        error: 'Sessão não encontrada'
      });
    }

    const client = sessions[clientId].client;
    
    // Logout e destruição do cliente
    await client.logout();
    await client.destroy();
    
    // Remove da memória
    delete sessions[clientId];

    console.log(`[${clientId}] Sessão encerrada e removida`);
    
    res.json({
      success: true,
      message: 'Sessão encerrada com sucesso'
    });
  } catch (error) {
    console.error('[API] Erro ao encerrar sessão:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao encerrar sessão'
    });
  }
});

/**
 * GET /health
 * Endpoint de health check
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    timestamp: new Date().toISOString(),
    activeSessions: Object.keys(sessions).length
  });
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp API Service rodando na porta ${PORT}`);
  console.log(`📡 Endpoints disponíveis:`);
  console.log(`   POST   /start-session`);
  console.log(`   POST   /send-message`);
  console.log(`   GET    /status/:clientId`);
  console.log(`   GET    /sessions`);
  console.log(`   DELETE /session/:clientId`);
  console.log(`   GET    /health`);
  console.log(`\n💡 Use POST /start-session para iniciar uma nova sessão`);
});
