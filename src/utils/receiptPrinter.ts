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

  const clientCombined = [r.customerName, r.customerAddress]
    .filter(Boolean).join(" - ").trim();

  const itemsHtml = r.items.map((it, i) => {
    // Separar trio das outras notes
    let trioNote = '';
    let otherNotes: string[] = [];
    let addonsNote = ''; // Para armazenar os adicionais separadamente
    
    if (it.notes && it.notes.trim()) {
      const cleanNotes = it.notes.trim();
      
      // Extrair adicionais ANTES de processar outras notas - captura múltiplas linhas
      // Procura por "Adicionais:" seguido de qualquer conteúdo até encontrar uma linha vazia ou outro marcador
      const addonsPatternMultiLine = /Adicionais:\s*([\s\S]+?)(?:\n\n|\n(?!\s+\+)|$)/i;
      let addonsMatch = cleanNotes.match(addonsPatternMultiLine);
      
      if (addonsMatch && addonsMatch[1]) {
        // Captura todo o conteúdo dos adicionais (pode ter múltiplas linhas)
        addonsNote = addonsMatch[1].trim();
      } else {
        // Fallback: procura por "Adicionais:" seguido de qualquer coisa até encontrar "|" ou fim da string/linha
        const addonsPattern = /Adicionais:\s*([^|]+?)(?:\s*\||$)/i;
        addonsMatch = cleanNotes.match(addonsPattern);
        if (!addonsMatch) {
          // Tenta também quando está separado por quebra de linha simples
          addonsMatch = cleanNotes.match(/Adicionais:\s*([^\n]+)/i);
        }
        if (addonsMatch && addonsMatch[1]) {
          addonsNote = addonsMatch[1].trim();
        }
      }
      
      // Remove adicionais do texto para processar o resto
      // Remove tanto o padrão multi-linha quanto o padrão simples
      let cleanedFromAddons = cleanNotes
        .replace(/Adicionais:\s*([\s\S]+?)(?:\n\n|\n(?!\s+\+)|$)/i, '')
        .replace(/Adicionais:\s*[^|]+?(?:\s*\||$)/i, '')
        .replace(/Adicionais:\s*[^\n]+/i, '')
        .trim();
      
      // Remove partes que contêm "Adicionais:" quando separadas por "|"
      cleanedFromAddons = cleanedFromAddons.split('|').map(part => part.trim()).filter(part => {
        return !part.toLowerCase().includes('adicionais:');
      }).join(' | ').trim();
      
      const notesLines = cleanedFromAddons.split('\n').map(line => line.trim()).filter(Boolean);
      
      let trioFound = false; // Flag para garantir que pegamos apenas o primeiro trio
      
      for (const line of notesLines) {
        // Se é a linha do trio ou bebida (combo/trio Na Brasa), separa (apenas a primeira ocorrência)
        if (!trioFound && (line.match(/^Trio\s*:/i) || line.match(/^Bebida\s*:/i))) {
          trioNote = line.match(/^Trio\s*:/i) ? line : `Trio: ${line.replace(/^Bebida\s*:\s*/i, '').trim()}`;
          trioFound = true;
          continue;
        } else if (line.match(/^Trio\s*:/i) || line.match(/^Bebida\s*:/i)) {
          continue;
        } else {
          // Processa outras notas normalmente
          let processedLine = line;
          
          // Remove linhas que contêm "Adicionais:" - não devem ser impressas
          if (processedLine.toLowerCase().includes('adicionais:')) {
            continue; // Pula esta linha completamente
          }
          
          // Remove "Obs:" se ele está seguido imediatamente por outro marcador (sem conteúdo real)
          if (processedLine.match(/^Obs:\s+(Molhos?|Observação|Obs):\s*/i)) {
            processedLine = processedLine.replace(/^Obs:\s+/i, '').trim();
          }
          
          // Se ficou apenas "Obs:" sem conteúdo após, pula
          if (processedLine.match(/^Obs:\s*$/i)) {
            continue;
          }
          
          // Se começa com outro marcador (Molhos:, Observação:), verifica se é acompanhamento
          if (processedLine.match(/^(Molhos?|Observação):\s*/i)) {
            // Se for acompanhamento, remove "Molho:" (os molhos são fixos nos acompanhamentos)
            const itemNameLower = it.name.toLowerCase();
            const isAccompaniment = itemNameLower.includes('batata') || 
                                   itemNameLower.includes('frango no pote') ||
                                   itemNameLower.includes('frango pote') ||
                                   itemNameLower.includes('acompanhamento');
            
            if (isAccompaniment && processedLine.match(/^Molhos?\s*:\s*/i)) {
              // Remove "Molho:" dos acompanhamentos - os molhos são fixos
              continue; // Não adiciona esta linha
            }
            
            const afterMarker = processedLine.replace(/^(Molhos?|Observação):\s*/i, '').trim();
            if (afterMarker && afterMarker.length > 0) {
              otherNotes.push(processedLine);
            }
            continue;
          }
          
          // Verifica se é acompanhamento pelo nome
          const itemNameLower = it.name.toLowerCase();
          const isAccompaniment = itemNameLower.includes('batata') || 
                                 itemNameLower.includes('frango no pote') ||
                                 itemNameLower.includes('frango pote') ||
                                 itemNameLower.includes('acompanhamento') ||
                                 itemNameLower.includes('cebolas empanadas') ||
                                 itemNameLower.includes('mini chickens') ||
                                 itemNameLower.includes('fritas');
          
          // Se a nota já começa com "Obs:", verifica se há conteúdo útil após
          const hasObsPrefix = processedLine.toLowerCase().startsWith('obs:') || processedLine.toLowerCase().startsWith('obs ');
          
          if (hasObsPrefix) {
            const afterObs = processedLine.replace(/^Obs:\s*/i, '').trim();
            // Remove se contém "Adicionais:" mesmo dentro de "Obs:"
            if (afterObs.toLowerCase().includes('adicionais:')) {
              continue;
            }
            // Se for acompanhamento e começar com "Opção:", remove "Obs:" e mostra apenas "Opção:"
            if (isAccompaniment && afterObs.toLowerCase().startsWith('opção:')) {
              otherNotes.push(afterObs);
            } else if (afterObs && afterObs.length > 0 && !afterObs.match(/^(Molhos?|Observação|Obs):\s*$/i)) {
              otherNotes.push(processedLine);
            }
          } else if (processedLine.length > 0) {
            // Remove se contém "Adicionais:" mesmo sem "Obs:"
            if (processedLine.toLowerCase().includes('adicionais:')) {
              continue;
            }
            // Se for acompanhamento e começar com "Opção:", não adiciona "Obs:" antes
            if (isAccompaniment && processedLine.toLowerCase().startsWith('opção:')) {
              otherNotes.push(processedLine);
            } else {
              // Se não começa com "Obs:" nem outro marcador, adiciona "Obs:" (exceto para trio e acompanhamentos)
              otherNotes.push(`Obs: ${processedLine}`);
            }
          }
        }
      }
    }
    
    // Monta o HTML do item: nome, trio (se houver), adicionais, outras notes (molhos, etc.), preço
    // Formatar adicionais para exibir cada um em uma linha com seu valor
    let formattedAddonsNote = '';
    if (addonsNote) {
      // Verifica se já começa com "Adicionais:" ou não
      const hasAddonsLabel = addonsNote.toLowerCase().trim().startsWith('adicionais:');
      
      // Se addonsNote contém múltiplas linhas
      const addonsLines = addonsNote.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (addonsLines.length > 1) {
        // Se a primeira linha é "Adicionais:", usa ela como título
        if (hasAddonsLabel) {
          formattedAddonsNote = `<div class="notes"><strong>${addonsLines[0]}</strong></div>`;
          // Processa as linhas seguintes
          addonsLines.slice(1).forEach(line => {
            if (line.trim()) {
              // Remove "+" no início e espaços extras
              let cleanLine = line.trim().replace(/^\+\s*/, '').trim();
              // Garante que R$ não tenha espaço antes do valor
              cleanLine = cleanLine.replace(/R\$\s+/g, 'R$');
              formattedAddonsNote += `<div class="notes">${cleanLine}</div>`;
            }
          });
        } else {
          // Se não tem label, adiciona "Adicionais:" como título
          formattedAddonsNote = `<div class="notes"><strong>Adicionais:</strong></div>`;
          addonsLines.forEach(line => {
            if (line.trim()) {
              let cleanLine = line.trim().replace(/^\+\s*/, '').trim();
              cleanLine = cleanLine.replace(/R\$\s+/g, 'R$');
              formattedAddonsNote += `<div class="notes">${cleanLine}</div>`;
            }
          });
        }
      } else {
        // Formato de uma linha apenas
        let cleanNote = addonsNote.trim();
        if (!hasAddonsLabel) {
          // Se não tem label, adiciona
          cleanNote = `Adicionais: ${cleanNote}`;
        }
        cleanNote = cleanNote.replace(/^\+\s*/, '').replace(/R\$\s+/g, 'R$');
        formattedAddonsNote = `<div class="notes">${cleanNote}</div>`;
      }
    }
    
    return `
    <div class="row item">
      <span class="left">${it.quantity}x ${it.name}</span>
    </div>
    ${trioNote ? `<div class="notes">${trioNote.replace(/\n/g, '<br>')}</div>` : ''}
    ${formattedAddonsNote}
    ${otherNotes.length > 0 ? `<div class="notes">${otherNotes.join('<br>')}</div>` : ''}
    ${it.totalPrice > 0 ? `<div class="row item"><span class="left"></span><span class="right">R$ ${it.totalPrice.toFixed(2).replace('.', ',')}</span></div>` : ''}
    ${i < r.items.length - 1 ? `<div class="sep sep--light"></div>` : ""}
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
        .general-instructions {
          margin: 9px 0;
          padding: 6px;
          background: #f5f5f5;
          border-left: 3px solid #000;
          font-size: ${Math.max(12, Math.round(fontSize * .9))}px;
          line-height: 1.3;
          word-break: break-word;
          font-weight: 600;
        }

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
        <div class="center" style="font-size: ${Math.max(10, Math.round(fontSize * 0.7))}px; margin-top: 4px; opacity: 0.7;">Documento não fiscal</div>

        <div class="sep"></div>

        <div class="row"><span class="left"><span class="label">Pedido</span></span><span class="right">${r.orderNumber}</span></div>
        <div class="row"><span class="left"><span class="label">Data</span></span><span class="right">${new Date().toLocaleString("pt-BR")}</span></div>
        <div class="row"><span class="left"><span class="label">Tipo</span></span><span class="right">${r.orderType.toUpperCase()}</span></div>

        ${clientCombined ? `<div class="customer">${clientCombined}</div>` : ""}

        <div class="sep"></div>

        <div class="items">
          ${itemsHtml}
        </div>

        ${r.generalInstructions && 
          r.generalInstructions.trim().length > 0 && 
          !r.generalInstructions.match(/^(Telefone|Tel|Fone|Phone)[:\s]*$/i) &&
          r.generalInstructions.replace(/\s/g, '').length > 0 ? `
          <div class="sep"></div>
          <div class="general-instructions">
            <strong>Instruções do Pedido:</strong> ${r.generalInstructions}
          </div>
        ` : ""}

        <div class="sep"></div>

        <div class="row"><span class="left">Subtotal</span><span class="right">R$ ${r.subtotal.toFixed(2)}</span></div>
        ${r.discountAmount > 0 ? `<div class="row"><span class="left">Desconto</span><span class="right">-R$ ${r.discountAmount.toFixed(2)}</span></div>` : ""}
        ${r.deliveryFee > 0 ? `<div class="row"><span class="left">Entrega</span><span class="right">R$ ${r.deliveryFee.toFixed(2)}</span></div>` : ""}

        <div class="sep"></div>

        <div class="row row--emph"><span class="left">TOTAL</span><span class="right">R$ ${r.totalAmount.toFixed(2)}</span></div>
        ${r.paymentMethod && typeof r.paymentAmount1 === "number" && r.paymentMethod2 && typeof r.paymentAmount2 === "number"
          ? `
          <div class="row"><span class="left">Pagamento (1)</span><span class="right">${formatPaymentMethod(r.paymentMethod)} - R$ ${r.paymentAmount1.toFixed(2)}</span></div>
          <div class="row"><span class="left">Pagamento (2)</span><span class="right">${formatPaymentMethod(r.paymentMethod2)} - R$ ${r.paymentAmount2.toFixed(2)}</span></div>
        `
          : r.paymentMethod ? `<div class="row"><span class="left">Pagamento</span><span class="right">${formatPaymentMethod(r.paymentMethod)}</span></div>` : ""}

        ${r.paymentMethod?.toLowerCase() === "dinheiro" && typeof r.paymentAmount2 !== "number" ? `
          ${typeof r.cashGiven === "number" ? `<div class="row"><span class="left">Recebido</span><span class="right">R$ ${r.cashGiven.toFixed(2)}</span></div>` : ""}
          ${typeof r.cashChange === "number" ? `<div class="row"><span class="left">Troco</span><span class="right">R$ ${r.cashChange.toFixed(2)}</span></div>` : ""}
        ` : ""}

        ${r.paymentMethod?.toLowerCase() === "pix" && r.pixQrCode ? `
          <div class="sep"></div>
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

  // Montar HTML dos itens
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
    
    const itemNotesHtml = otherNotes ? `<div class="item-notes">${otherNotes}</div>` : "";
    
    return `
      <div class="item-row">
        <div class="item-header">
          <span class="item-name">${item.name}</span>
          <span class="item-quantity">Qtd: ${item.quantity}</span>
        </div>
        ${itemNotesHtml}
        ${formattedAddonsHtml}
        <div class="item-prices">
          <span class="item-unit-price">Unit: R$ ${item.unitPrice.toFixed(2).replace('.', ',')}</span>
          <span class="item-total-price">Total: R$ ${item.totalPrice.toFixed(2).replace('.', ',')}</span>
        </div>
        ${index < r.items.length - 1 ? '<div class="sep-light"></div>' : ''}
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
        .header {
          text-align: center;
          margin-bottom: 6px;
        }
        .header-title {
          font-size: ${Math.round(fontSize * 1.1)}px;
          font-weight: 800;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .header-subtitle {
          font-size: ${Math.round(fontSize * 0.9)}px;
          font-weight: 600;
          margin: 2px 0;
        }
        .sep {
          border-top: 1px dashed #000;
          margin: 8px 0;
          height: 0;
        }
        .sep-light {
          border-top: 1px dotted #ccc;
          margin: 6px 0;
          height: 0;
        }
        .section {
          margin: 8px 0;
        }
        .section-title {
          font-weight: 700;
          font-size: ${Math.round(fontSize * 0.95)}px;
          margin-bottom: 4px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 3px 0;
          font-size: ${fontSize}px;
          gap: 6px;
        }
        .info-label {
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .info-value {
          font-weight: 400;
          text-align: right;
          flex: 1;
          min-width: 0;
        }
        .info-value.phone-value {
          white-space: nowrap !important;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: ${Math.min(Math.round(fontSize * 0.88), 15)}px;
          max-width: 100%;
          flex-shrink: 1;
        }
        .info-row.phone-row {
          font-size: ${Math.min(Math.round(fontSize * 0.9), 16)}px;
          white-space: nowrap;
        }
        .item-row {
          margin: 6px 0;
        }
        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 3px;
        }
        .item-name {
          font-weight: 600;
          flex: 1;
          word-wrap: break-word;
        }
        .item-quantity {
          font-weight: 600;
          margin-left: 8px;
          white-space: nowrap;
        }
        .item-notes {
          font-size: ${Math.round(fontSize * 0.85)}px;
          color: #555;
          margin: 2px 0;
          padding-left: 4px;
        }
        .item-prices {
          display: flex;
          justify-content: space-between;
          margin-top: 3px;
          font-size: ${Math.round(fontSize * 0.9)}px;
        }
        .item-unit-price {
          font-weight: 500;
        }
        .item-total-price {
          font-weight: 700;
        }
        .totals {
          margin: 8px 0;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          font-size: ${fontSize}px;
        }
        .total-label {
          font-weight: 600;
        }
        .total-value {
          font-weight: 700;
        }
        .total-final {
          font-size: ${Math.round(fontSize * 1.1)}px;
          font-weight: 800;
          margin-top: 6px;
          padding-top: 6px;
          border-top: 2px solid #000;
        }
        .payment-info {
          margin: 8px 0;
          padding: 6px;
          background: #f5f5f5;
          border-left: 3px solid #000;
        }
        .payment-label {
          font-weight: 700;
          margin-bottom: 2px;
        }
        .payment-value {
          font-weight: 600;
        }
        .receipt-title {
          text-align: center;
          font-size: ${Math.min(Math.round(fontSize * 0.92), 16)}px;
          font-weight: 900;
          margin: 10px 0;
          letter-spacing: -0.3px;
          text-transform: uppercase;
          white-space: nowrap !important;
          line-height: 1.1;
          overflow: hidden;
          width: 100%;
          box-sizing: border-box;
          display: block;
        }
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
        <!-- Cabeçalho do Estabelecimento -->
        <div class="header">
          <div class="header-title">${r.establishmentName.toUpperCase()}</div>
          ${r.establishmentCnpj ? `<div class="header-subtitle">CNPJ: ${formatCNPJ(r.establishmentCnpj)}</div>` : ""}
          ${r.establishmentAddress ? `<div class="header-subtitle">${r.establishmentAddress}</div>` : ""}
          ${r.establishmentPhone ? `<div class="header-subtitle">Tel: ${r.establishmentPhone}</div>` : ""}
          <div class="header-subtitle" style="font-size: ${Math.max(10, Math.round(fontSize * 0.7))}px; margin-top: 4px; opacity: 0.7;">Documento não fiscal</div>
        </div>

        <div class="sep"></div>

        <!-- Dados do Cliente -->
        <div class="section">
          <div class="section-title">CLIENTE</div>
          <div class="info-row">
            <span class="info-label">Nome:</span>
            <span class="info-value" style="word-break: break-word; white-space: normal; text-align: left;">${r.customerName}</span>
          </div>
          ${r.customerCpf ? `
            <div class="info-row">
              <span class="info-label">CPF:</span>
              <span class="info-value">${formatCPF(r.customerCpf)}</span>
            </div>
          ` : ""}
          ${r.customerPhone ? `
            <div class="info-row phone-row">
              <span class="info-label">Tel:</span>
              <span class="info-value phone-value">${r.customerPhone}</span>
            </div>
          ` : ""}
        </div>

        <div class="sep"></div>

        <!-- Título CUPOM NÃO FISCAL -->
        <div class="receipt-title">
          CUPOM NÃO FISCAL
        </div>

        <div class="sep"></div>

        <!-- Detalhes da Venda -->
        <div class="section">
          <div class="info-row">
            <span class="info-label">Data:</span>
            <span class="info-value">${formattedDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Hora:</span>
            <span class="info-value">${formattedTime}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Número da Venda:</span>
            <span class="info-value">${r.orderNumber}</span>
          </div>
        </div>

        <div class="sep"></div>

        <!-- Lista de Itens -->
        <div class="section">
          <div class="section-title">ITENS</div>
          ${itemsHtml}
        </div>

        <div class="sep"></div>

        <!-- Totais -->
        <div class="totals">
          <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span class="total-value">R$ ${r.subtotal.toFixed(2)}</span>
          </div>
          ${r.discountAmount > 0 ? `
            <div class="total-row">
              <span class="total-label">Descontos:</span>
              <span class="total-value">-R$ ${r.discountAmount.toFixed(2)}</span>
            </div>
          ` : ""}
          ${r.deliveryFee > 0 ? `
            <div class="total-row">
              <span class="total-label">Taxa de Entrega:</span>
              <span class="total-value">R$ ${r.deliveryFee.toFixed(2)}</span>
            </div>
          ` : ""}
          ${r.taxAmount && r.taxAmount > 0 ? `
            <div class="total-row">
              <span class="total-label">Acréscimos:</span>
              <span class="total-value">R$ ${r.taxAmount.toFixed(2)}</span>
            </div>
          ` : ""}
          <div class="total-row total-final">
            <span class="total-label">TOTAL:</span>
            <span class="total-value">R$ ${r.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div class="sep"></div>

        <!-- Detalhes do Pagamento -->
        ${r.paymentMethod ? `
          <div class="payment-info">
            <div class="payment-label">Forma de Pagamento:</div>
            <div class="payment-value">${formatPaymentMethod(r.paymentMethod)}</div>
          </div>
        ` : ""}

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
