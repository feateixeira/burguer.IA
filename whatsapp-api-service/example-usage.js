/**
 * Exemplo de uso da WhatsApp API Service
 * 
 * Este arquivo demonstra como usar a API para:
 * 1. Iniciar uma sessão
 * 2. Verificar o status até estar pronto
 * 3. Enviar uma mensagem
 */

const API_BASE_URL = 'http://localhost:3000';

/**
 * Aguarda até que a sessão esteja pronta
 */
async function waitForSessionReady(clientId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${API_BASE_URL}/status/${clientId}`);
    const data = await response.json();
    
    if (data.status === 'ready') {
      console.log(`✅ Sessão ${clientId} está pronta!`);
      return true;
    }
    
    if (data.status === 'qr' && data.qrCode) {
      console.log(`📱 QR Code disponível. Escaneie com o WhatsApp.`);
      // Aqui você pode exibir o QR Code em uma interface
      // Por exemplo: <img src={data.qrCode} />
    }
    
    console.log(`⏳ Aguardando conexão... (tentativa ${i + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.error(`❌ Timeout: Sessão não ficou pronta em ${maxAttempts * 2} segundos`);
  return false;
}

/**
 * Exemplo completo de uso
 */
async function exemploCompleto() {
  const clientId = 'loja_01';
  const phone = '5511999999999'; // Substitua pelo número real
  const message = 'Seu lanche saiu para entrega! 🍔';

  try {
    // 1. Iniciar sessão
    console.log(`\n🚀 Iniciando sessão para ${clientId}...`);
    const startResponse = await fetch(`${API_BASE_URL}/start-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId })
    });

    const startData = await startResponse.json();
    
    if (!startData.success) {
      console.error('❌ Erro ao iniciar sessão:', startData.error);
      return;
    }

    if (startData.status === 'ready') {
      console.log('✅ Sessão já estava pronta!');
    } else if (startData.qrCode) {
      console.log('📱 QR Code gerado. Escaneie com o WhatsApp.');
      // Em uma aplicação real, você exibiria o QR Code aqui
      // Por exemplo: mostrar imagem base64 em uma interface
    }

    // 2. Aguardar até a sessão estar pronta
    const isReady = await waitForSessionReady(clientId);
    if (!isReady) {
      return;
    }

    // 3. Enviar mensagem
    console.log(`\n📤 Enviando mensagem para ${phone}...`);
    const sendResponse = await fetch(`${API_BASE_URL}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        phone,
        message
      })
    });

    const sendData = await sendResponse.json();
    
    if (sendData.success) {
      console.log('✅ Mensagem enviada com sucesso!');
      console.log(`   ID da mensagem: ${sendData.messageId}`);
    } else {
      console.error('❌ Erro ao enviar mensagem:', sendData.error);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

/**
 * Exemplo: Verificar status de uma sessão
 */
async function verificarStatus(clientId) {
  const response = await fetch(`${API_BASE_URL}/status/${clientId}`);
  const data = await response.json();
  
  console.log(`Status da sessão ${clientId}:`, data);
  return data;
}

/**
 * Exemplo: Listar todas as sessões ativas
 */
async function listarSessoes() {
  const response = await fetch(`${API_BASE_URL}/sessions`);
  const data = await response.json();
  
  console.log('Sessões ativas:', data);
  return data;
}

// Executar exemplo (descomente para testar)
// exemploCompleto();

// Exportar funções para uso em outros arquivos
export {
  waitForSessionReady,
  exemploCompleto,
  verificarStatus,
  listarSessoes
};
