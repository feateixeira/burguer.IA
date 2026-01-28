# 🚀 Guia Rápido de Início

## Instalação Rápida

```bash
# 1. Entre no diretório
cd whatsapp-api-service

# 2. Instale as dependências
npm install

# 3. (Opcional) Configure a porta no arquivo .env
# PORT=3000

# 4. Inicie o servidor
npm start
```

## Teste Rápido

### 1. Iniciar uma sessão

```bash
curl -X POST http://localhost:3000/start-session \
  -H "Content-Type: application/json" \
  -d '{"clientId": "loja_01"}'
```

**Resposta esperada:**
- Se for a primeira vez: retorna QR Code em base64
- Se já estiver conectado: retorna "Sessão pronta"

### 2. Verificar status

```bash
curl http://localhost:3000/status/loja_01
```

### 3. Enviar mensagem (após conectar)

```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "loja_01",
    "phone": "5511999999999",
    "message": "Seu lanche saiu para entrega!"
  }'
```

## 📱 Como Escanear o QR Code

1. Chame `POST /start-session` com um `clientId`
2. A resposta incluirá um campo `qrCode` em base64
3. Converta o base64 para imagem e exiba para o usuário
4. Escaneie com o WhatsApp no celular
5. Aguarde alguns segundos até o status mudar para `ready`

## 🔄 Fluxo Completo

```javascript
// 1. Iniciar sessão
POST /start-session → { clientId: "loja_01" }
→ Retorna QR Code (primeira vez) ou "Sessão pronta"

// 2. Verificar status (polling)
GET /status/loja_01
→ Aguardar até status === "ready"

// 3. Enviar mensagem
POST /send-message → { clientId, phone, message }
→ Mensagem enviada com sucesso!
```

## ⚠️ Importante

- Cada `clientId` precisa escanear o QR Code **apenas uma vez**
- As sessões são salvas localmente em `.wwebjs_auth/{clientId}/`
- Após a primeira conexão, não será necessário escanear novamente (a menos que a sessão expire)

## 🐛 Problemas Comuns

**Erro: "Sessão não encontrada"**
→ Chame `POST /start-session` primeiro

**Erro: "Sessão não está pronta"**
→ Aguarde a conexão ou escaneie o QR Code novamente

**QR Code não aparece**
→ Aguarde 2-3 segundos após chamar `/start-session`
