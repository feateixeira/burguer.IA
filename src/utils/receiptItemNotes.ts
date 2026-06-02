/** Regras de molho/notas por tipo de item (cupom / pedidos do site). */

export function isBaguetteOrSmashProductName(name: string): boolean {
  const n = (name || "").toLowerCase();
  return n.includes("baguete") || n.includes("smash");
}

/** Bebidas e itens que não devem exibir linha de molho no cupom. */
export function isReceiptDrinkItemName(name: string): boolean {
  if (isBaguetteOrSmashProductName(name)) return false;

  const n = (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const keywords = [
    "coca",
    "guarana",
    "pepsi",
    "fanta",
    "sprite",
    "refri",
    "refrigerante",
    "suco",
    "agua",
    "água",
    "lata",
    "latinha",
    "del vale",
    "schweppes",
    "h2oh",
    "monster",
    "red bull",
    "bebida",
    "creme",
    "vitamina",
    "milkshake",
    "milk shake",
    "iced tea",
    "itubaina",
    "crystal",
    "dell vale",
    "2 litros",
    "600ml",
    "pet",
  ];

  return keywords.some((k) => n.includes(k));
}

function collectSauceFragments(text: string): string[] {
  const parts: string[] = [];
  const patterns = [
    /Molhos?\s*:\s*([^|\n]+)/gi,
    /Molho especial\s*:\s*([^|\n]+)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const chunk = m[1]
        .split(/,\s*/)
        .map((s) => s.replace(/^Variante\s*:\s*/i, "").trim())
        .filter(Boolean);
      parts.push(...chunk);
    }
  }
  return [...new Set(parts)];
}

function stripMolhoBlocks(text: string): string {
  return text
    .replace(/\|?\s*Molhos?\s*:\s*[^|]*/gi, "")
    .replace(/\|?\s*Molho especial\s*:\s*[^|]*/gi, "")
    .replace(/^-?\s*Molhos?\s*:\s*[^\n]*/gim, "")
    .replace(/^-?\s*Molho especial\s*:\s*[^\n]*/gim, "")
    .replace(/\|?\s*Variante\s*:\s*[^|]*/gi, "")
    .replace(/^-?\s*Variante\s*:\s*[^\n]*/gim, "")
    .replace(/\|\s*/g, "\n")
    .replace(/\n\s*\n+/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza notes antes da impressão: bebidas sem molho; baguete/smash só "Molho especial".
 */
export function sanitizeReceiptNotesForItem(
  itemName: string,
  notes?: string | null
): string | undefined {
  if (!notes?.trim()) return undefined;

  const name = itemName || "";

  if (isReceiptDrinkItemName(name)) {
    const cleaned = stripMolhoBlocks(notes).replace(/^Obs:\s*$/i, "").trim();
    return cleaned || undefined;
  }

  if (isBaguetteOrSmashProductName(name)) {
    const sauces = collectSauceFragments(notes);
    let body = stripMolhoBlocks(notes);

    if (sauces.length > 0) {
      const line = `Molho especial: ${sauces.join(", ")}`;
      body = body ? `${line}\n${body}` : line;
    }

    body = body.replace(/^Obs:\s*$/i, "").trim();
    return body || undefined;
  }

  return notes.trim() || undefined;
}
