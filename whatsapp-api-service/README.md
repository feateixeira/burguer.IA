# WhatsApp API Service - Multi-tenant

API Node.js para gerenciar múltiplas sessões de WhatsApp simultaneamente usando `whatsapp-web.js`.

## 🚀 Características

- ✅ **Multi-tenant**: Suporta múltiplas sessões simultâneas
- ✅ **Persistência**: Sessões salvas localmente (não precisa escanear QR toda vez)
- ✅ **API REST**: Endpoints simples e intuitivos
- ✅ **Logs detalhados**: Acompanhe todas as ações no console
- ✅ **Tratamento de erros**: Respostas claras e informativas

## 📦 Instalação

```bash
cd whatsapp-api-service
npm install
```

## ⚙️ Configuração

1. Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

2. Configure a porta (opcional, padrão: 3000):
```env
PORT=3000
```

## 🏃 Execução

### Modo Desenvolvimento (com auto-reload):
```bash
npm run dev
```

### Modo Produção:
```bash
npm start
```

## 📡 Endpoints da API

### 1. Iniciar Sessão
**POST** `/start-session`

Inicia uma nova sessão do WhatsApp para um `clientId` específico.

**Request Body:**
```json
{
  "clientId": "loja_01"
}
```

**Response (QR Code necessário):**
```json
{
  "success": true,
  "status": "qr",
  "message": "QR Code gerado. Escaneie com o WhatsApp.",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**Response (Sessão pronta):**
```json
{
  "success": true,
  "status": "ready",
  "message": "Sessão pronta"
}
```

---

### 2. Enviar Mensagem
**POST** `/send-message`

Envia uma mensagem via WhatsApp usando uma sessão ativa.

**Request Body:**
```json
{
  "clientId": "loja_01",
  "phone": "5511999999999",
  "message": "Seu lanche saiu para entrega!"
}
```

**Response (Sucesso):**
```json
{
  "success": true,
  "messageId": "true_5511999999999@c.us_3EB0C767F26C1E4ADB42",
  "message": "Mensagem enviada com sucesso"
}
```

**Response (Erro - Sessão não encontrada):**
```json
{
  "success": false,
  "error": "Sessão não encontrada para o clientId: loja_01"
}
```

**Response (Erro - Sessão não pronta):**
```json
{
  "success": false,
  "error": "Sessão não está pronta. Status atual: connecting"
}
```

---

### 3. Verificar Status
**GET** `/status/:clientId`

Retorna o status atual de uma sessão específica.

**Exemplo:** `GET /status/loja_01`

**Response (Sessão pronta):**
```json
{
  "success": true,
  "clientId": "loja_01",
  "status": "ready",
  "message": "Sessão conectada e pronta para enviar mensagens"
}
```

**Response (Sessão não encontrada):**
```json
{
  "success": true,
  "clientId": "loja_01",
  "status": "not_found",
  "message": "Sessão não encontrada. Use POST /start-session para iniciar."
}
```

---

### 4. Listar Sessões Ativas
**GET** `/sessions`

Lista todas as sessões ativas (útil para debug).

**Response:**
```json
{
  "success": true,
  "total": 2,
  "sessions": [
    {
      "clientId": "loja_01",
      "status": "ready"
    },
    {
      "clientId": "loja_02",
      "status": "connecting"
    }
  ]
}
```

---

### 5. Encerrar Sessão
**DELETE** `/session/:clientId`

Encerra e remove uma sessão específica.

**Exemplo:** `DELETE /session/loja_01`

**Response:**
```json
{
  "success": true,
  "message": "Sessão encerrada com sucesso"
}
```

---

### 6. Health Check
**GET** `/health`

Verifica se a API está online.

**Response:**
```json
{
  "success": true,
  "status": "online",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "activeSessions": 2
}
```

## 📝 Formato de Telefone

O sistema aceita números de telefone em vários formatos e os formata automaticamente:

- `11999999999` → `5511999999999@c.us`
- `5511999999999` → `5511999999999@c.us`
- `5511999999999@c.us` → `5511999999999@c.us` (já formatado)

**Importante:** O sistema assume números brasileiros (código 55) se não houver código do país.

## 🔒 Segurança

- As sessões são armazenadas localmente em `.wwebjs_auth/{clientId}/`
- Cada `clientId` tem sua própria pasta de autenticação isolada
- **Nunca commite** a pasta `.wwebjs_auth/` no Git (já está no `.gitignore`)

## 📊 Logs

O sistema gera logs detalhados no console:

```
[loja_01] Inicializando nova sessão...
[loja_01] QR Code gerado
[loja_01] QR Code convertido para base64
[loja_01] ✅ Cliente conectado e pronto!
[loja_01] Enviando mensagem para 5511999999999@c.us
[loja_01] ✅ Mensagem enviada com sucesso. ID: true_5511999999999@c.us_3EB0C767F26C1E4ADB42
```

## 🐛 Troubleshooting

### Erro: "Sessão não encontrada"
- Certifique-se de ter chamado `POST /start-session` primeiro
- Verifique se o `clientId` está correto

### Erro: "Sessão não está pronta"
- Aguarde a conexão ser estabelecida (status: `ready`)
- Verifique o status com `GET /status/:clientId`
- Se necessário, escaneie o QR Code novamente

### QR Code não aparece
- Aguarde alguns segundos após chamar `/start-session`
- Verifique os logs no console
- Tente chamar `/status/:clientId` para obter o QR Code

## 📚 Exemplo de Uso Completo

```javascript
// 1. Iniciar sessão
const startResponse = await fetch('http://localhost:3000/start-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId: 'loja_01' })
});

const startData = await startResponse.json();
if (startData.qrCode) {
  // Exibir QR Code para o usuário escanear
  console.log('QR Code:', startData.qrCode);
}

// 2. Verificar status até estar pronto
let status = 'connecting';
while (status !== 'ready') {
  await new Promise(resolve => setTimeout(resolve, 2000));
  const statusResponse = await fetch('http://localhost:3000/status/loja_01');
  const statusData = await statusResponse.json();
  status = statusData.status;
}

// 3. Enviar mensagem
const sendResponse = await fetch('http://localhost:3000/send-message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clientId: 'loja_01',
    phone: '5511999999999',
    message: 'Seu lanche saiu para entrega!'
  })
});

const sendData = await sendResponse.json();
console.log('Mensagem enviada:', sendData);
```

## 📄 Licença

ISC
