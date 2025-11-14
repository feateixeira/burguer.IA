# Guia de Integração - Métodos de Pagamento

## Formato Esperado para Envio de Pedidos

Quando o site `hamburguerianabrasa.com.br` envia pedidos para o sistema, é necessário incluir informações sobre o método de pagamento no payload JSON.

## Estrutura do Payload

O pedido deve ser enviado no seguinte formato:

```json
{
  "order": {
    "customer": {
      "name": "Nome do Cliente",
      "phone": "11999999999",
      "notes": "Observações do cliente (opcional)"
    },
    "payment": {
      "method": "cartao_credito",  // ← CAMPO OBRIGATÓRIO
      "status": "pending"
    },
    "items": [
      {
        "name": "Hambúrguer",
        "sku": "HAMB-001",
        "quantity": 1,
        "unit_price": 25.00,
        "complements": []
      }
    ],
    "totals": {
      "subtotal": 25.00,
      "delivery_fee": 5.00,
      "discount": 0,
      "final_total": 30.00
    },
    "meta": {
      "deliveryType": "delivery",
      "categorySummary": {
        "burger": 1,
        "side": 0,
        "drink": 0
      }
    },
    "channel": "online",
    "origin": "site"
  },
  "source_domain": "hamburguerianabrasa.com.br",
  "estabelecimento_slug": "slug-do-estabelecimento"
}
```

## Métodos de Pagamento Aceitos

O campo `order.payment.method` deve conter um dos seguintes valores:

### ✅ Valores Aceitos (Recomendados)

| Método de Pagamento | Valor do Campo |
|---------------------|----------------|
| **Cartão de Crédito** | `cartao_credito` |
| **Cartão de Débito** | `cartao_debito` |
| **PIX** | `pix` |
| **Dinheiro** | `dinheiro` |

### ✅ Valores Alternativos (Também Aceitos)

O sistema também aceita os seguintes formatos alternativos, que serão normalizados automaticamente:

| Valor Enviado | Normalizado Para |
|---------------|------------------|
| `credito`, `credit`, `credit_card` | `cartao_credito` |
| `debito`, `debit`, `debit_card` | `cartao_debito` |
| `cartao`, `cartão`, `card` | `cartao_debito` (padrão) |
| `cash`, `money` | `dinheiro` |
| `cartao credito/debito`, `cartao_credito_debito` | `cartao_debito` |

### ⚠️ Valores Padrão

Se o método de pagamento não for especificado ou vier em formato desconhecido:
- **Padrão**: `whatsapp` (se não especificado)
- **Fallback**: `online` (se formato desconhecido)

## Exemplos de Payloads Completos

### Exemplo 1: Pedido com Cartão de Crédito

```json
{
  "order": {
    "customer": {
      "name": "João Silva",
      "phone": "11987654321"
    },
    "payment": {
      "method": "cartao_credito",
      "status": "pending"
    },
    "items": [
      {
        "name": "Hambúrguer Artesanal",
        "sku": "HAMB-001",
        "quantity": 1,
        "unit_price": 25.00
      }
    ],
    "totals": {
      "subtotal": 25.00,
      "delivery_fee": 5.00,
      "discount": 0,
      "final_total": 30.00
    },
    "channel": "online",
    "origin": "site"
  },
  "source_domain": "hamburguerianabrasa.com.br"
}
```

### Exemplo 2: Pedido com Cartão de Débito

```json
{
  "order": {
    "customer": {
      "name": "Maria Santos",
      "phone": "11976543210"
    },
    "payment": {
      "method": "cartao_debito",
      "status": "pending"
    },
    "items": [
      {
        "name": "Hambúrguer Artesanal",
        "sku": "HAMB-001",
        "quantity": 1,
        "unit_price": 25.00
      }
    ],
    "totals": {
      "subtotal": 25.00,
      "delivery_fee": 5.00,
      "discount": 0,
      "final_total": 30.00
    },
    "channel": "online",
    "origin": "site"
  },
  "source_domain": "hamburguerianabrasa.com.br"
}
```

### Exemplo 3: Usando Valores Alternativos

```json
{
  "order": {
    "customer": {
      "name": "Pedro Costa",
      "phone": "11965432109"
    },
    "payment": {
      "method": "credit",  // Será normalizado para "cartao_credito"
      "status": "pending"
    },
    "items": [
      {
        "name": "Hambúrguer Artesanal",
        "sku": "HAMB-001",
        "quantity": 1,
        "unit_price": 25.00
      }
    ],
    "totals": {
      "subtotal": 25.00,
      "delivery_fee": 5.00,
      "discount": 0,
      "final_total": 30.00
    },
    "channel": "online",
    "origin": "site"
  },
  "source_domain": "hamburguerianabrasa.com.br"
}
```

## Endpoint da API

**URL**: `https://[SEU-PROJETO].supabase.co/functions/v1/online-order-intake`

**Método**: `POST`

**Headers Obrigatórios**:
- `Content-Type: application/json`
- `X-Estab-Key: [CHAVE_API_DO_ESTABELECIMENTO]`
- `Idempotency-Key: [UUID_ÚNICO_PARA_CADA_PEDIDO]`

## Resposta da API

### Sucesso (200 OK)

```json
{
  "ok": true,
  "order_id": "uuid-do-pedido",
  "print_queued": true
}
```

### Erro (400/500)

```json
{
  "ok": false,
  "error": "Mensagem de erro descritiva"
}
```

## Observações Importantes

1. **Campo `payment.method` é obrigatório** para pedidos com cartão
2. Use sempre os valores recomendados (`cartao_credito`, `cartao_debito`) para garantir compatibilidade
3. Valores alternativos são aceitos, mas podem ser normalizados automaticamente
4. O campo `payment.status` pode ser `"pending"` ou `"paid"` dependendo do status do pagamento
5. Sempre inclua o `Idempotency-Key` único para evitar duplicação de pedidos

## Troubleshooting

### Erro: "payment_method check constraint violation"

**Causa**: O valor enviado em `payment.method` não é aceito pelo banco de dados.

**Solução**: 
- Use um dos valores recomendados: `cartao_credito`, `cartao_debito`, `pix`, `dinheiro`
- Ou use valores alternativos que serão normalizados automaticamente

### Pedidos aparecem como "whatsapp" em vez de cartão

**Causa**: O campo `payment.method` não está sendo enviado ou está vazio.

**Solução**: 
- Verifique se o campo `order.payment.method` está sendo enviado no payload
- Certifique-se de que o valor não está vazio ou null

## Suporte

Para dúvidas ou problemas, verifique:
1. Se o `payment.method` está sendo enviado corretamente
2. Se está usando um dos valores aceitos
3. Se os headers obrigatórios estão presentes
4. Se o `Idempotency-Key` é único para cada pedido

