export interface ReceiptData {
  orderNumber: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string }>;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  establishmentName: string;
  establishmentAddress?: string;
  establishmentPhone?: string;
  establishmentCnpj?: string;
  paymentMethod?: string;
  paymentMethod2?: string;
  paymentAmount1?: number;
  paymentAmount2?: number;
  orderType: string;
  cashGiven?: number;
  cashChange?: number;
  generalInstructions?: string;
  createdAt?: string;
  pixQrCode?: string; // Data URL do QR code PIX (base64)
  pixKey?: string; // Chave PIX para exibição
  pixKeyType?: string; // Tipo da chave PIX
}

export interface NonFiscalReceiptData {
  orderNumber: string;
  orderId: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string }>;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  taxAmount?: number;
  totalAmount: number;
  establishmentName: string;
  establishmentAddress?: string;
  establishmentCnpj?: string;
  establishmentPhone?: string;
  customerName: string;
  customerCpf?: string;
  customerPhone?: string;
  paymentMethod?: string;
  createdAt: string;
}

// Formatar método de pagamento (função compartilhada)
const formatPaymentMethod = (method: string | undefined) => {
  if (!method) return "";
  const methodMap: Record<string, string> = {
    "dinheiro": "Dinheiro",
    "pix": "PIX",
    "cartao_credito": "Crédito",
    "cartao_debito": "Débito",
    "online": "Online",
    "whatsapp": "WhatsApp",
    "balcao": "Balcão"
  };
  return methodMap[method.toLowerCase()] || method.toUpperCase();
};

export const printReceipt = async (r: ReceiptData) => {
  const printersConfig = localStorage.getItem("printer_configs");
  let fontSize = 18;
  let paperWidth = 80; // mm

  if (printersConfig) {
    const printers = JSON.parse(printersConfig);
    const def = printers.find((p: any) => p.isDefault);
    if (def) {
      fontSize = def.fontSize || fontSize;
      paperWidth = def.paperWidth || paperWidth;
    }
  }

  // margens simétricas (mm)
  const sideMargin = 6;                       // 6mm de cada lado (seguro p/ TM-T20)
  const printableWidth = Math.max(56, paperWidth - sideMargin * 2);

  const formatCurrencyBR = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

  const formatAddressLines = (address?: string) => {
    if (!address || !address.trim()) return [];
    return address
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  };

  const normalizeItemNotes = (notes?: string) => {
    const addonLines: string[] = [];
    const infoLines: string[] = [];
    if (!notes || !notes.trim()) return { addonLines, infoLines };

    const raw = notes.replace(/\|/g, "\n");
    const inlineAddons = [...raw.matchAll(/Adicionais:\s*([^\n]+)/gi)];
    inlineAddons.forEach((m) => {
      const text = (m[1] || "").trim();
      if (text) addonLines.push(text);
    });

    const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
    let collectingAddons = false;

    for (const originalLine of lines) {
      let line = originalLine.replace(/^Obs:\s*/i, "").trim();
      if (!line) continue;

      if (/^Adicionais:\s*/i.test(line)) {
        collectingAddons = true;
        const rest = line.replace(/^Adicionais:\s*/i, "").trim();
        if (rest) addonLines.push(rest);
        continue;
      }

      if (collectingAddons && /^[-+]\s*/.test(line)) {
        addonLines.push(line.replace(/^[-+]\s*/, "").trim());
        continue;
      }

      collectingAddons = false;
      if (/^[-+]\s*\d+\s*x/i.test(line)) {
        addonLines.push(line.replace(/^[-+]\s*/, "").trim());
        continue;
      }

      line = line.replace(/^(Molhos?)\s*:/i, "Molho:");
      if (/^(Molho:|Trio:|Bebida:|Opção:|Observação:)/i.test(line)) {
        infoLines.push(line);
      } else if (!/^Adicionais:/i.test(line)) {
        infoLines.push(line);
      }
    }

    const uniqueAddons = [...new Set(addonLines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean))];
    const uniqueInfo = [...new Set(infoLines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean))];

    return { addonLines: uniqueAddons, infoLines: uniqueInfo };
  };

  const dateRef = r.createdAt ? new Date(r.createdAt) : new Date();
  const datePart = dateRef.toLocaleDateString("pt-BR");
  const timePart = dateRef.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const customerAddressLines = formatAddressLines(r.customerAddress);

  const itemsHtml = r.items.map((it, i) => {
    const { addonLines, infoLines } = normalizeItemNotes(it.notes);
    const itemName = (it.name || "").toUpperCase();

    return `
      <div class="item-block">
        <div class="item-title">[ ${it.quantity} ] ${itemName}</div>
        ${addonLines.map((line) => `<div class="item-note item-note--addon">+ ${line}</div>`).join("")}
        ${infoLines.map((line) => `<div class="item-note item-note--info">&gt; ${line}</div>`).join("")}
        <div class="item-price">${formatCurrencyBR(it.totalPrice)}</div>
      </div>
      ${i < r.items.length - 1 ? `<div class="line-dash"></div>` : ""}
    `;
  }).join("");

  const html = `
  <html>
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>${r.orderNumber}</title>
      <style>
        * { box-sizing: border-box; }
        :root {
          --paper: ${paperWidth}mm;
          --margin: ${sideMargin}mm;
          --printable: ${printableWidth}mm;
        }
        @page { size: var(--paper) auto; margin: 0; }
        html, body {
          width: var(--paper);
          margin: 0;
          padding: 0;
        }
        body {
          display: flex;
          justify-content: center;   /* centraliza o ticket na página */
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
          font-family: "Courier New", Courier, monospace;
          font-size: ${fontSize}px;
          line-height: 1.18;
          letter-spacing: .08px;     /* menos espaçamento, evita corte à direita */
          color: #000;
        }
        #ticket{
          width: var(--printable);
          min-height: 110mm;         /* mínimo ~11 cm */
          padding: 10mm 0 0 0;       /* espaço superior para costura/grampeio (reduzido pela metade) */
          margin: 0 var(--margin);   /* margens iguais esq/dir */
        }

        .center { text-align: center; }
        .line-solid {
          border-top: 2px solid #000;
          margin: 6px 0;
          height: 0;
        }
        .line-dash {
          border-top: 1px dashed #000;
          margin: 6px 0;
          height: 0;
        }
        .line-text {
          text-align: center;
          letter-spacing: 0.2px;
          font-weight: 700;
          margin: 4px 0;
          white-space: nowrap;
          overflow: hidden;
        }
        .info-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 6px;
          align-items: baseline;
          margin: 2px 0;
        }
        .label { font-weight: 800; white-space: nowrap; }
        .value { text-align: right; white-space: nowrap; font-weight: 700; }
        .full-line {
          margin: 2px 0;
          word-break: break-word;
          font-weight: 700;
        }
        .table-head {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 6px;
          font-weight: 800;
          margin: 2px 0;
        }
        .item-block { margin: 4px 0; }
        .item-title {
          font-weight: 800;
          word-break: break-word;
        }
        .item-note {
          margin-top: 1px;
          padding-left: 6px;
          word-break: break-word;
        }
        .item-note--addon { font-weight: 700; }
        .item-note--info { font-weight: 700; }
        .item-price {
          text-align: right;
          font-weight: 800;
          margin-top: 2px;
          white-space: nowrap;
        }
        .totals-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 6px;
          margin: 2px 0;
          align-items: baseline;
        }
        .totals-label { font-weight: 700; }
        .totals-value { font-weight: 700; text-align: right; white-space: nowrap; }
        .totals-row.total-final .totals-label,
        .totals-row.total-final .totals-value { font-size: ${Math.round(fontSize * 1.1)}px; font-weight: 900; }
        .footer{ margin-top: 10px; text-align:center; font-weight:700; }
        .grow { flex: 1 1 auto; }
      </style>
    </head>
    <body>
      <div id="ticket">
        <div class="center" style="font-weight:900;">${r.establishmentName.toUpperCase()}</div>
        ${r.establishmentAddress ? `<div class="center">${r.establishmentAddress}</div>` : ""}
        ${r.establishmentPhone ? `<div class="center">Tel: ${r.establishmentPhone}</div>` : ""}
        <div class="center" style="font-size: ${Math.max(10, Math.round(fontSize * 0.8))}px;">Documento não fiscal</div>

        <div class="line-solid"></div>
        <div class="info-row"><span class="label">PEDIDO:</span><span class="value">${r.orderNumber}</span></div>
        <div class="info-row"><span class="label">TIPO:</span><span class="value">${(r.orderType || "").toUpperCase()}</span></div>
        <div class="info-row"><span class="label">DATA:</span><span class="value">${datePart} - ${timePart}</span></div>
        <div class="line-dash"></div>
        ${r.customerName ? `<div class="full-line"><span class="label">CLIENTE:</span> ${r.customerName}</div>` : ""}
        ${customerAddressLines.length > 0 ? `<div class="full-line"><span class="label">ENDEREÇO:</span> ${customerAddressLines[0]}</div>` : ""}
        ${customerAddressLines.slice(1).map((line) => `<div class="full-line">${line}</div>`).join("")}
        <div class="line-solid"></div>
        <div class="table-head">
          <span>QTD</span>
          <span>ITEM</span>
          <span>VALOR</span>
        </div>
        <div class="line-dash"></div>
        ${itemsHtml}
        <div class="line-solid"></div>
        <div class="totals-row"><span class="totals-label">Subtotal:</span><span class="totals-value">${formatCurrencyBR(r.subtotal)}</span></div>
        ${r.discountAmount > 0 ? `<div class="totals-row"><span class="totals-label">Desconto:</span><span class="totals-value">- ${formatCurrencyBR(r.discountAmount)}</span></div>` : ""}
        ${r.deliveryFee > 0 ? `<div class="totals-row"><span class="totals-label">Taxa de Entrega:</span><span class="totals-value">${formatCurrencyBR(r.deliveryFee)}</span></div>` : ""}
        <div class="line-dash"></div>
        <div class="totals-row total-final"><span class="totals-label">TOTAL:</span><span class="totals-value">${formatCurrencyBR(r.totalAmount)}</span></div>
        ${r.paymentMethod && typeof r.paymentAmount1 === "number" && r.paymentMethod2 && typeof r.paymentAmount2 === "number"
          ? `
          <div class="totals-row"><span class="totals-label">Pagamento (1):</span><span class="totals-value">${formatPaymentMethod(r.paymentMethod)} - ${formatCurrencyBR(r.paymentAmount1)}</span></div>
          <div class="totals-row"><span class="totals-label">Pagamento (2):</span><span class="totals-value">${formatPaymentMethod(r.paymentMethod2)} - ${formatCurrencyBR(r.paymentAmount2)}</span></div>
        `
          : r.paymentMethod ? `<div class="totals-row"><span class="totals-label">Pagamento:</span><span class="totals-value">${formatPaymentMethod(r.paymentMethod)}</span></div>` : ""}

        ${r.paymentMethod?.toLowerCase() === "dinheiro" && typeof r.paymentAmount2 !== "number" ? `
          ${typeof r.cashGiven === "number" ? `<div class="totals-row"><span class="totals-label">Recebido:</span><span class="totals-value">${formatCurrencyBR(r.cashGiven)}</span></div>` : ""}
          ${typeof r.cashChange === "number" ? `<div class="totals-row"><span class="totals-label">Troco:</span><span class="totals-value">${formatCurrencyBR(r.cashChange)}</span></div>` : ""}
        ` : ""}

        ${r.paymentMethod?.toLowerCase() === "pix" && r.pixQrCode ? `
          <div class="line-dash"></div>
          <div class="center" style="margin: 12px 0;">
            <div style="font-weight: 700; margin-bottom: 8px; font-size: ${Math.max(14, Math.round(fontSize * 0.9))}px;">PAGAMENTO PIX</div>
            <img src="${r.pixQrCode}" alt="QR Code PIX" style="width: 200px; height: 200px; border: 2px solid #000; padding: 8px; background: #fff; display: block; margin: 0 auto;" />
            <div style="margin-top: 8px; font-size: ${Math.max(10, Math.round(fontSize * 0.7))}px; opacity: 0.8;">
              Escaneie o QR Code para pagar
            </div>
            ${r.pixKey ? `
              <div style="margin-top: 8px; font-size: ${Math.max(11, Math.round(fontSize * 0.75))}px; word-break: break-all;">
                ${r.pixKey}
              </div>
            ` : ""}
          </div>
        ` : ""}

        ${r.generalInstructions &&
          r.generalInstructions.trim().length > 0 &&
          !r.generalInstructions.match(/^(Telefone|Tel|Fone|Phone)[:\s]*$/i) &&
          r.generalInstructions.replace(/\s/g, "").length > 0
          ? `<div class="item-note item-note--info">&gt; ${r.generalInstructions}</div>`
          : ""}

        <div class="grow"></div>
        <div class="footer">Obrigado pela preferência!</div>
      </div>
    </body>
  </html>`;

  // Impressão usando iframe/popup (compatível com modo silencioso do Firefox)
  // Flag para garantir que só imprime uma vez
  let hasPrinted = false;
  
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) throw new Error("IFRAME_DOC_UNAVAILABLE");
    doc.open(); doc.write(html); doc.close();
    
    const printFromIframe = () => {
      // Garantir que só imprime uma vez
      if (hasPrinted) return;
      hasPrinted = true;
      
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { 
        try { 
          document.body.removeChild(iframe); 
        } catch {} 
      }, 300);
    };
    
    // Aguardar o documento estar pronto antes de imprimir
    const checkReady = () => {
      if (hasPrinted) return;
      
      if (doc.readyState === "complete" || doc.readyState === "interactive") {
        // Usar setTimeout para garantir que o conteúdo está renderizado
        setTimeout(printFromIframe, 100);
      } else {
        // Se ainda não estiver pronto, verificar novamente
        setTimeout(checkReady, 50);
      }
    };
    
    // Aguardar um pouco antes de começar a verificar
    setTimeout(checkReady, 100);
    
    // Fallback: se o onload não disparar, tentar após um tempo
    iframe.onload = () => {
      if (!hasPrinted) {
        setTimeout(printFromIframe, 100);
      }
    };
    
  } catch (e1) {
    // Fallback com popup se iframe falhar
    try {
      let popupHasPrinted = false;
      const w = window.open("", "PRINT", `width=${paperWidth * 4},height=700,left=200,top=50`);
      if (!w) throw new Error("POPUP_BLOCKED");
      w.document.write(html);
      w.document.close();
      const doPrint = () => { 
        if (popupHasPrinted) return;
        popupHasPrinted = true;
        w.focus(); 
        w.print(); 
        setTimeout(() => { 
          try { 
            w.close(); 
          } catch {} 
        }, 100); 
      };
      
      // Usar apenas um método de trigger, não ambos
      if (w.document.readyState === "complete") {
        setTimeout(doPrint, 100);
      } else {
        w.onload = doPrint;
      }
    } catch {}
  }
};

export const printNonFiscalReceipt = async (r: NonFiscalReceiptData) => {
  const printersConfig = localStorage.getItem("printer_configs");
  let fontSize = 18;
  let paperWidth = 80; // mm

  if (printersConfig) {
    const printers = JSON.parse(printersConfig);
    const def = printers.find((p: any) => p.isDefault);
    if (def) {
      fontSize = def.fontSize || fontSize;
      paperWidth = def.paperWidth || paperWidth;
    }
  }

  // margens simétricas (mm)
  const sideMargin = 6;
  const printableWidth = Math.max(56, paperWidth - sideMargin * 2);

  // Formatar data e hora
  const orderDate = new Date(r.createdAt);
  const formattedDate = orderDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const formattedTime = orderDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  // Formatar CNPJ se houver
  const formatCNPJ = (cnpj: string | undefined) => {
    if (!cnpj) return "";
    const cleaned = cnpj.replace(/\D/g, "");
    if (cleaned.length === 14) {
      return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
    return cnpj;
  };

  // Formatar CPF se houver
  const formatCPF = (cpf: string | undefined) => {
    if (!cpf) return "";
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    }
    return cpf;
  };

  // formatPaymentMethod já está definida no escopo global acima

  const formatCurrencyBR = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

  // Montar HTML dos itens no novo padrão visual
  const itemsHtml = r.items.map((item, index) => {
    // Extrair adicionais das notes
    let addonsNote = '';
    let otherNotes = item.notes || '';
    
    if (item.notes) {
      // Procura por "Adicionais:" seguido de múltiplas linhas
      const addonsPattern = /Adicionais:\s*([\s\S]+?)(?:\n\n|\n(?!\s+\+)|$)/i;
      let addonsMatch = item.notes.match(addonsPattern);
      if (addonsMatch && addonsMatch[1]) {
        addonsNote = `Adicionais:\n${addonsMatch[1].trim()}`;
        // Remove adicionais das outras notes
        otherNotes = item.notes.replace(addonsPattern, '').trim();
        // Remove linhas vazias extras
        otherNotes = otherNotes.replace(/\n\n+/g, '\n').trim();
      } else {
        // Fallback: formato antigo (tudo em uma linha)
        const addonsPatternOld = /Adicionais:\s*([^|]+?)(?:\s*\||$)/i;
        let addonsMatchOld = item.notes.match(addonsPatternOld);
        if (!addonsMatchOld) {
          addonsMatchOld = item.notes.match(/Adicionais:\s*([^\n]+)/i);
        }
        if (addonsMatchOld && addonsMatchOld[1]) {
          addonsNote = addonsMatchOld[1].trim();
          // Remove adicionais das outras notes
          otherNotes = item.notes.split('|').map(part => part.trim()).filter(part => {
            return !part.toLowerCase().includes('adicionais:');
          }).join(' | ').trim();
        }
      }
    }
    
    // Formatar adicionais para exibir cada um em uma linha
    let formattedAddonsHtml = '';
    if (addonsNote) {
      const addonsLines = addonsNote.split('\n');
      if (addonsLines.length > 1) {
        formattedAddonsHtml = `<div style="margin-top: 4px;"><strong>${addonsLines[0]}</strong></div>`;
        addonsLines.slice(1).forEach(line => {
          if (line.trim()) {
            // Remove "+" no início e espaços extras, garante R$ sem espaço antes do valor
            let cleanLine = line.trim().replace(/^\+\s*/, '').trim().replace(/R\$\s+/g, 'R$');
            formattedAddonsHtml += `<div style="margin-left: 8px; margin-top: 2px;">${cleanLine}</div>`;
          }
        });
      } else {
        // Formato antigo - limpar também
        let cleanNote = addonsNote.replace(/^\+\s*/, '').trim().replace(/R\$\s+/g, 'R$');
        formattedAddonsHtml = `<div style="margin-top: 4px;">${cleanNote}</div>`;
      }
    }
    
    const itemNotesHtml = otherNotes
      ? otherNotes
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<div class="item-note item-note--info">&gt; ${line.replace(/^Obs:\s*/i, '')}</div>`)
          .join('')
      : "";
    
    return `
      <div class="item-block">
        <div class="item-title">[ ${item.quantity} ] ${(item.name || '').toUpperCase()}</div>
        ${itemNotesHtml}
        ${formattedAddonsHtml
          .replace(/<div style="margin-top: 4px;"><strong>Adicionais:<\/strong><\/div>/g, '')
          .replace(/<div style="margin-left: 8px; margin-top: 2px;">/g, '<div class="item-note item-note--addon">+ ')
          .replace(/<\/div>/g, '</div>')
        }
        <div class="item-price">${formatCurrencyBR(item.totalPrice)}</div>
        ${index < r.items.length - 1 ? '<div class="line-dash"></div>' : ''}
      </div>
    `;
  }).join("");

  const html = `
  <html>
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>Cupom Não Fiscal - ${r.orderNumber}</title>
      <style>
        * { box-sizing: border-box; }
        :root {
          --paper: ${paperWidth}mm;
          --margin: ${sideMargin}mm;
          --printable: ${printableWidth}mm;
        }
        @page { size: var(--paper) auto; margin: 0; }
        html, body {
          width: var(--paper);
          margin: 0;
          padding: 0;
        }
        body {
          display: flex;
          justify-content: center;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: "Courier New", Courier, monospace;
          font-size: ${fontSize}px;
          line-height: 1.2;
          letter-spacing: 0.05px;
          color: #000;
        }
        #receipt {
          width: var(--printable);
          max-width: var(--printable);
          min-height: 110mm;
          padding: 0;
          margin: 0 var(--margin);
          overflow-wrap: break-word;
          word-wrap: break-word;
        }
        .line-solid { border-top: 2px solid #000; margin: 6px 0; height: 0; }
        .line-dash { border-top: 1px dashed #000; margin: 6px 0; height: 0; }
        .info-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 6px;
          align-items: baseline;
          margin: 2px 0;
        }
        .label { font-weight: 800; white-space: nowrap; }
        .value { text-align: right; white-space: nowrap; font-weight: 700; }
        .full-line { margin: 2px 0; word-break: break-word; font-weight: 700; }
        .table-head {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 6px;
          font-weight: 800;
          margin: 2px 0;
        }
        .item-block { margin: 4px 0; }
        .item-title { font-weight: 800; word-break: break-word; }
        .item-note { margin-top: 1px; padding-left: 6px; word-break: break-word; }
        .item-note--addon { font-weight: 700; }
        .item-note--info { font-weight: 700; }
        .item-price { text-align: right; font-weight: 800; margin-top: 2px; white-space: nowrap; }
        .totals-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 6px;
          margin: 2px 0;
          align-items: baseline;
        }
        .totals-label { font-weight: 700; }
        .totals-value { font-weight: 700; text-align: right; white-space: nowrap; }
        .totals-row.total-final .totals-label,
        .totals-row.total-final .totals-value { font-size: ${Math.round(fontSize * 1.1)}px; font-weight: 900; }
        .footer {
          text-align: center;
          margin-top: 12px;
          font-weight: 700;
          font-size: ${Math.round(fontSize * 0.95)}px;
        }
        .grow {
          flex: 1 1 auto;
        }
      </style>
    </head>
    <body>
      <div id="receipt">
        <div style="text-align:center;font-weight:900;">${r.establishmentName.toUpperCase()}</div>
        ${r.establishmentAddress ? `<div style="text-align:center;">${r.establishmentAddress}</div>` : ""}
        ${r.establishmentPhone ? `<div style="text-align:center;">Tel: ${r.establishmentPhone}</div>` : ""}
        <div style="text-align:center;font-size:${Math.max(10, Math.round(fontSize * 0.8))}px;">Documento não fiscal</div>

        <div class="line-solid"></div>
        <div class="info-row"><span class="label">PEDIDO:</span><span class="value">${r.orderNumber}</span></div>
        <div class="info-row"><span class="label">DATA:</span><span class="value">${formattedDate} - ${formattedTime}</span></div>
        <div class="full-line"><span class="label">CLIENTE:</span> ${r.customerName}</div>
        ${r.customerCpf ? `<div class="full-line"><span class="label">CPF:</span> ${formatCPF(r.customerCpf)}</div>` : ""}
        ${r.customerPhone ? `<div class="full-line"><span class="label">TEL:</span> ${r.customerPhone}</div>` : ""}

        <div class="line-solid"></div>
        <div class="table-head">
          <span>QTD</span>
          <span>ITEM</span>
          <span>VALOR</span>
        </div>
        <div class="line-dash"></div>
        ${itemsHtml}
        <div class="line-solid"></div>
        <div class="totals-row"><span class="totals-label">Subtotal:</span><span class="totals-value">${formatCurrencyBR(r.subtotal)}</span></div>
        ${r.discountAmount > 0 ? `<div class="totals-row"><span class="totals-label">Desconto:</span><span class="totals-value">- ${formatCurrencyBR(r.discountAmount)}</span></div>` : ""}
        ${r.deliveryFee > 0 ? `<div class="totals-row"><span class="totals-label">Taxa de Entrega:</span><span class="totals-value">${formatCurrencyBR(r.deliveryFee)}</span></div>` : ""}
        ${r.taxAmount && r.taxAmount > 0 ? `<div class="totals-row"><span class="totals-label">Acréscimos:</span><span class="totals-value">${formatCurrencyBR(r.taxAmount)}</span></div>` : ""}
        <div class="line-dash"></div>
        <div class="totals-row total-final"><span class="totals-label">TOTAL:</span><span class="totals-value">${formatCurrencyBR(r.totalAmount)}</span></div>
        ${r.paymentMethod ? `<div class="totals-row"><span class="totals-label">Pagamento:</span><span class="totals-value">${formatPaymentMethod(r.paymentMethod)}</span></div>` : ""}

        <div class="grow"></div>

        <!-- Rodapé -->
        <div class="footer">
          Obrigado pela preferência!
        </div>
      </div>
    </body>
  </html>`;

  // Impressão usando iframe/popup
  let hasPrinted = false;
  
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) throw new Error("IFRAME_DOC_UNAVAILABLE");
    doc.open();
    doc.write(html);
    doc.close();
    
    const printFromIframe = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { 
        try { 
          document.body.removeChild(iframe); 
        } catch {} 
      }, 300);
    };
    
    const checkReady = () => {
      if (hasPrinted) return;
      
      if (doc.readyState === "complete" || doc.readyState === "interactive") {
        setTimeout(printFromIframe, 100);
      } else {
        setTimeout(checkReady, 50);
      }
    };
    
    setTimeout(checkReady, 100);
    
    iframe.onload = () => {
      if (!hasPrinted) {
        setTimeout(printFromIframe, 100);
      }
    };
    
  } catch (e1) {
    // Fallback com popup se iframe falhar
    try {
      let popupHasPrinted = false;
      const w = window.open("", "PRINT", `width=${paperWidth * 4},height=700,left=200,top=50`);
      if (!w) throw new Error("POPUP_BLOCKED");
      w.document.write(html);
      w.document.close();
      const doPrint = () => { 
        if (popupHasPrinted) return;
        popupHasPrinted = true;
        w.focus(); 
        w.print(); 
        setTimeout(() => { 
          try { 
            w.close(); 
          } catch {} 
        }, 100); 
      };
      
      if (w.document.readyState === "complete") {
        setTimeout(doPrint, 100);
      } else {
        w.onload = doPrint;
      }
    } catch {}
  }
};
