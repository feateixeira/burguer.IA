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
  paymentMethod?: string;
  orderType: string;
  cashGiven?: number;
  cashChange?: number;
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

  const clientCombined = [r.customerName, r.customerAddress]
    .filter(Boolean).join(" - ").trim();

  const itemsHtml = r.items.map((it, i) => `
    <div class="row item">
      <span class="left">${it.quantity}x ${it.name}</span>
      <span class="right">R$ ${it.totalPrice.toFixed(2)}</span>
    </div>
    ${it.notes ? `<div class="notes">Obs: ${it.notes}</div>` : ""}
    ${i < r.items.length - 1 ? `<div class="sep sep--light"></div>` : ""}
  `).join("");

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
          padding: 0 0;              /* padding interno mínimo */
          margin: 0 var(--margin);   /* margens iguais esq/dir */
        }

        .center { text-align: center; }
        .muted  { opacity: .9; }
        .sep { border-top: 1px dashed #000; margin: 6px 0; height: 0; }
        .sep--light { margin: 9px 0; border-top-style: dotted; }

        /* linhas com coluna de preço fixa sem quebra */
        .row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 6px;
          align-items: baseline;
        }
        .left  { font-weight: 600; overflow-wrap: anywhere; }
        .right { font-weight: 800; text-align: right; white-space: nowrap; }

        /* evita cortar/partir rótulos do cabeçalho */
        .label { white-space: nowrap; font-weight: 700; }

        .row--emph .left, .row--emph .right {
          font-size: ${Math.round(fontSize * 1.15)}px; font-weight: 800;
        }

        .items .item { margin: 3px 0; }
        .notes { font-size: ${Math.max(12, Math.round(fontSize * .9))}px; line-height: 1.15; }

        .customer{
          margin: 6px 0;
          font-size: ${fontSize}px;   /* igual ao PDV */
          font-weight: 800;
          line-height: 1.15;
          word-break: break-word;
        }
        .footer{ margin-top: 8px; text-align:center; font-weight:700; }
        .grow { flex: 1 1 auto; }
      </style>
    </head>
    <body>
      <div id="ticket">
        <div class="center" style="font-weight:800">${r.establishmentName.toUpperCase()}</div>
        ${r.establishmentAddress ? `<div class="center muted">${r.establishmentAddress}</div>` : ""}
        ${r.establishmentPhone ? `<div class="center muted">Tel: ${r.establishmentPhone}</div>` : ""}

        <div class="sep"></div>

        <div class="row"><span class="left"><span class="label">Pedido</span></span><span class="right">${r.orderNumber}</span></div>
        <div class="row"><span class="left"><span class="label">Data</span></span><span class="right">${new Date().toLocaleString("pt-BR")}</span></div>
        <div class="row"><span class="left"><span class="label">Tipo</span></span><span class="right">${r.orderType.toUpperCase()}</span></div>

        ${clientCombined ? `<div class="customer">${clientCombined}</div>` : ""}

        <div class="sep"></div>

        <div class="items">
          ${itemsHtml}
        </div>

        <div class="sep"></div>

        <div class="row"><span class="left">Subtotal</span><span class="right">R$ ${r.subtotal.toFixed(2)}</span></div>
        ${r.discountAmount > 0 ? `<div class="row"><span class="left">Desconto</span><span class="right">-R$ ${r.discountAmount.toFixed(2)}</span></div>` : ""}
        ${r.deliveryFee > 0 ? `<div class="row"><span class="left">Entrega</span><span class="right">R$ ${r.deliveryFee.toFixed(2)}</span></div>` : ""}

        <div class="sep"></div>

        <div class="row row--emph"><span class="left">TOTAL</span><span class="right">R$ ${r.totalAmount.toFixed(2)}</span></div>
        ${r.paymentMethod ? `<div class="row"><span class="left">Pagamento</span><span class="right">${r.paymentMethod.toUpperCase()}</span></div>` : ""}

        ${r.paymentMethod?.toLowerCase() === "dinheiro" ? `
          ${typeof r.cashGiven === "number" ? `<div class="row"><span class="left">Recebido</span><span class="right">R$ ${r.cashGiven.toFixed(2)}</span></div>` : ""}
          ${typeof r.cashChange === "number" ? `<div class="row"><span class="left">Troco</span><span class="right">R$ ${r.cashChange.toFixed(2)}</span></div>` : ""}
        ` : ""}

        <div class="grow"></div>
        <div class="footer">Obrigado pela preferência</div>
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
