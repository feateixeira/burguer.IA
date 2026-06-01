import { formatCurrency } from "@/utils/currency";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CashClosingReportData } from "./cashClosingReport";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatSessionDateTime(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function printHtmlViaIframe(html: string, paperWidth: number) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  let hasPrinted = false;
  const doPrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        /* ignore */
      }
    }, 400);
  };

  const checkReady = () => {
    if (hasPrinted) return;
    if (doc.readyState === "complete" || doc.readyState === "interactive") {
      setTimeout(doPrint, 120);
    } else {
      setTimeout(checkReady, 50);
    }
  };

  setTimeout(checkReady, 80);
  iframe.onload = () => {
    if (!hasPrinted) setTimeout(doPrint, 120);
  };
}

export function printCashClosingReport(data: CashClosingReportData): void {
  const printersConfig = localStorage.getItem("printer_configs");
  let fontSize = 11;
  let paperWidth = 80;

  if (printersConfig) {
    try {
      const printers = JSON.parse(printersConfig);
      const def = printers.find((p: { isDefault?: boolean }) => p.isDefault);
      if (def) {
        fontSize = Math.min(def.fontSize || fontSize, 12);
        paperWidth = def.paperWidth || paperWidth;
      }
    } catch {
      /* use defaults */
    }
  }

  const sideMargin = 4;
  const printableWidth = Math.max(56, paperWidth - sideMargin * 2);
  const fmt = (n: number) => formatCurrency(n);
  const nowStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

  const paymentSections = data.paymentGroups
    .map((group) => {
      const lines = group.lines
        .map(
          (l) =>
            `<div class="line">${escapeHtml(l.time)} pedido ${escapeHtml(l.orderNumber)} ${fmt(l.amount)}</div>`
        )
        .join("");
      return `
        <div class="section">
          <div class="section-title">${escapeHtml(group.label)} total: ${fmt(group.total)}</div>
          ${lines || '<div class="line muted">(nenhum pedido)</div>'}
        </div>
      `;
    })
    .join("");

  const motoboySections = data.deliveryBoyGroups
    .map((boy) => {
      const lines = boy.lines
        .map(
          (l) =>
            `<div class="line">${escapeHtml(l.time)} pedido ${escapeHtml(l.orderNumber)} ${fmt(l.amount)}</div>`
        )
        .join("");
      return `
        <div class="section">
          <div class="section-title">MOTOBOY: ${escapeHtml(boy.name)}</div>
          <div class="line">Entregas: ${boy.deliveriesCount} | Pedidos: ${fmt(boy.ordersTotal)}</div>
          ${boy.dailyRate > 0 ? `<div class="line">Diária: ${fmt(boy.dailyRate)}</div>` : ""}
          ${boy.deliveryFeesTotal > 0 ? `<div class="line">Taxas entrega: ${fmt(boy.deliveryFeesTotal)}</div>` : ""}
          <div class="line bold">Total motoboy: ${fmt(boy.motoboyTotal)}</div>
          <div class="subhead">Pedidos entregues:</div>
          ${lines || '<div class="line muted">(nenhum)</div>'}
        </div>
      `;
    })
    .join("");

  const totalsBlock = data.totals
    ? `
      <div class="section">
        <div class="section-title">RESUMO DO CAIXA</div>
        <div class="line">Dinheiro esperado: ${fmt(data.totals.expected_cash)}</div>
        <div class="line">PIX esperado: ${fmt(data.totals.expected_pix)}</div>
        <div class="line">Débito esperado: ${fmt(data.totals.expected_debit)}</div>
        <div class="line">Crédito esperado: ${fmt(data.totals.expected_credit)}</div>
        <div class="line bold">Total esperado: ${fmt(data.totals.expected_total)}</div>
      </div>
    `
    : "";

  const warnBlock =
    data.pedidosAConfirmar > 0
      ? `<div class="warn">ATENÇÃO: ${data.pedidosAConfirmar} pedido(s) com pagamento À CONFIRMAR (fora do resumo acima)</div>`
      : "";

  const html = `
  <html>
    <head>
      <meta charset="utf-8"/>
      <title>Fechamento de Caixa</title>
      <style>
        * { box-sizing: border-box; }
        @page { size: ${paperWidth}mm auto; margin: 0; }
        html, body { width: ${paperWidth}mm; margin: 0; padding: 0; }
        body {
          display: flex;
          justify-content: center;
          font-family: "Courier New", Courier, monospace;
          font-size: ${fontSize}px;
          line-height: 1.25;
          color: #000;
        }
        .ticket {
          width: ${printableWidth}mm;
          padding: ${sideMargin}mm;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .title { font-size: ${fontSize + 2}px; font-weight: bold; text-align: center; margin-bottom: 4px; }
        .subtitle { text-align: center; margin-bottom: 6px; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .section { margin: 8px 0; }
        .section-title { font-weight: bold; margin-bottom: 3px; text-transform: uppercase; }
        .subhead { font-weight: bold; margin: 4px 0 2px; font-size: ${fontSize - 1}px; }
        .line { margin: 1px 0; word-break: break-word; }
        .muted { color: #444; }
        .warn { margin: 6px 0; padding: 4px; border: 1px solid #000; font-weight: bold; }
        .footer { margin-top: 8px; text-align: center; font-size: ${fontSize - 1}px; }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="title">${escapeHtml(data.establishmentName)}</div>
        <div class="subtitle bold">FECHAMENTO DE CAIXA</div>
        <div class="line">Abertura: ${formatSessionDateTime(data.sessionOpenedAt)}</div>
        <div class="line">Fechamento: ${data.sessionClosedAt ? formatSessionDateTime(data.sessionClosedAt) : "Em aberto"}</div>
        <div class="line">Valor abertura: ${fmt(data.openingAmount)}</div>
        <div class="line">Pedidos no caixa: ${data.ordersInCashCount}</div>
        <div class="divider"></div>
        ${warnBlock}
        ${totalsBlock}
        <div class="section">
          <div class="section-title">DETALHAMENTO POR PAGAMENTO</div>
          ${paymentSections || '<div class="line muted">Nenhum pedido no período</div>'}
        </div>
        ${
          data.deliveryBoyGroups.length > 0
            ? `<div class="divider"></div>
               <div class="section">
                 <div class="section-title">ENTREGAS / MOTOBOYS</div>
                 ${motoboySections}
               </div>`
            : ""
        }
        <div class="divider"></div>
        <div class="footer">Impresso em ${nowStr}</div>
      </div>
    </body>
  </html>`;

  printHtmlViaIframe(html, paperWidth);
}
