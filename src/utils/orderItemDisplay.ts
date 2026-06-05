/** Nome exibido no cupom / lista de pedidos (site pode usar produto placeholder). */
export function resolveOrderItemDisplayName(item: {
  products?: { name?: string | null } | null;
  customizations?: unknown;
  notes?: string | null;
}): string {
  const custom = item.customizations as { site_item_name?: string } | null | undefined;
  if (custom?.site_item_name?.trim()) {
    return custom.site_item_name.trim();
  }
  if (item.products?.name?.trim()) {
    return item.products.name.trim();
  }
  return "Item";
}

/** Extrai itens do texto WhatsApp/notes no formato [1x Produto R$ 10,00]. */
export function parseBracketItemsFromNotes(
  notes: string | null | undefined
): Array<{
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}> {
  if (!notes?.trim()) return [];

  const parsePrice = (raw: string) => {
    const s = raw.trim();
    if (s.includes(",")) {
      return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(s) || 0;
  };

  const items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }> = [];

  const bracketRegex = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = bracketRegex.exec(notes)) !== null) {
    const itemText = match[1].trim();
    if (!itemText) continue;

    const qtyMatch = itemText.match(/^(\d+)x\s+/i);
    if (!qtyMatch) continue;

    const quantity = parseInt(qtyMatch[1], 10) || 1;
    if (quantity <= 0) continue;

    let remaining = itemText.replace(/^\d+x\s+/i, "").trim();
    const priceMatch = remaining.match(/R\$\s*([\d.,]+)/i);
    if (!priceMatch) continue;

    const totalPrice = parsePrice(priceMatch[1]);
    if (totalPrice <= 0) continue;

    remaining = remaining.replace(/R\$\s*[\d.,]+\s*/i, "").trim();
    const name = remaining
      .replace(/\s*(Obs:|Observação:|Molhos?:|Molho especial:).*$/i, "")
      .trim();

    if (!name) continue;

    items.push({
      name,
      quantity,
      unitPrice: totalPrice / quantity,
      totalPrice,
    });
  }

  return items;
}
