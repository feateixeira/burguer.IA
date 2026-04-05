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
  const key = method.toLowerCase().trim();
  const methodMap: Record<string, string> = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    cartao_credito: "Crédito",
    cartao_debito: "Débito",
    online: "Online",
    whatsapp: "WhatsApp",
    balcao: "Balcão",
    credito: "Crédito",
    debito: "Débito",
  };
  if (methodMap[key]) return methodMap[key];
  if (key.includes("débito") || key.includes("debito")) return "Débito";
  if (key.includes("crédito") || key.includes("credito")) return "Crédito";
  if (key === "crédito" || key === "credito") return "Crédito";
  if (key === "débito" || key === "debito") return "Débito";
  return method.replace(/\s+/g, " ").trim();
};

/** Ex.: 61993709608 → (61) 99370-9608 */
function formatPhoneBRDisplay(phone: string | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return phone.trim();
}

function receiptOrderLabel(orderNumber: string): string {
  const n = (orderNumber || "").trim();
  if (!n) return "#—";
  return n.startsWith("#") ? n : `#${n}`;
}

function escapeHtmlReceipt(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Quebra endereço em linhas curtas (vírgulas), legível para motoboy */
function addressToReceiptLines(address: string, maxChunk = 34): string[] {
  const cleaned = address.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    if (cleaned.length <= maxChunk) return [cleaned];
    const out: string[] = [];
    let cur = "";
    for (const w of cleaned.split(/\s+/)) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > maxChunk && cur) {
        out.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) out.push(cur);
    return out;
  }
  return parts;
}

/** Junta quebra de linha comum em preços: "(R$\n8.00)" → "(R$ 8.00)" */
function joinBrokenPriceFragments(s: string): string {
  return s
    .replace(/\(\s*R\$\s*\r?\n\s*([\d.,]+)\s*\)/gi, "(R$ $1)")
    .replace(/\(\s*R\$\s*\r?\n/gi, "(R$ ");
}

function normalizeAddonDedupKey(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Envolve (R$ x,xx) em span para não quebrar no meio na impressão */
function nowrapPriceSegments(text: string): string {
  return text.replace(/\(\s*R\$\s*[\d.,]+\s*\)/gi, (m) => {
    const compact = m.replace(/\s+/g, "\u00a0");
    return `<span style="white-space:nowrap">${compact}</span>`;
  });
}

/**
 * Separa observações (molho, trio, etc.) de adicionais, sem duplicar texto.
 * Ordem desejada na impressão: infos primeiro (molho em cima), depois bloco Adicionais com linhas +.
 */
function normalizeItemNotes(notes?: string): { addonLines: string[]; infoLines: string[] } {
  const addonLines: string[] = [];
  const infoLines: string[] = [];
  if (!notes?.trim()) return { addonLines, infoLines };

  const raw = joinBrokenPriceFragments(notes.replace(/\|/g, "\n"));
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const pushUniqueAddon = (text: string) => {
    const parts = text.split(/,\s+/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      let t = part.replace(/^[-+]\s*/, "").trim();
      if (!t) continue;
      
      const qtyMatch = /^(\d+x)\s+(.*)/i.exec(t);
      if (qtyMatch) {
        t = `(${qtyMatch[1]}) ${qtyMatch[2]}`;
      }

      const key = normalizeAddonDedupKey(t);
      if (!addonLines.some((a) => normalizeAddonDedupKey(a) === key)) {
        addonLines.push(t);
      }
    }
  };

  let collectingAddons = false;

  for (const originalLine of lines) {
    let line = originalLine.replace(/^Obs:\s*/i, "").trim();
    if (!line) continue;

    if (/^Adicionais:\s*/i.test(line)) {
      collectingAddons = true;
      const rest = line.replace(/^Adicionais:\s*/i, "").trim();
      if (rest) pushUniqueAddon(rest);
      continue;
    }

    if (collectingAddons) {
      if (/^[-+]?\s*\d+\s*x/i.test(line) || /^\(\d+x\)/i.test(line) || /^[-+]\s/.test(line)) {
        pushUniqueAddon(line);
        continue;
      }
      if (/^(Molho:|Trio:|Bebida:|Opção:|Observação:)/i.test(line)) {
        collectingAddons = false;
      } else if (addonLines.length > 0) {
        addonLines[addonLines.length - 1] = `${addonLines[addonLines.length - 1]} ${line}`
          .replace(/\s+/g, " ")
          .trim();
        continue;
      } else {
        collectingAddons = false;
      }
    }

    if (/^[-+]?\s*\d+\s*x/i.test(line) || /^\(\d+x\)/i.test(line)) {
      pushUniqueAddon(line);
      continue;
    }
    // Ex.: "+ Blend carne 130g (R$ 8,00)" sem padrão Nx
    if (/^[-+]\s/.test(line)) {
      pushUniqueAddon(line);
      continue;
    }

    line = line.replace(/^(Molhos?)\s*:/i, "Molho:");
    if (/^(Molho:|Trio:|Bebida:|Opção:|Observação:)/i.test(line)) {
      infoLines.push(line);
    } else if (!/^Adicionais:/i.test(line)) {
      infoLines.push(line);
    }
  }

  const addonKeys = new Set(addonLines.map(normalizeAddonDedupKey));
  const filteredInfo = infoLines.filter((l) => {
    if (addonKeys.has(normalizeAddonDedupKey(l))) return false;
    const withoutMolho = l.replace(/^Molho:\s*/i, "").trim();
    if (addonKeys.has(normalizeAddonDedupKey(withoutMolho))) return false;
    return true;
  });

  const uniqueInfo = [...new Set(filteredInfo.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean))];
  const molhoFirst = [
    ...uniqueInfo.filter((l) => /^Molho:/i.test(l)),
    ...uniqueInfo.filter((l) => !/^Molho:/i.test(l)),
  ];

  return { addonLines, infoLines: molhoFirst };
}

function renderItemNotesBlock(addonLines: string[], infoLines: string[]): string {
  const infoHtml = infoLines
    .map((line) => `<div class="item-note item-note--info">&gt; ${nowrapPriceSegments(line)}</div>`)
    .join("");
  const addonsHtml =
    addonLines.length > 0
      ? `<div class="item-note item-note--addons-label">Adicionais:</div>${addonLines
          .map(
            (line) =>
              `<div class="item-note item-note--addon">${nowrapPriceSegments(line)}</div>`
          )
          .join("")}`
      : "";
  return `${infoHtml}${addonsHtml}`;
}

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
  const formatItemValue = (value: number) => value.toFixed(2).replace(".", ",");

  const dateRef = r.createdAt ? new Date(r.createdAt) : new Date();
  const datePart = dateRef.toLocaleDateString("pt-BR");
  const timePart = dateRef.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const addrLines = r.customerAddress ? addressToReceiptLines(r.customerAddress) : [];
  const customerPhoneDisp = formatPhoneBRDisplay(r.customerPhone) || (r.customerPhone?.trim() ? r.customerPhone.trim() : "");
  const showClienteBlock =
    !!(r.customerName?.trim() || addrLines.length > 0 || customerPhoneDisp);

  const telLoja = formatPhoneBRDisplay(r.establishmentPhone) || r.establishmentPhone;

  const nameLine = r.customerName?.trim()
    ? `<div class="cust-row"><span class="cust-label">Nome: </span><span class="cust-val">${escapeHtmlReceipt(r.customerName.trim())}</span></div>`
    : "";
  const telLine = customerPhoneDisp
    ? `<div class="cust-row"><span class="cust-label">Tel: </span><span class="cust-val">${escapeHtmlReceipt(customerPhoneDisp)}</span></div>`
    : "";
  const addrBlock = addrLines.length
    ? `<div class="cust-block"><span class="cust-label">Endereço: </span><span class="cust-val-stack">${addrLines.map((l) => escapeHtmlReceipt(l)).join(" ")}</span></div>`
    : "";

  const giRaw = r.generalInstructions?.trim() || "";
  const obsPedidoHtml =
    giRaw.length > 0 &&
    !giRaw.match(/^(Telefone|Tel|Fone|Phone)[:\s]*$/i) &&
    giRaw.replace(/\s/g, "").length > 0
      ? `<div class="line-dash"></div>
        <div class="obs-pedido-wrap">
          <span class="cust-label">Obs Pedido: </span>
          <span class="obs-pedido-lines">${escapeHtmlReceipt(giRaw).replace(/\n/g, "<br/>")}</span>
        </div>`
      : "";

  const itemsHtml = r.items.map((it, i) => {
    const { addonLines, infoLines } = normalizeItemNotes(it.notes);
    const itemName = escapeHtmlReceipt((it.name || "").toUpperCase());
    const qtyLabel = String(Math.min(999, Math.max(0, it.quantity))).padStart(2, "0");

    return `
      <div class="item-block">
        <div class="item-row-main">
          <span class="item-qty">[ ${qtyLabel} ]</span>
          <span class="item-name">${itemName}</span>
          <span class="item-price-num">${formatItemValue(it.totalPrice)}</span>
        </div>
        ${renderItemNotesBlock(addonLines, infoLines)}
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
        .section-title {
          text-align: center;
          font-weight: 900;
          margin: 4px 0 6px;
          letter-spacing: 0.2px;
        }
        .data-line {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 8px;
          align-items: baseline;
          margin: 2px 0;
        }
        .data-date { font-weight: 700; }
        .data-time { font-weight: 700; white-space: nowrap; text-align: right; }
        .cust-row {
          margin: 3px 0;
          width: 100%;
        }
        .cust-block {
          margin: 3px 0;
          width: 100%;
        }
        .cust-label { font-weight: 800; }
        .cust-val {
          font-weight: 700;
          word-break: break-word;
        }
        .cust-val-stack {
          font-weight: 700;
          word-break: break-word;
        }
        .obs-pedido-wrap {
          margin: 4px 0;
          width: 100%;
        }
        .obs-pedido-lines {
          font-weight: 700;
          word-break: break-word;
        }
        .table-head {
          display: grid;
          grid-template-columns: 6.5ch 1fr auto;
          gap: 8px;
          font-weight: 800;
          margin: 2px 0;
        }
        .table-head span:last-child { text-align: right; }
        .item-block { margin: 4px 0; }
        .item-row-main {
          display: grid;
          grid-template-columns: 6.5ch 1fr auto;
          gap: 8px;
          align-items: start;
        }
        .item-qty { font-weight: 800; white-space: nowrap; }
        .item-name { font-weight: 800; word-break: break-word; }
        .item-price-num {
          font-weight: 800;
          white-space: nowrap;
          text-align: right;
        }
        .item-note {
          margin-top: 1px;
          padding-left: 2ch;
          word-break: break-word;
        }
        .item-note--addon { font-weight: 700; }
        .item-note--info { font-weight: 700; }
        .item-note--addons-label { font-weight: 800; margin-top: 2px; }
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
        ${telLoja ? `<div class="center">Tel: ${telLoja}</div>` : ""}
        <div class="center" style="font-size: ${Math.max(10, Math.round(fontSize * 0.8))}px;">Documento não fiscal</div>

        <div class="line-solid"></div>
        <div class="info-row"><span class="label">PEDIDO:</span><span class="value">${receiptOrderLabel(r.orderNumber)}</span></div>
        <div class="info-row"><span class="label">TIPO:</span><span class="value">${(r.orderType || "").toUpperCase()}</span></div>
        <div class="data-line">
          <span class="label">DATA:</span>
          <span class="data-date">${datePart}</span>
          <span class="data-time">${timePart}</span>
        </div>
        ${showClienteBlock ? `
        <div class="line-dash"></div>
        <div class="section-title">DADOS DO CLIENTE</div>
        ${nameLine}
        ${telLine}
        ${addrBlock}
        ` : ""}
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

        ${obsPedidoHtml}

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

        <div class="grow"></div>
        <div class="line-dash"></div>
        <div class="footer">Obrigado pela preferência!</div>
        <div class="line-solid"></div>
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
  const formatItemValue = (value: number) => value.toFixed(2).replace(".", ",");
  const telLojaNf = formatPhoneBRDisplay(r.establishmentPhone) || r.establishmentPhone;
  const custTelNf = formatPhoneBRDisplay(r.customerPhone) || r.customerPhone;

  // Mesmo padrão visual do printReceipt (molho primeiro, depois Adicionais: + linhas)
  const itemsHtml = r.items.map((item, index) => {
    const { addonLines, infoLines } = normalizeItemNotes(item.notes);
    const qtyLabel = String(Math.min(999, Math.max(0, item.quantity))).padStart(2, "0");
    return `
      <div class="item-block">
        <div class="item-row-main">
          <span class="item-qty">[ ${qtyLabel} ]</span>
          <span class="item-name">${(item.name || "").toUpperCase()}</span>
          <span class="item-price-num">${formatItemValue(item.totalPrice)}</span>
        </div>
        ${renderItemNotesBlock(addonLines, infoLines)}
      </div>
      ${index < r.items.length - 1 ? `<div class="line-dash"></div>` : ""}
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
        .section-title {
          text-align: center;
          font-weight: 900;
          margin: 4px 0 6px;
          letter-spacing: 0.2px;
        }
        .data-line {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 8px;
          align-items: baseline;
          margin: 2px 0;
        }
        .data-date { font-weight: 700; }
        .data-time { font-weight: 700; white-space: nowrap; text-align: right; }
        .cust-row {
          margin: 2px 0;
          word-break: break-word;
        }
        .cust-label { font-weight: 800; }
        .cust-val { font-weight: 700; }
        .table-head {
          display: grid;
          grid-template-columns: 6.5ch 1fr auto;
          gap: 8px;
          font-weight: 800;
          margin: 2px 0;
        }
        .table-head span:last-child { text-align: right; }
        .item-block { margin: 4px 0; }
        .item-row-main {
          display: grid;
          grid-template-columns: 6.5ch 1fr auto;
          gap: 8px;
          align-items: start;
        }
        .item-qty { font-weight: 800; white-space: nowrap; }
        .item-name { font-weight: 800; word-break: break-word; }
        .item-price-num {
          font-weight: 800;
          white-space: nowrap;
          text-align: right;
        }
        .item-note { margin-top: 1px; padding-left: 2ch; word-break: break-word; }
        .item-note--addon { font-weight: 700; }
        .item-note--info { font-weight: 700; }
        .item-note--addons-label { font-weight: 800; margin-top: 2px; }
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
        ${telLojaNf ? `<div style="text-align:center;">Tel: ${telLojaNf}</div>` : ""}
        <div style="text-align:center;font-size:${Math.max(10, Math.round(fontSize * 0.8))}px;">Documento não fiscal</div>

        <div class="line-solid"></div>
        <div class="info-row"><span class="label">PEDIDO:</span><span class="value">${receiptOrderLabel(r.orderNumber)}</span></div>
        <div class="data-line">
          <span class="label">DATA:</span>
          <span class="data-date">${formattedDate}</span>
          <span class="data-time">${formattedTime}</span>
        </div>
        <div class="line-dash"></div>
        <div class="section-title">DADOS DO CLIENTE</div>
        <div class="cust-row"><span class="cust-label">Nome: </span><span class="cust-val">${r.customerName}</span></div>
        ${r.customerCpf ? `<div class="cust-row"><span class="cust-label">CPF: </span><span class="cust-val">${formatCPF(r.customerCpf)}</span></div>` : ""}
        ${custTelNf ? `<div class="cust-row"><span class="cust-label">Tel: </span><span class="cust-val">${custTelNf}</span></div>` : ""}

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

        <div class="line-dash"></div>
        <div class="footer">
          Obrigado pela preferência!
        </div>
        <div class="line-solid"></div>
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
